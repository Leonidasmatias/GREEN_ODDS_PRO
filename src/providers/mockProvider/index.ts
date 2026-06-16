import { games } from "@/data/mockData";
import type { OddsProvider, ProviderMatch, ProviderOdd } from "../types";

export class MockProvider implements OddsProvider {
  readonly id = "mock";
  readonly licensed = false;
  isConfigured() { return process.env.ALLOW_MOCK_PROVIDER === "true" && process.env.NODE_ENV !== "production"; }
  async getMatches() { const data: ProviderMatch[] = games.map((game) => ({ providerId: `mock:${game.id}`, competition: game.competition, homeTeam: game.home, awayTeam: game.away, startsAt: new Date(), status: game.status === "Ao vivo" ? "LIVE" : game.status === "Encerrado" ? "FINISHED" : "PRE_GAME" })); return { data }; }
  async getOdds() { const data: ProviderOdd[] = games.flatMap((game) => [[game.home, game.odds.home], ["Draw", game.odds.draw], [game.away, game.odds.away]].map(([selection, odd]) => ({ providerEventId: `mock:${game.id}`, market: "h2h", selection: String(selection), odd: Number(odd), bookmaker: "mock", capturedAt: new Date() }))); return { data }; }
  async getMarkets() { return { data: ["h2h"] }; }
  async getResults() { return { data: [] }; }
}
