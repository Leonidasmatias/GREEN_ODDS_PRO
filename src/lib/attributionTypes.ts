export type AttributionStatus =
  | "READY"
  | "INSUFFICIENT_REAL_DATA"
  | "POSITIVE_CONTRIBUTOR"
  | "NEGATIVE_CONTRIBUTOR"
  | "DRAWDOWN_ALERT"
  | "MODEL_CALIBRATION_ALERT"
  | "WATCH";

export type AttributionSegmentType =
  | "MARKET"
  | "COMPETITION"
  | "BOOKMAKER"
  | "PROVIDER"
  | "ODD_RANGE"
  | "CLASSIFICATION"
  | "RISK"
  | "CONFIDENCE"
  | "ML_STATUS"
  | "DISCOVERY_STATUS"
  | "RISK_SHIELD_ACTION"
  | "BANKROLL_STRATEGY";

export interface AttributionSegmentResult {
  id?: string;
  segmentType: AttributionSegmentType;
  segmentKey: string;
  market?: string | null;
  competition?: string | null;
  bookmaker?: string | null;
  provider?: string | null;
  oddRange?: string | null;
  classification?: string | null;
  risk?: string | null;
  confidenceRange?: string | null;
  mlStatus?: string | null;
  discoveryStatus?: string | null;
  riskShieldAction?: string | null;
  bankrollStrategy?: string | null;
  totalTips: number;
  wins: number;
  losses: number;
  voids: number;
  winRate: number;
  roi: number;
  profit: number;
  averageOdd: number;
  averageStake: number;
  drawdown: number;
  hitRateByOddRange: number;
  edgeRealizado: number;
  evRealizado: number;
  variance: number;
  sharpeLikeScore: number;
  maxLosingStreak: number;
  maxWinningStreak: number;
  status: AttributionStatus;
}

export interface AttributionInsightResult {
  id?: string;
  insightType: string;
  title: string;
  description: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: AttributionStatus;
  segmentType?: AttributionSegmentType | null;
  segmentKey?: string | null;
  metricValue?: number | null;
}

export interface PerformanceAttributionReport {
  status: "READY" | "INSUFFICIENT_REAL_DATA";
  runId: string | null;
  modelVersion: string;
  totalTipsAnalyzed: number;
  minimumSample: number;
  segmentsAnalyzed: number;
  insightsGenerated: number;
  topPositiveSegments: AttributionSegmentResult[];
  negativeSegments: AttributionSegmentResult[];
  drawdownAlerts: AttributionSegmentResult[];
  calibrationAlerts: AttributionSegmentResult[];
  insights: AttributionInsightResult[];
  generatedAt: string;
  blockReason?: string;
}
