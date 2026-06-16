import type { Game } from "@/lib/types";

export interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsApiMarket {
  key: string;
  last_update?: string;
  outcomes: OddsApiOutcome[];
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export interface NormalizedOddsSnapshot {
  providerEventId: string;
  market: string;
  selection: string;
  odd: number;
  provider: string;
  capturedAt: Date;
}

export interface NormalizedOddsEvent {
  providerId: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  status: "PRE_GAME";
  game: Game;
  snapshots: NormalizedOddsSnapshot[];
}

function bestPrice(outcomes: OddsApiOutcome[], selection: string) {
  return outcomes.filter((item) => item.name === selection).reduce((best, item) => Math.max(best, item.price), 0);
}

export function normalizeOddsApiEvent(event: OddsApiEvent): NormalizedOddsEvent | null {
  const h2hMarkets = event.bookmakers.flatMap((bookmaker) => bookmaker.markets.filter((market) => market.key === "h2h").map((market) => ({ bookmaker, market })));
  if (!h2hMarkets.length) return null;

  const allOutcomes = h2hMarkets.flatMap(({ market }) => market.outcomes);
  const home = bestPrice(allOutcomes, event.home_team);
  const away = bestPrice(allOutcomes, event.away_team);
  const draw = bestPrice(allOutcomes, "Draw");
  if (!home || !away) return null;

  const startsAt = new Date(event.commence_time);
  const snapshots = event.bookmakers.flatMap((bookmaker) => bookmaker.markets.flatMap((market) => market.outcomes.map((outcome) => ({
    providerEventId: event.id,
    market: market.key,
    selection: outcome.point === undefined ? outcome.name : `${outcome.name} ${outcome.point}`,
    odd: outcome.price,
    provider: bookmaker.key,
    capturedAt: new Date(market.last_update ?? bookmaker.last_update),
  }))));

  return {
    providerId: event.id,
    competition: event.sport_title,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    startsAt,
    status: "PRE_GAME",
    game: {
      id: event.id,
      competition: event.sport_title,
      group: "Copa 2026",
      time: startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
      home: event.home_team,
      away: event.away_team,
      homeCode: event.home_team.slice(0, 3).toUpperCase(),
      awayCode: event.away_team.slice(0, 3).toUpperCase(),
      status: "Pré-jogo",
      odds: { home, draw: draw || 0, away },
    },
    snapshots,
  };
}

export function normalizeOddsApiFeed(events: OddsApiEvent[]): NormalizedOddsEvent[] {
  return events.map(normalizeOddsApiEvent).filter((event): event is NormalizedOddsEvent => event !== null);
}
