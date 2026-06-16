import type { Game } from "@/lib/types";
import type { AnalyzedOpportunity, GreenClassification, Risk, Signal } from "@/lib/types";
import type { NormalizedOddsEvent } from "@/adapters/oddsAdapter";
import { getProviderLiveFeed, getProviderResults } from "@/providers/providerManager";
import { redactSecrets } from "./securityService";

export interface OddsFeedResult { mode: "REAL"; provider: string; events: NormalizedOddsEvent[]; games: Game[]; warning?: string; requestsRemaining?: number; updatedAt: string }

function classifyOdd(odd: number): { risk: Risk; signal: Signal; classification: GreenClassification; score: number } {
  if (odd <= 0) return { risk: "Alto", signal: "Evitar", classification: "EVITAR", score: 0 };
  if (odd <= 1.75) return { risk: "Baixo", signal: "Aguardar", classification: "MODERADO", score: 62 };
  if (odd <= 2.8) return { risk: "Médio", signal: "Aguardar", classification: "MODERADO", score: 70 };
  return { risk: "Alto", signal: "Aguardar", classification: "MODERADO", score: 58 };
}

export function opportunitiesFromFeed(feed: OddsFeedResult): AnalyzedOpportunity[] {
  return feed.events.flatMap((event) => {
    const h2h = event.snapshots.filter((snapshot) => snapshot.market.toLowerCase().includes("h2h") || snapshot.market.toLowerCase().includes("winner"));
    return h2h.filter((snapshot) => snapshot.odd > 1).map((snapshot) => {
      const impliedProbability = 1 / snapshot.odd;
      const estimatedProbability = impliedProbability;
      const edge = 0;
      const expectedValue = estimatedProbability * snapshot.odd - 1;
      const classification = classifyOdd(snapshot.odd);
      return {
        id: `${snapshot.providerEventId}-${snapshot.market}-${snapshot.selection}`,
        game: `${event.homeTeam} x ${event.awayTeam}`,
        market: snapshot.market,
        pick: snapshot.selection,
        odd: snapshot.odd,
        fairProbability: estimatedProbability,
        confidence: classification.score,
        context: { form: 0, attack: 0, defense: 0, timing: 0, stats: 0 },
        impliedProbability,
        edge,
        expectedValue,
        risk: classification.risk,
        signal: classification.signal,
        score: classification.score,
        classification: classification.classification,
        powerRating: classification.score,
      };
    });
  });
}

export async function getWorldCupOdds(): Promise<OddsFeedResult> {
  try {
    const feed = await getProviderLiveFeed();
    const oddsByMatch = new Map<string, typeof feed.odds>();
    for (const odd of feed.odds) oddsByMatch.set(odd.providerEventId, [...(oddsByMatch.get(odd.providerEventId) ?? []), odd]);
    const events: NormalizedOddsEvent[] = feed.matches.map((match) => {
      const odds = oddsByMatch.get(match.providerId) ?? [];
      const h2h = odds.filter((item) => item.market.toLowerCase().includes("h2h") || item.market.toLowerCase().includes("winner"));
      const home = Math.max(0, ...h2h.filter((item) => item.selection === match.homeTeam).map((item) => item.odd));
      const away = Math.max(0, ...h2h.filter((item) => item.selection === match.awayTeam).map((item) => item.odd));
      const draw = Math.max(0, ...h2h.filter((item) => item.selection.toLowerCase() === "draw" || item.selection.toLowerCase() === "empate").map((item) => item.odd));
      return {
        providerId: match.providerId,
        competition: match.competition,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        startsAt: match.startsAt,
        status: "PRE_GAME",
        game: {
          id: match.providerId,
          competition: match.competition,
          group: match.competition,
          time: match.startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
          home: match.homeTeam,
          away: match.awayTeam,
          homeCode: match.homeTeam.slice(0, 3).toUpperCase(),
          awayCode: match.awayTeam.slice(0, 3).toUpperCase(),
          status: match.status === "LIVE" ? "Ao vivo" : match.status === "FINISHED" ? "Encerrado" : "Pré-jogo",
          score: match.homeScore == null ? undefined : `${match.homeScore} - ${match.awayScore}`,
          odds: { home, draw, away },
        },
        snapshots: odds.map((odd) => ({ providerEventId: odd.providerEventId, market: odd.market, selection: odd.selection, odd: odd.odd, provider: odd.bookmaker, capturedAt: odd.capturedAt })),
      };
    });
    return { mode: "REAL", provider: feed.provider.id, events, games: events.map((event) => event.game), warning: feed.failoverErrors.join(" | ") || undefined, requestsRemaining: feed.remainingLimit, updatedAt: new Date().toISOString() };
  } catch (error) {
    return { mode: "REAL", provider: "none", events: [], games: [], warning: redactSecrets(error instanceof Error ? error.message : "Providers indisponiveis"), updatedAt: new Date().toISOString() };
  }
}

export async function getCompletedScores() {
  try {
    const response = await getProviderResults();
    return { scores: response.data.map((result) => ({ providerId: result.providerId, homeTeam: result.homeTeam, awayTeam: result.awayTeam, homeScore: result.homeScore ?? 0, awayScore: result.awayScore ?? 0 })), warning: response.failoverErrors.join(" | ") || undefined };
  } catch (error) {
    return { scores: [], warning: redactSecrets(error instanceof Error ? error.message : "Providers de resultado indisponiveis") };
  }
}
