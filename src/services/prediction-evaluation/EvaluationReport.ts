// Fase 4 — Sprint 4.5 — Historical Prediction Evaluation & Benchmarking Framework.
// Módulo principal: orquestra `HistoricalEvaluationEngine` +
// `SegmentMetrics` + `BenchmarkEngine` + `ModelComparisonEngine` em um
// único `EvaluationReport` serializável. Nunca lê `Date.now()`/relógio do
// sistema, gera UUID aleatório ou qualquer valor dependente do ambiente
// — `reportId`/`generatedAt` são sempre fornecidos pelo chamador via
// `EvaluationReportOptions`. Arredondamento (`config.decimalPlaces`) é
// aplicado apenas nesta camada de serialização, nunca durante o cálculo
// interno das métricas.

import { evaluateHistoricalDataset } from "./HistoricalEvaluationEngine.ts";
import { computeSegmentEvaluations } from "./SegmentMetrics.ts";
import { computeBenchmarks } from "./BenchmarkEngine.ts";
import { compareEvaluations } from "./ModelComparisonEngine.ts";
import { validatePredictionEvaluationConfig, type PredictionEvaluationConfig } from "./PredictionEvaluationConfig.ts";
import { isFiniteNumber, type BenchmarkDefinition, type EvaluationDataset, type EvaluationReport } from "./types.ts";

export type EvaluationReportOptions = {
  reportId: string;
  generatedAt?: string | null;
  modelLabel?: string;
  benchmarks?: BenchmarkDefinition[];
};

const DEFAULT_BENCHMARK_DEFINITIONS: BenchmarkDefinition[] = [
  { type: "UNIFORM", constantProbabilities: null },
  { type: "MAJORITY_CLASS", constantProbabilities: null },
  { type: "GLOBAL_AVERAGE", constantProbabilities: null },
];

function benchmarkLabel(definition: BenchmarkDefinition): string {
  return `benchmark:${definition.type}`;
}

function roundNumber(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/** Arredonda recursivamente todo número finito encontrado em `value` para
 * `decimalPlaces` casas decimais — aplicado uma única vez, no final da
 * montagem do relatório, nunca durante o cálculo interno. Números não
 * finitos (não deveriam ocorrer no relatório final, mas por segurança)
 * são preservados sem alteração, nunca silenciosamente zerados. */
function roundDeep<T>(value: T, decimalPlaces: number): T {
  if (typeof value === "number") {
    return (isFiniteNumber(value) ? roundNumber(value, decimalPlaces) : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => roundDeep(item, decimalPlaces)) as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = roundDeep(entryValue, decimalPlaces);
    }
    return result as T;
  }
  return value;
}

/**
 * Monta o relatório final de avaliação. Lança
 * `PredictionEvaluationConfigurationError` para uma configuração
 * inválida (delegado a `validatePredictionEvaluationConfig`); nunca lança
 * por causa da qualidade dos dados — datasets vazios ou inválidos
 * produzem um relatório com `status` apropriado (`EMPTY`/
 * `INSUFFICIENT_SAMPLE`/`REJECTED`), nunca uma exceção.
 */
export function buildEvaluationReport(
  dataset: EvaluationDataset,
  config: PredictionEvaluationConfig,
  options: EvaluationReportOptions,
): EvaluationReport {
  validatePredictionEvaluationConfig(config);

  const evaluation = evaluateHistoricalDataset(dataset, config);
  const segments = computeSegmentEvaluations(evaluation.validRecords, config);

  const benchmarkDefinitions = options.benchmarks ?? DEFAULT_BENCHMARK_DEFINITIONS;
  const benchmarks = computeBenchmarks(benchmarkDefinitions, evaluation.validRecords, config);

  const modelLabel = options.modelLabel ?? "model";
  const modelResult = { label: modelLabel, metrics: evaluation.globalMetrics, status: evaluation.status };
  const comparisons = benchmarks.map((benchmark) =>
    compareEvaluations(modelResult, { label: benchmarkLabel(benchmark.definition), metrics: benchmark.metrics, status: benchmark.status }, config),
  );

  // `config` é deliberadamente excluído do arredondamento: seus valores
  // (ex.: `numericTolerance: 1e-6`) já estão na precisão pretendida pelo
  // chamador e arredondá-los junto com as métricas calculadas poderia
  // corrompê-los silenciosamente (ex.: `1e-6` viraria `0` a 4 casas
  // decimais). Apenas os valores CALCULADOS por este módulo são
  // arredondados.
  const roundedPortion = roundDeep(
    {
      datasetSummary: evaluation.datasetSummary,
      globalMetrics: evaluation.globalMetrics,
      segments,
      benchmarks,
      comparisons,
    },
    config.decimalPlaces,
  );

  return {
    reportId: options.reportId,
    generatedAt: options.generatedAt ?? null,
    modelVersion: config.modelVersion,
    config,
    ...roundedPortion,
    warnings: evaluation.warnings,
    rejectedRecords: evaluation.rejectedRecords,
    status: evaluation.status,
  };
}
