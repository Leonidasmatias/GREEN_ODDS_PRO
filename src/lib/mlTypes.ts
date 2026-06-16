export type MlStatus = "READY" | "TRAINED" | "INSUFFICIENT_REAL_DATA" | "FAILED";
export type MlResultStatus = "WON" | "LOST" | "VOID";
export type MlClassification = "NO BET" | "WATCH" | "GREEN FORTE" | "ELITE GREEN" | "DIAMANTE" | "INSUFFICIENT_REAL_DATA";

export interface MlTrainingSample {
  tipId: string;
  matchId: string;
  market: string;
  selection: string;
  competition: string;
  provider: string;
  bookmaker: string;
  odd: number;
  oddRange: string;
  impliedProbability: number;
  result: MlResultStatus;
  profit: number;
  roi: number;
  settledAt: string;
}

export interface MlSampleValidation {
  status: MlStatus;
  totalSamples: number;
  wonSamples: number;
  lostSamples: number;
  voidSamples: number;
  minimumSamples: number;
  marketsCovered: number;
  competitionsCovered: number;
  bookmakersCovered: number;
  blockReason?: string;
}

export interface MlPredictionResult {
  status: MlStatus;
  modelVersion: string | null;
  matchId: string;
  market: string;
  selection: string;
  provider: string;
  bookmaker: string;
  odd: number;
  impliedProbability: number;
  modelProbability: number | null;
  edge: number | null;
  confidenceScore: number;
  classification: MlClassification;
  blockReason?: string;
}

export interface MlModelReport {
  status: MlStatus;
  modelVersion: string | null;
  totalSamples: number;
  minimumSamples: number;
  lastRunAt: string | null;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  roiBacktest: number | null;
  winRateBacktest: number | null;
  predictionsGenerated: number;
  blockReason?: string;
}
