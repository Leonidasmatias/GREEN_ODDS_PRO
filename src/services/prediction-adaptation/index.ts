// Fase 5 — Sprint 5.2 — Adaptive Intelligence & Recommendation Framework.
// Barrel export: fachada pública oficial do módulo. Exporta apenas o
// ponto de entrada principal (`buildAdaptiveReport`, consumindo um
// `LearningReport` da Sprint 5.1 — a única integração cross-sprint deste
// módulo) mais os motores individuais para uso avançado explicitamente
// previsto (`buildRecommendations`, `classifyStrategy`,
// `buildConfidenceAdjustments`, `buildRiskAssessments`) e a
// configuração/tipos públicos. Funções auxiliares internas (agrupamento
// por perfil, arredondamento, escalonamento de risco etc.) nunca são
// reexportadas — permanecem privadas aos seus arquivos.

export { buildAdaptiveReport } from "./AdaptiveReport.ts";

export { buildRecommendations } from "./RecommendationEngine.ts";

export { classifyStrategy } from "./StrategyEngine.ts";

export { buildConfidenceAdjustments } from "./ConfidenceAdjustmentEngine.ts";

export { buildRiskAssessments } from "./RiskAssessmentEngine.ts";

export {
  PREDICTION_ADAPTATION_MODEL_VERSION,
  DEFAULT_PREDICTION_ADAPTATION_CONFIG,
  DEFAULT_CONFIDENCE_MULTIPLIERS,
  DEFAULT_RISK_LEVEL_BY_RECOMMENDATION,
  validatePredictionAdaptationConfig,
  PredictionAdaptationConfigurationError,
} from "./PredictionAdaptationConfig.ts";
export type {
  PredictionAdaptationConfig,
  RecommendationConfidenceMultipliers,
  RecommendationRiskLevels,
} from "./PredictionAdaptationConfig.ts";

export { isFiniteNumber } from "./types.ts";
export type {
  Recommendation,
  RecommendationType,
  StrategyStatus,
  RiskLevel,
  RiskAssessment,
  ConfidenceAdjustment,
  AdaptiveDecision,
  AdaptiveReportOptions,
  AdaptiveReport,
} from "./types.ts";
