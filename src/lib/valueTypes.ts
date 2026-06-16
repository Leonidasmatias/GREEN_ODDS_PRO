export type ValueRisk = "BAIXO" | "MEDIO" | "ALTO" | "INDEFINIDO";
export type ValueClassification = "NO BET" | "WATCH" | "GREEN FORTE" | "ELITE GREEN" | "DIAMANTE";
export type ValueStatus = "APPROVED" | "REJECTED" | "WATCH" | "INSUFFICIENT_REAL_DATA";

export interface ValueOpportunity {
  id: string;
  matchId: string;
  oddsSnapshotId: string;
  provider: string;
  bookmaker: string;
  providerEventId: string;
  competition: string;
  game: string;
  startsAt: string;
  matchStatus: string;
  market: string;
  selection: string;
  odd: number;
  impliedProbability: number;
  bookmakerMargin: number;
  fairProbability: number;
  fairOdd: number;
  estimatedProbability: number | null;
  edge: number | null;
  expectedValue: number | null;
  confidence: number;
  risk: ValueRisk;
  score: number;
  classification: ValueClassification;
  status: ValueStatus;
  rejectionReasons: string[];
  historicalSample: number;
  marketSample: number;
  marketWinRate: number | null;
  marketRoi: number | null;
  marketMaxDrawdown: number | null;
  smartConfidenceScore?: number | null;
  smartConfidenceStatus?: string;
  smartConfidenceSampleSize?: number;
  settlementBlockReason?: string;
  probabilitySource: "SELECTION" | "MARKET";
  analyzedAt: string;
}

export interface ValueAudit {
  provider: string;
  analyzed: number;
  rejected: number;
  approved: number;
  watch: number;
  insufficientRealData: number;
  tipsCreated: number;
  rejectionReasons: Record<string, number>;
  generatedAt: string;
}

export interface ValueReport {
  provider: string;
  updatedAt: string;
  gamesLoaded: number;
  opportunities: ValueOpportunity[];
  entries: ValueOpportunity[];
  watchlist: ValueOpportunity[];
  audit: ValueAudit;
  warning?: string;
}
