import type { OddsApiEvent } from "@/adapters/oddsAdapter";
import { redactSecrets } from "@/services/securityService";
import {
  assertProviderCallAllowed,
  cacheTtlForEndpoint,
  logProviderUsage,
  providerCacheTtl,
  readCache,
  readProviderCache,
  writeCache,
  writeProviderCache,
} from "@/services/providerEconomyService";
import { filterMatches } from "../competitionFilter";
import type { OddsProvider, ProviderMatch, ProviderOdd, ProviderResponse, ProviderResult, ProviderSyncContext } from "../types";
import { LiveSportsDiscoveryService } from "./LiveSportsDiscoveryService";
import { LeagueSelectionService } from "./LeagueSelectionService";
import type { OddsApiSportEntry } from "./LiveSportsTypes";

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

const RESOLVED_LEAGUE_CACHE_KEY = "resolved-active-league";

type ResolvedLeague = { sportKey: string; title: string | null };

export class TheOddsApiProvider implements OddsProvider {
  readonly id = "the-odds-api";
  readonly licensed = true;

  private lastSyncContext: ProviderSyncContext | null = null;
  /** Guarda a resposta de eventos ja obtida durante a selecao automatica
   * de liga (Fase 3), para que getMatches() nunca precise refazer a
   * mesma chamada logo em seguida. Consumida uma unica vez. */
  private pendingEventsForSelection: { sportKey: string; events: ProviderResponse<OddsApiEvent[]> } | null = null;

  isConfigured() {
    return Boolean(process.env.ODDS_API_KEY?.trim());
  }

  /** Sprint 9.2.1 — ultimo esporte/liga efetivamente usado (ou `null` se
   * nenhuma chamada foi feita ainda nesta instancia). */
  getLastSyncContext(): ProviderSyncContext | null {
    return this.lastSyncContext;
  }

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<ProviderResponse<T>> {
    const apiKey = process.env.ODDS_API_KEY?.trim();
    if (!apiKey) throw new Error("ODDS_API_KEY nao configurada");

    const url = new URL(`${baseUrl}${path}`);
    Object.entries({ ...params, apiKey }).forEach(([key, value]) => url.searchParams.set(key, value));
    const cacheKey = `${path}?${new URLSearchParams(params).toString()}`;
    const cached = await readProviderCache<T>(this.id, cacheKey);
    if (cached) return { data: cached };

    const safeUrl = redactSecrets(url.toString());
    console.log(`[provider-audit] apiKeyPresent=${Boolean(apiKey)}`);
    console.log(`[provider-audit] apiKeyLength=${apiKey.length}`);
    console.log(`[provider-audit] endpoint=${safeUrl}`);

    await assertProviderCallAllowed(this.id, path);
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { accept: "application/json" },
    });
    await logProviderUsage({ provider: this.id, endpoint: path, status: response.status, headers: response.headers });
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

    const data = await response.json() as T;
    await writeProviderCache(this.id, cacheKey, data, cacheTtlForEndpoint(path));
    return { data, remainingLimit: Number(response.headers.get("x-requests-remaining") ?? "") || undefined };
  }

  /** GET /v4/sports?all=true — usado pela descoberta automatica de ligas (Fase 2, LiveSportsDiscoveryService). */
  async getSports() {
    return this.request<OddsApiSportEntry[]>("/sports", { all: "true" });
  }

  private async probeEvents(sportKey: string) {
    return this.request<OddsApiEvent[]>(`/sports/${sportKey}/events`, { dateFormat: "iso" });
  }

  /**
   * Resolve dinamicamente qual liga de futebol usar (Fase 3), substituindo
   * o antigo `soccer_fifa_world_cup` fixo no codigo. A escolha fica em
   * cache (sempre ativo, independente de PROVIDER_ECONOMY_MODE — ver
   * `providerEconomyService.readCache`/`writeCache`) por
   * `providerCacheTtl.leagueSelection`, ou por
   * `providerCacheTtl.leagueSelectionEmptyRetry` (mais curto) quando
   * nenhuma liga tinha eventos, para tentar de novo em breve sem varrer
   * todas as ligas a cada sincronizacao. `ODDS_SPORT_KEY`, se definida,
   * e sempre tentada primeiro.
   */
  private async resolveSportKey(): Promise<ResolvedLeague> {
    const override = process.env.ODDS_SPORT_KEY?.trim() || null;
    const cached = await readCache<ResolvedLeague>(this.id, RESOLVED_LEAGUE_CACHE_KEY);
    if (cached) return cached;

    const discovery = new LiveSportsDiscoveryService(this);
    const leagues = await discovery.discoverSoccerLeagues();
    const selector = new LeagueSelectionService<OddsApiEvent>({ probeEvents: (sportKey) => this.probeEvents(sportKey) });
    const selection = await selector.selectActiveLeague(leagues, override);

    const resolved: ResolvedLeague = { sportKey: selection.sportKey, title: selection.title };
    const ttl = selection.eventsFound > 0 ? providerCacheTtl.leagueSelection : providerCacheTtl.leagueSelectionEmptyRetry;
    await writeCache(this.id, RESOLVED_LEAGUE_CACHE_KEY, resolved, ttl);
    this.pendingEventsForSelection = { sportKey: selection.sportKey, events: selection.response };
    return resolved;
  }

  async getMatches() {
    const resolved = await this.resolveSportKey();
    const events =
      this.pendingEventsForSelection?.sportKey === resolved.sportKey
        ? (() => {
            const pending = this.pendingEventsForSelection!;
            this.pendingEventsForSelection = null;
            return pending.events;
          })()
        : await this.probeEvents(resolved.sportKey);

    this.lastSyncContext = { sport: resolved.sportKey, league: resolved.title, eventsFound: events.data.length };

    const matches: ProviderMatch[] = events.data.map((event) => ({
      providerId: `${this.id}:${event.id}`,
      competition: event.sport_title,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      startsAt: new Date(event.commence_time),
      status: new Date(event.commence_time) <= new Date() ? "LIVE" : "PRE_GAME",
    }));
    return { data: filterMatches(matches), remainingLimit: events.remainingLimit };
  }

  async getOdds() {
    const resolved = await this.resolveSportKey();
    const response = await this.request<OddsApiEvent[]>(`/sports/${resolved.sportKey}/odds`, {
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
    const resolved = await this.resolveSportKey();
    const response = await this.request<ScoreEvent[]>(`/sports/${resolved.sportKey}/scores`, { daysFrom: "3", dateFormat: "iso" });
    const results: ProviderResult[] = response.data
      .filter((event) => event.completed && event.scores)
      .map((event) => ({
        providerId: `${this.id}:${event.id}`,
        competition: event.sport_title ?? resolved.sportKey,
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
