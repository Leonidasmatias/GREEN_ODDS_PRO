// Fase 4 — Sprint 4.1 — Prediction Engine Foundation.
// Barrel export: fachada pública do Prediction Engine, no mesmo padrão já
// usado por src/services/observability/index.ts (Fase 3.5). O
// Intelligence Engine (Fase 1.5) não usa barrel — lá cada módulo é
// importado diretamente — porque aqueles são dez módulos majoritariamente
// independentes entre si; aqui, ao contrário, existe um único ponto de
// entrada consumidor-facing (`predictMatchOutcome`), o que torna a fachada
// única mais apropriada, como já ocorre em ObservabilityService.

export { predictMatchOutcome } from "./MatchOutcomeProbabilityEngine.ts";
export { buildPredictionFeatures, orientHeadToHead } from "./PredictionFeatureBuilder.ts";
export { evaluateDataSufficiency } from "./PredictionDataSufficiency.ts";
export { computeOutcomeProbabilities } from "./PredictionNormalizer.ts";
export {
  PREDICTION_MODEL_VERSION,
  DEFAULT_PREDICTION_MODEL_CONFIG,
  DEFAULT_PREDICTION_MODEL_WEIGHTS,
  DEFAULT_DATA_SUFFICIENCY_THRESHOLDS,
  validatePredictionModelConfig,
  PredictionConfigurationError,
} from "./PredictionModelConfig.ts";
export type { PredictionModelConfig, PredictionModelWeights, DataSufficiencyThresholds } from "./PredictionModelConfig.ts";
export type {
  MatchOutcome,
  MatchOutcomePrediction,
  MatchOutcomePredictionRequest,
  PlayerPredictionInputs,
  PredictionFeatureTrace,
  DataSufficiencyResult,
  DataSufficiencyStatus,
  FeatureAvailability,
  FeatureDirection,
} from "./types.ts";
export type { OutcomeLogits, OutcomeProbabilities } from "./PredictionNormalizer.ts";
export type { OrientedHeadToHead } from "./PredictionFeatureBuilder.ts";
