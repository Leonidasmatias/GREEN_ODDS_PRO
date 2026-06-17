import type { OddsApiEvent } from "@/adapters/oddsAdapter";
import { redactSecrets } from "@/services/securityService";
import { filterMatches } from "../competitionFilter";
import type { OddsProvider, ProviderMatch, ProviderOdd, ProviderResponse, ProviderResult } from "../types";

const baseUrl = "https://api.the-odds-api.com/v4";
const exhaustedCode = "OUT_OF_USAGE_CREDITS";

interface ScoreEvent {
  id: string;
  sport_title?: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: Array<{ name: string; score: string }> | null;
}

export class TheOddsApiProvider implements OddsProvider {
  readonly id = "the-odds-api";
  readonly licensed = true;

  isConfigured() {
    return Boolean(process.env.ODDS_API_KEY?.trim());
  }

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<ProviderResponse<T>> {
    const apiKey = process.env.ODDS_API_KEY?.trim();
    if (!apiKey) throw new Error("ODDS_API_KEY nao configurada");

    const url = new URL(`${baseUrl}${path}`);
    Object.entries({ ...params, apiKey }).forEach(([key, value]) => url.searchParams.set(key, value));

    const safeUrl = redactSecrets(url.toString());
    console.log(`[provider-audit] apiKeyPresent=${Boolean(apiKey)}`);
    console.log(`[provider-audit] apiKeyLength=${apiKey.length}`);
    console.log(`[provider-audit] endpoint=${safeUrl}`);

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { accept: "application/json" },
    });
    console.log(`[provider-audit] status=${response.status}`);

    if (!response.ok) {
      const preview = redactSecrets((await response.text()).slice(0, 500));
      if (preview.includes(exhaustedCode)) {
        throw new Error(`PROVIDER_EXHAUSTED: the-odds-api ${exhaustedCode}`);
      }
      if (response.status === 401) {
        throw new Error(`The Odds API authentication failed${preview ? `: ${preview}` : ""}`);
      }
      throw new Error(`The Odds API request failed with status ${response.status}${preview ? `: ${preview}` : ""}`);
    }

    return {
      data: await response.json() as T,
      remainingLimit: Number(response.headers.get("x-requests-remaining") ?? "") || undefined,
    };
  }

  private sport() {
    return process.env.ODDS_SPORT_KEY?.trim() || "soccer_fifa_world_cup";
  }

  async getMatches() {
    const response = await this.request<OddsApiEvent[]>(`/sports/${this.sport()}/events`, { dateFormat: "iso" });
    const matches: ProviderMatch[] = response.data.map((event) => ({
      providerId: `${this.id}:${event.id}`,
      competition: event.sport_title,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      startsAt: new Date(event.commence_time),
      status: new Date(event.commence_time) <= new Date() ? "LIVE" : "PRE_GAME",
    }));
    return { data: filterMatches(matches), remainingLimit: response.remainingLimit };
  }

  async getOdds() {
    const response = await this.request<OddsApiEvent[]>(`/sports/${this.sport()}/odds`, {
      regions: process.env.ODDS_REGIONS?.trim() || "eu",
      markets: "h2h,totals,spreads",
      oddsFormat: "decimal",
      dateFormat: "iso",
    });
    const allowed = new Set(filterMatches(response.data.map((event) => ({
      providerId: `${this.id}:${event.id}`,
      competition: event.sport_title,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      startsAt: new Date(event.commence_time),
      status: "PRE_GAME" as const,
    }))).map((item) => item.providerId));
    const odds: ProviderOdd[] = response.data
      .filter((event) => allowed.has(`${this.id}:${event.id}`))
      .flatMap((event) => event.bookmakers.flatMap((bookmaker) => bookmaker.markets.flatMap((market) => market.outcomes
        .filter((outcome) => outcome.price > 1)
        .map((outcome) => ({
          providerEventId: `${this.id}:${event.id}`,
          market: market.key,
          selection: outcome.point == null ? outcome.name : `${outcome.name} ${outcome.point}`,
          odd: outcome.price,
          bookmaker: `${this.id}:${bookmaker.key}`,
          capturedAt: new Date(market.last_update ?? bookmaker.last_update),
        })))));
    return { data: odds, remainingLimit: response.remainingLimit };
  }

  async getMarkets() {
    return { data: ["h2h", "totals", "spreads"] };
  }

  async getResults(): Promise<ProviderResponse<ProviderResult[]>> {
    const response = await this.request<ScoreEvent[]>(`/sports/${this.sport()}/scores`, { daysFrom: "3", dateFormat: "iso" });
    const results: ProviderResult[] = response.data
      .filter((event) => event.completed && event.scores)
      .map((event) => ({
        providerId: `${this.id}:${event.id}`,
        competition: event.sport_title ?? this.sport(),
        homeTeam: event.home_team,
        awayTeam: event.away_team,
        startsAt: new Date(event.commence_time),
        status: "FINISHED" as const,
        homeScore: Number(event.scores?.find((score) => score.name === event.home_team)?.score ?? 0),
        awayScore: Number(event.scores?.find((score) => score.name === event.away_team)?.score ?? 0),
      }))
      .filter((result) => filterMatches([result]).length > 0);
    return { data: results, remainingLimit: response.remainingLimit };
  }
}
