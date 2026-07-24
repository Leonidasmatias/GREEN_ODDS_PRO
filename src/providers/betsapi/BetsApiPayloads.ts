// Fase 3 - BetsAPI Real Integration.
// Tipagem dos payloads brutos retornados pelos endpoints reais da
// BetsAPI utilizados nesta fase (somente leitura). Estes tipos
// representam o formato EXTERNO da API - nunca o modelo interno do
// projeto (ver src/providers/types/dto.ts e BetsApiRawMatch em
// BetsApiAdapter.ts, Fase 2).

export type BetsApiSuccessFlag = 0 | 1;

/** Evento bruto conforme retornado por /v3/events/upcoming e /v1/event/view. */
export type BetsApiRawEvent = {
  id: string;
  sport_id?: string;
  time: string;
  time_status: string;
  league: { id: string; name: string; cc?: string | null };
  home: { id: string; name: string; image_id?: string | null };
  away: { id: string; name: string; image_id?: string | null };
  ss: string | null;
  is_esports?: boolean | number | string;
  timer?: unknown;
  scores?: unknown;
};

export type BetsApiPager = { page: number; per_page: number; total: number };

export type BetsApiUpcomingEventsParams = {
  sport_id: string;
  league_id?: string;
  team_id?: string;
  day?: string;
  page?: number;
  skip_esports?: boolean;
};

export type BetsApiUpcomingEventsPayload = {
  success: BetsApiSuccessFlag;
  pager?: BetsApiPager;
  results: BetsApiRawEvent[];
};

export type BetsApiEventViewPayload = {
  success: BetsApiSuccessFlag;
  results: BetsApiRawEvent[];
};

export type BetsApiLeague = {
  id: string;
  name: string;
  cc?: string | null;
  is_esports?: boolean | number | string;
};

export type BetsApiLeagueCatalogParams = {
  sport_id: string;
  cc?: string;
  max_id?: string;
};

export type BetsApiLeagueCatalogPayload = {
  success: BetsApiSuccessFlag;
  results: BetsApiLeague[];
};

export type BetsApiTeam = {
  id: string;
  name: string;
  cc?: string | null;
  is_esports?: boolean | number | string;
};

export type BetsApiTeamCatalogParams = {
  sport_id: string;
  cc?: string;
  max_id?: string;
};

export type BetsApiTeamCatalogPayload = {
  success: BetsApiSuccessFlag;
  results: BetsApiTeam[];
};

/** Payload de odds capturado apenas para tipagem/armazenamento; nenhum calculo de recomendacao nesta fase. */
export type BetsApiOddsSummaryPayload = {
  success: BetsApiSuccessFlag;
  results: Record<string, unknown>;
};

/** Converte um BetsApiRawEvent (formato real da API) para o BetsApiRawMatch ja suportado pelo ProviderNormalizer (Fase 2, inalterado). */
export function betsApiEventToRawMatch(event: BetsApiRawEvent): {
  id: string;
  league: { id: string; name: string };
  time: string;
  time_status: "0" | "1" | "3";
  home: { name: string };
  away: { name: string };
  ss: string | null;
} {
  const status = event.time_status === "0" || event.time_status === "1" || event.time_status === "3" ? event.time_status : "0";
  return {
    id: event.id,
    league: { id: event.league.id, name: event.league.name },
    time: event.time,
    time_status: status,
    home: { name: event.home.name },
    away: { name: event.away.name },
    ss: event.ss,
  };
}
