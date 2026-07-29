// Sprint 9.0 — Prediction Intelligence Framework.
// Barrel export: fachada pública deste módulo, mesmo padrão já usado por
// `prediction-orchestrator/index.ts` (Sprint 4.3) e `prediction-query/`
// (Sprint 7.4). Consumidores externos (API handlers, UI) importam
// exclusivamente daqui.

export { buildPredictionExplanation } from "./PredictionExplanationEngine.ts";
export { buildPredictionFactors } from "./PredictionFactorsEngine.ts";
export { buildConfidenceBreakdown } from "./ConfidenceBreakdownEngine.ts";
export { buildPredictionReasons } from "./PredictionReasonsEngine.ts";
export { buildRiskIndicators } from "./RiskIndicatorEngine.ts";
export { buildPredictionQualityScore } from "./QualityScoreEngine.ts";
export type {
  PredictionFactor,
  PredictionFactorCode,
  PredictionFactorAvailability,
  ConfidenceBreakdownCategory,
  ConfidenceBreakdownItem,
  PredictionReason,
  PredictionRiskCode,
  PredictionRiskSeverity,
  PredictionRiskIndicator,
  PredictionQualityGrade,
  PredictionQualityScore,
  PredictionExplanationView,
  PredictionSignalFavors,
  PredictionSignalType,
} from "./predictionExplanationTypes.ts";
