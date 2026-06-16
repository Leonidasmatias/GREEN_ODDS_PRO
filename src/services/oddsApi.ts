import { games as mockGames } from "@/data/mockData";
import type { Game } from "@/lib/types";
import type { NormalizedOddsEvent } from "@/adapters/oddsAdapter";
import { getProviderLiveFeed, getProviderResults } from "@/providers/providerManager";
import { redactSecrets } from "./securityService";

export interface OddsFeedResult { mode: "REAL" | "MOCK"; provider: string; events: NormalizedOddsEvent[]; games: Game[]; warning?: string; requestsRemaining?: number }

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
    return { mode: feed.provider.licensed ? "REAL" : "MOCK", provider: feed.provider.id, events, games: events.map((event) => event.game), warning: feed.failoverErrors.join(" | ") || undefined, requestsRemaining: feed.remainingLimit };
  } catch (error) {
    return { mode: "MOCK", provider: "none", events: [], games: process.env.NODE_ENV === "production" ? [] : mockGames, warning: redactSecrets(error instanceof Error ? error.message : "Providers indisponiveis") };
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
