// Fase 4 — Sprint 4.3 — Prediction Orchestrator.
// Barrel export: fachada pública do Prediction Orchestrator, no mesmo
// padrão já usado por `src/services/prediction/index.ts` (Sprint 4.1) e
// `src/services/goal-distribution/index.ts` (Sprint 4.2). Ao contrário
// dos barrels anteriores, esta sprint exporta **apenas a API pública**
// (`predictMatch`, configuração e tipos) — os módulos internos
// (`PredictionAggregator`, `ConfidenceEngine`, `GreenScoreEngine`,
// `ConsistencyEngine`, `PredictionExplanation`) são importados diretamente
// pelos testes a partir de seus arquivos, não reexportados aqui, por
// instrução explícita desta sprint ("Exportar apenas API pública").

export { predictMatch, computeConfigurationHash } from "./PredictionOrchestrator.ts";
export {
  PREDICTION_ORCHESTRATOR_MODEL_VERSION,
  DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG,
  DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES,
  DEFAULT_CONSISTENCY_THRESHOLDS,
  DEFAULT_CONSISTENCY_ADJUSTMENTS,
  DEFAULT_CONFIDENCE_WEIGHTS,
  DEFAULT_GREEN_SCORE_WEIGHTS,
  DEFAULT_GREEN_SCORE_THRESHOLDS,
  DEFAULT_EXPLANATION_CONFIG,
  validatePredictionOrchestratorConfig,
  PredictionOrchestratorConfigurationError,
} from "./PredictionOrchestratorConfig.ts";
export type {
  PredictionOrchestratorConfig,
  DataSufficiencyStatusScores,
  ConsistencyThresholds,
  ConsistencyAdjustments,
  ConfidenceWeights,
  GreenScoreWeights,
  GreenScoreThresholds,
  PredictionExplanationConfig,
} from "./PredictionOrchestratorConfig.ts";
export type {
  PredictionOrchestratorRequest,
  PredictionResult,
  FinalPrediction,
  ConsistencyLevel,
  ConsistencyAssessment,
  DataQualityAssessment,
  GreenScoreCategory,
  GreenScoreAssessment,
  ModelVersions,
  PredictionSignalType,
  PredictionSignalFavors,
  PredictionSignalSource,
  PredictionSignal,
  PredictionExplanationResult,
  PredictionOrchestratorMetadata,
  MatchOutcome,
  DataSufficiencyStatus,
} from "./types.ts";
