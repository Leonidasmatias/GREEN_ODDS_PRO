// Sprint 9.1 — Explainability Calibration & Backtest.
// Sprint 9.1.1 — Calibration Data Integrity & Report Hardening.
// Barrel export: fachada pública deste módulo, mesmo padrão já usado por
// `prediction-evaluation/index.ts` (Sprint 4.5) e
// `prediction-explanation/index.ts` (Sprint 9.0).

export { buildCalibrationDataset } from "./CalibrationDataset.ts";
export type { CalibrationDataset, CalibrationRecord, RecordProvenanceTag } from "./CalibrationDataset.ts";

export { computeDatasetProvenance } from "./DatasetProvenance.ts";
export type { DatasetOrigin, DatasetProvenance, DiscardReasonCount } from "./DatasetProvenance.ts";

export { determineRecommendationEligibility, isOperationalEligibility, MIN_SAMPLE_FOR_ELIGIBLE_REVIEW, MIN_SAMPLE_FOR_OBSERVATIONAL_READING } from "./RecommendationEligibility.ts";
export type { RecommendationEligibility } from "./RecommendationEligibility.ts";

export { determineReportStatus } from "./ReportStatus.ts";
export type { ReportStatus } from "./ReportStatus.ts";

export { calibrateQualityGrades, isQualityScaleMonotonic } from "./QualityCalibration.ts";
export type { QualityGradeCalibration } from "./QualityCalibration.ts";

export { calibrateRiskIndicators } from "./RiskCalibration.ts";
export type { RiskCodeCalibration } from "./RiskCalibration.ts";

export { analyzeCalibration } from "./CalibrationAnalyzer.ts";
export type { CalibrationAnalysis, FactorImportance } from "./CalibrationAnalyzer.ts";

export { optimizeThreshold } from "./ThresholdOptimizer.ts";
export type { ThresholdOptimizationOutcome, ThresholdRecommendation, ThresholdSample } from "./ThresholdOptimizer.ts";

export { runBacktest } from "./BacktestRunner.ts";
export type { BacktestResult, CalibratableThresholds, EligibleThresholdRecommendation } from "./BacktestRunner.ts";

export { buildCalibrationReportMarkdown } from "./CalibrationReport.ts";
export type { CalibrationReportOptions } from "./CalibrationReport.ts";
