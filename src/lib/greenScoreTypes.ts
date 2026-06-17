import type { ValueOpportunity } from "./valueTypes";

export type GreenClassification = "ELITE_GREEN" | "STRONG_GREEN" | "GREEN" | "WATCHLIST" | "AVOID";
export type GreenRisk = "LOW" | "MEDIUM" | "HIGH" | "UNDEFINED";

export interface GreenScoreOpportunity {
  id: string;
  value: ValueOpportunity;
  greenScore: number;
  confidence: number;
  risk: GreenRisk;
  classification: GreenClassification;
  qualifiesOddsOfDay: boolean;
  reasons: string[];
  engineStatus: {
    value: string;
    confidence: string;
    ml: string;
    discovery: string;
    riskShield: string;
  };
  analyzedAt: string;
}

export interface GreenScoreAudit {
  provider: string;
  analyzed: number;
  oddsOfDay: number;
  elite: number;
  strong: number;
  green: number;
  watchlist: number;
  avoid: number;
  rejected: number;
  rejectionReasons: Record<string, number>;
  persistence: {
    attempted: number;
    persisted: number;
    skipped: number;
    status: "READY" | "EMPTY" | "UNAVAILABLE";
    reason?: string;
  };
  sourceIntegrity: {
    onlyRealProvider: boolean;
    mockProviders: number;
    mockEvents: number;
    syntheticRows: number;
    status: "REAL_ONLY" | "BLOCKED";
  };
  generatedAt: string;
}

export interface GreenScoreReport {
  provider: string;
  updatedAt: string;
  gamesLoaded: number;
  opportunities: GreenScoreOpportunity[];
  radar: GreenScoreOpportunity[];
  oddsOfDay: GreenScoreOpportunity[];
  watchlist: GreenScoreOpportunity[];
  audit: GreenScoreAudit;
  warning?: string;
}
