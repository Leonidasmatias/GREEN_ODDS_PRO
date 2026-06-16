export type DataQualitySeverity = "INFO" | "WARNING" | "CRITICAL";
export type DataQualityClassification = "EXCELLENT" | "GOOD" | "WARNING" | "CRITICAL";

export interface DataQualityFinding {
  type: string;
  severity: DataQualitySeverity;
  entity: string;
  entityId?: string | null;
  message: string;
  scoreImpact: number;
  metadata?: Record<string, unknown>;
}

export interface DataQualityReport {
  status: "READY";
  runId: string | null;
  score: number;
  classification: DataQualityClassification;
  checksRun: number;
  alertsFound: number;
  criticalCount: number;
  warningCount: number;
  findings: DataQualityFinding[];
  generatedAt: string;
  note: string;
}
