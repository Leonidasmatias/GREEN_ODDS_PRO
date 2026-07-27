// Fase 4 — Sprint 4.4 — Prediction Calibration & Quality Framework.
// Barrel export: fachada pública do framework de qualidade, no mesmo
// padrão já usado por `src/services/prediction/index.ts` (Sprint 4.1) e
// `src/services/goal-distribution/index.ts` (Sprint 4.2) — ponto de
// entrada principal (`buildPredictionQualityReport`) mais os módulos
// internos exportados para composição avançada e teste.

export { buildPredictionQualityReport } from "./PredictionQualityReport.ts";
export { validatePredictionQualityRecords } from "./PredictionValidator.ts";
export { computeAccuracyMetrics } from "./AccuracyMetrics.ts";
export { computeBrierScore, computeBrierScoreReport, computeLogLoss, computeCalibrationCurve } from "./CalibrationEngine.ts";
export { computeConfidenceReliability, computeGreenScoreCalibration } from "./ConfidenceCalibration.ts";
export {
  PREDICTION_QUALITY_MODEL_VERSION,
  DEFAULT_PREDICTION_QUALITY_CONFIG,
  validatePredictionQualityConfig,
  PredictionQualityConfigurationError,
} from "./PredictionQualityConfig.ts";
export type { PredictionQualityConfig } from "./PredictionQualityConfig.ts";
export {
  clamp,
  isFiniteNumber,
  groupRecordsByKey,
  groupRecordsByPlayer,
  aggregateGroupsToMetric,
} from "./types.ts";
export type {
  PredictionQualityRecord,
  MatchOutcomeConfusionMatrix,
  PerClassMetric,
  AccuracyMetricsResult,
  GroupedMetricResult,
  BrierScoreReport,
  CalibrationBucket,
  CalibrationCurve,
  ConfidenceReliabilityBucket,
  ConfidenceReliabilityResult,
  GreenScoreCalibrationBucket,
  GreenScoreCalibrationResult,
  PredictionQualityValidationIssue,
  ValidatedRecords,
  PredictionQualityReport,
  MatchOutcome,
  GreenScoreCategory,
} from "./types.ts";
