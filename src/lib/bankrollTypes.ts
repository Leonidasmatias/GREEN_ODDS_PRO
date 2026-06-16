export type BankrollStatus = "READY" | "BANKROLL_NOT_CONFIGURED" | "BLOCKED" | "CONSERVATIVE_ONLY";
export type BankrollRiskProfile = "CONSERVADOR" | "MODERADO" | "AGRESSIVO";
export type StakeStrategy = "NO_STAKE" | "FLAT_CONSERVATIVE" | "FLAT_MODERATE" | "FLAT_AGGRESSIVE" | "KELLY_QUARTER" | "KELLY_HALF" | "KELLY_CAPPED";

export interface BankrollExposure {
  openExposure: number;
  openExposurePercent: number;
  dailyRiskUsed: number;
  dailyRiskUsedPercent: number;
  marketExposure: Record<string, number>;
  competitionExposure: Record<string, number>;
  bookmakerExposure: Record<string, number>;
}

export interface StakeRecommendationInput {
  tipId?: string | null;
  matchId: string;
  market: string;
  selection: string;
  competition?: string | null;
  bookmaker: string;
  odd: number;
  confidenceScore: number;
  modelProbability?: number | null;
  impliedProbability: number;
  edge?: number | null;
  expectedValue?: number | null;
  risk: string;
  drawdown?: number | null;
  discoveryStatus?: string | null;
}

export interface StakeRecommendationResult {
  status: BankrollStatus;
  recommendedStake: number;
  stakePercent: number;
  strategy: StakeStrategy;
  reason: string;
}

export interface BankrollReport {
  status: BankrollStatus;
  profileName: string | null;
  currency: string | null;
  currentBankroll: number | null;
  riskProfile: string | null;
  dailyRiskUsed: number;
  dailyRiskUsedPercent: number;
  openExposure: number;
  openExposurePercent: number;
  recommendationsGenerated: number;
  blockedRecommendations: number;
  generatedAt: string;
  reason?: string;
}
