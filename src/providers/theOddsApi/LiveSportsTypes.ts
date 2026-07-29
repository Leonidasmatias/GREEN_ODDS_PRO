// Sprint 9.2.1 — Provider Go Live & Live Data Pipeline.
// Tipos do endpoint GET /v4/sports da The Odds API e da forma normalizada
// usada internamente pelo servico de descoberta.

/** Formato bruto retornado por GET /v4/sports?all=true. */
export type OddsApiSportEntry = {
  key: string;
  group: string;
  title: string;
  description?: string;
  active: boolean;
  has_outrights?: boolean;
};

/** Forma normalizada (nomes em camelCase) usada pelo resto do app. */
export type DiscoveredSport = {
  key: string;
  group: string;
  title: string;
  active: boolean;
  hasOutrights: boolean;
};

/**
 * Regioes e mercados aceitos pela The Odds API. Nao existe endpoint de
 * descoberta dinamica para eles — sao um conjunto fixo, documentado
 * oficialmente. Mantidos aqui como constantes conhecidas (nunca
 * inventadas) para uso pelo restante do pipeline de odds.
 */
export const KNOWN_ODDS_REGIONS = ["us", "us2", "uk", "au", "eu"] as const;
export type KnownOddsRegion = (typeof KNOWN_ODDS_REGIONS)[number];

export const KNOWN_ODDS_MARKETS = ["h2h", "spreads", "totals"] as const;
export type KnownOddsMarket = (typeof KNOWN_ODDS_MARKETS)[number];
