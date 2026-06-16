export type RiskAction = "ALLOW" | "REDUCE_STAKE" | "BLOCK" | "WATCH_ONLY";
export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskEvaluationInput {
  tipId?: string | null;
  matchId: string;
  market: string;
  selection: string;
  competition: string;
  bookmaker: string;
  risk: string;
  confidenceScore: number;
  requestedStake: number;
  discoveryStatus?: string | null;
}

export interface RiskCheckResult {
  action: RiskAction;
  severity: RiskSeverity;
  reason: string;
  reducedStake?: number;
}

export interface RiskShieldReport {
  status: "READY" | "BANKROLL_NOT_CONFIGURED";
  dailyRiskUsed: number;
  openExposure: number;
  risksDetected: number;
  tipsBlocked: number;
  stakesReduced: number;
  marketConcentration: Record<string, number>;
  competitionConcentration: Record<string, number>;
  bookmakerConcentration: Record<string, number>;
  correlationAlerts: number;
  generatedAt: string;
  reason?: string;
}
