export type ProviderMatchStatus = "PRE_GAME" | "LIVE" | "FINISHED" | "CANCELLED";

export interface ProviderMatch {
  providerId: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  status: ProviderMatchStatus;
  homeScore?: number;
  awayScore?: number;
}

export interface ProviderOdd {
  providerEventId: string;
  market: string;
  selection: string;
  odd: number;
  bookmaker: string;
  capturedAt: Date;
}

export interface ProviderResult extends ProviderMatch {
  status: "FINISHED" | "CANCELLED";
}

export interface ProviderResponse<T> {
  data: T;
  remainingLimit?: number;
}

/** Sprint 9.2.1 — contexto da ultima resolucao de esporte/liga usada por
 * um provider com selecao dinamica (ex.: TheOddsApiProvider). Opcional
 * no contrato: providers sem selecao dinamica (SportMonks, API-Football,
 * Mock) simplesmente nao implementam `getLastSyncContext`. */
export interface ProviderSyncContext {
  sport: string;
  league: string | null;
  eventsFound: number;
}

export interface OddsProvider {
  readonly id: string;
  readonly licensed: boolean;
  isConfigured(): boolean;
  getMatches(): Promise<ProviderResponse<ProviderMatch[]>>;
  getOdds(): Promise<ProviderResponse<ProviderOdd[]>>;
  getMarkets(): Promise<ProviderResponse<string[]>>;
  getResults(): Promise<ProviderResponse<ProviderResult[]>>;
  getLastSyncContext?(): ProviderSyncContext | null;
}
