export type DiscoveryStatus = "INSUFFICIENT_REAL_DATA" | "AVOID_OR_WATCH" | "WATCH" | "PROMISING" | "STRONG_PATTERN" | "ELITE_PATTERN";
export type DiscoveryPatternType = "MARKET" | "COMPETITION" | "BOOKMAKER" | "ODD_RANGE" | "NEGATIVE";
export type DiscoveryRecommendationType = "PRIORITIZE_MARKET" | "REDUCE_EXPOSURE" | "BLOCK_MARKET" | "WATCH_MARKET" | "RELEASE_FOR_RANKING";

export interface DiscoveryPatternResult {
  id?: string;
  patternType: DiscoveryPatternType;
  market?: string | null;
  competition?: string | null;
  bookmaker?: string | null;
  provider?: string | null;
  oddRange?: string | null;
  sampleSize: number;
  winRate: number;
  roi: number;
  profit: number;
  drawdown: number;
  confidenceScore: number;
  mlScore: number;
  status: DiscoveryStatus;
}

export interface DiscoveryRecommendationResult {
  id?: string;
  patternId?: string | null;
  title: string;
  description: string;
  recommendationType: DiscoveryRecommendationType;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: DiscoveryStatus;
  reason: string;
}

export interface AutoDiscoveryReport {
  status: "READY" | "INSUFFICIENT_REAL_DATA";
  runId: string | null;
  modelVersion: string;
  totalTipsAnalyzed: number;
  minimumSample: number;
  patternsFound: number;
  recommendationsGenerated: number;
  positivePatterns: DiscoveryPatternResult[];
  negativePatterns: DiscoveryPatternResult[];
  recommendations: DiscoveryRecommendationResult[];
  generatedAt: string;
  blockReason?: string;
}
