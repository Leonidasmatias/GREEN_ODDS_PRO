// Fase 5 — Sprint 5.1 — Learning Data Foundation & Drift Detection.
// Barrel export: fachada pública oficial do módulo. Exporta apenas os
// pontos de composição documentados pela missão desta sprint
// (`buildLearningReport` como ponto de entrada principal, mais os
// motores individuais para uso avançado explicitamente previsto —
// `buildHistoricalProfiles`, `compareLearningWindows`, `detectDrift`,
// `buildReliabilityRanking`) e a configuração/tipos públicos. Funções
// auxiliares internas (validação de registro, fatiamento de janela,
// conversão para par de probabilidades, desempate, arredondamento etc.)
// nunca são reexportadas — permanecem privadas aos seus arquivos.

export { buildLearningReport } from "./LearningReport.ts";

export { buildHistoricalProfiles } from "./HistoricalProfileEngine.ts";
export type { HistoricalProfileResult } from "./HistoricalProfileEngine.ts";

export { compareLearningWindows } from "./WindowComparisonEngine.ts";

export { detectDrift } from "./DriftDetectionEngine.ts";

export { buildReliabilityRanking } from "./ReliabilityRankingEngine.ts";

export {
  PREDICTION_LEARNING_MODEL_VERSION,
  DEFAULT_PREDICTION_LEARNING_CONFIG,
  DEFAULT_CONFIDENCE_BUCKETS,
  DEFAULT_RELIABILITY_WEIGHTS,
  validatePredictionLearningConfig,
  PredictionLearningConfigurationError,
} from "./PredictionLearningConfig.ts";
export type { PredictionLearningConfig, InvalidLearningRecordPolicy, ReliabilityWeights } from "./PredictionLearningConfig.ts";

export { clamp, isFiniteNumber, toLearningHistoricalRecord, GLOBAL_PROFILE_KEY } from "./types.ts";
export type {
  LearningHistoricalRecord,
  LearningDataset,
  ProfileDimension,
  ProfileKey,
  ProfileMetrics,
  HistoricalProfile,
  LearningWindowDefinition,
  WindowMetrics,
  LearningMetricDirection,
  MetricDelta,
  WindowComparison,
  DriftSeverity,
  DriftDirection,
  DriftSignalType,
  DriftReason,
  DriftSignal,
  ReliabilityMetricContribution,
  ReliabilityRankingEntry,
  ReliabilityRanking,
  LearningDatasetSummary,
  LearningReportOptions,
  LearningReport,
  LearningWarningCode,
  LearningWarning,
  RejectedLearningRecord,
  LearningStatus,
  MatchOutcome,
  GreenScoreCategory,
} from "./types.ts";
