// Fase 4 — Sprint 4.5 — Historical Prediction Evaluation & Benchmarking Framework.
// Barrel export: fachada pública oficial do módulo. Exporta apenas os
// pontos de composição documentados pela missão desta sprint
// (`buildEvaluationReport` como ponto de entrada principal, mais os
// motores individuais para uso avançado explicitamente previsto —
// `evaluateHistoricalDataset`, `computeSegmentEvaluations`,
// `computeBenchmark(s)`, `compareEvaluations`/`compareMultiple`) e a
// configuração/tipos públicos. Funções auxiliares internas (desempate,
// fórmulas de Brier/Log Loss, agrupamento por chave, arredondamento,
// etc.) nunca são reexportadas — permanecem privadas aos seus arquivos.

export { buildEvaluationReport } from "./EvaluationReport.ts";
export type { EvaluationReportOptions } from "./EvaluationReport.ts";

export { evaluateHistoricalDataset } from "./HistoricalEvaluationEngine.ts";
export type { HistoricalEvaluationResult } from "./HistoricalEvaluationEngine.ts";

export { computeEvaluationMetrics, computeSegmentEvaluations, toOutcomeProbabilityPair } from "./SegmentMetrics.ts";
export type { OutcomeProbabilityPair } from "./SegmentMetrics.ts";

export { computeBenchmark, computeBenchmarks } from "./BenchmarkEngine.ts";

export { compareEvaluations, compareMultiple } from "./ModelComparisonEngine.ts";

export {
  PREDICTION_EVALUATION_MODEL_VERSION,
  DEFAULT_PREDICTION_EVALUATION_CONFIG,
  DEFAULT_CONFIDENCE_BUCKETS,
  validatePredictionEvaluationConfig,
  PredictionEvaluationConfigurationError,
} from "./PredictionEvaluationConfig.ts";
export type { PredictionEvaluationConfig, InvalidRecordPolicy, EmptyDatasetBehavior } from "./PredictionEvaluationConfig.ts";

export { clamp, isFiniteNumber, toPredictionQualityRecord } from "./types.ts";
export type {
  PredictionSnapshot,
  ActualMatchOutcome,
  HistoricalPredictionRecord,
  EvaluationDataset,
  EvaluationDatasetSummary,
  EvaluationSegmentType,
  EvaluationSegment,
  EvaluationStatus,
  EvaluationMetrics,
  SegmentEvaluation,
  BenchmarkType,
  BenchmarkDefinition,
  BenchmarkResult,
  ModelEvaluationResult,
  MetricDirection,
  ComparisonWinner,
  MetricComparisonResult,
  ModelComparison,
  EvaluationWarningCode,
  EvaluationWarning,
  EvaluationRejection,
  EvaluationReport,
  MatchOutcome,
  GreenScoreCategory,
} from "./types.ts";
