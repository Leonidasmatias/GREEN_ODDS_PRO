export type AdaptiveStrategyStatus = "READY" | "INSUFFICIENT_REAL_DATA";
export type AdaptiveAdjustmentAction =
  | "INCREASE_WEIGHT"
  | "DECREASE_WEIGHT"
  | "BLOCK_SEGMENT"
  | "RAISE_CONFIDENCE_THRESHOLD"
  | "REDUCE_STAKE"
  | "REINFORCE_RISK_SHIELD"
  | "ALLOW_OBSERVATION";

export type AdaptiveSegmentType =
  | "MARKET"
  | "COMPETITION"
  | "BOOKMAKER"
  | "PROVIDER"
  | "ODD_RANGE"
  | "RISK"
  | "CONFIDENCE"
  | "ML_STATUS"
  | "DISCOVERY_STATUS"
  | "RISK_SHIELD_ACTION"
  | "BANKROLL_STRATEGY";

export interface AdaptiveStrategyAdjustmentResult {
  id?: string;
  ruleId?: string | null;
  segmentType: AdaptiveSegmentType;
  segmentKey: string;
  action: AdaptiveAdjustmentAction;
  weightMultiplier: number;
  confidenceThresholdDelta: number;
  stakeMultiplier: number;
  riskSensitivity: "NORMAL" | "ELEVATED" | "STRICT";
  sampleSize: number;
  roi: number;
  drawdown: number;
  variance: number;
  status: "PENDING" | "APPLIED" | "SKIPPED";
  reason: string;
}

export interface AdaptiveStrategySignal {
  status: AdaptiveStrategyStatus;
  blocked: boolean;
  reason?: string;
  weightMultiplier: number;
  confidenceThresholdDelta: number;
  stakeMultiplier: number;
  riskSensitivity: "NORMAL" | "ELEVATED" | "STRICT";
  actions: AdaptiveAdjustmentAction[];
}

export interface AdaptiveStrategyReport {
  status: AdaptiveStrategyStatus;
  runId: string | null;
  modelVersion: string;
  totalTipsAnalyzed: number;
  minimumSample: number;
  segmentsAnalyzed: number;
  adjustmentsGenerated: number;
  adjustmentsApplied: number;
  blockedSegments: number;
  topAdjustments: AdaptiveStrategyAdjustmentResult[];
  generatedAt: string;
  blockReason?: string;
}
