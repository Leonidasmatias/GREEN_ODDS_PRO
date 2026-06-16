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

export interface OddsProvider {
  readonly id: string;
  readonly licensed: boolean;
  isConfigured(): boolean;
  getMatches(): Promise<ProviderResponse<ProviderMatch[]>>;
  getOdds(): Promise<ProviderResponse<ProviderOdd[]>>;
  getMarkets(): Promise<ProviderResponse<string[]>>;
  getResults(): Promise<ProviderResponse<ProviderResult[]>>;
}
