// Fase 4 — Sprint 4.5 — Historical Prediction Evaluation & Benchmarking Framework.
// Model Comparison Engine: compara dois resultados de avaliação já
// calculados (modelo real vs benchmark, configuração A vs B, versão A vs
// B, dataset completo vs segmento) nas cinco métricas obrigatórias,
// respeitando a direção de cada uma (`accuracy`/`macroPrecision`/
// `macroRecall`: maior é melhor; `brierScore`/`logLoss`: menor é melhor).
// Nunca declara superioridade quando a amostra de qualquer um dos lados é
// insuficiente, e nunca produz linguagem financeira. Função pura: nenhum
// acesso a Prisma, rede, relógio do sistema ou número aleatório.

import { isFiniteNumber } from "./types.ts";
import type { PredictionEvaluationConfig } from "./PredictionEvaluationConfig.ts";
import type {
  ComparisonWinner,
  EvaluationMetrics,
  EvaluationStatus,
  MetricComparisonResult,
  MetricDirection,
  ModelComparison,
  ModelEvaluationResult,
} from "./types.ts";

type ComparedMetricKey = "accuracy" | "macroPrecision" | "macroRecall" | "brierScore" | "logLoss";

const METRIC_DIRECTIONS: Record<ComparedMetricKey, MetricDirection> = {
  accuracy: "HIGHER_IS_BETTER",
  macroPrecision: "HIGHER_IS_BETTER",
  macroRecall: "HIGHER_IS_BETTER",
  brierScore: "LOWER_IS_BETTER",
  logLoss: "LOWER_IS_BETTER",
};

const COMPARED_METRICS: ComparedMetricKey[] = ["accuracy", "macroPrecision", "macroRecall", "brierScore", "logLoss"];

const STATUS_RANK: Record<EvaluationStatus, number> = {
  REJECTED: 0,
  EMPTY: 1,
  INSUFFICIENT_SAMPLE: 2,
  OK: 3,
};

function worseStatus(a: EvaluationStatus, b: EvaluationStatus): EvaluationStatus {
  return STATUS_RANK[a] <= STATUS_RANK[b] ? a : b;
}

function metricValue(metrics: EvaluationMetrics, key: ComparedMetricKey, hasData: boolean): number | null {
  if (!hasData) return null;
  const value = metrics[key];
  return isFiniteNumber(value) ? value : null;
}

function compareMetric(
  metricName: ComparedMetricKey,
  valueA: number | null,
  valueB: number | null,
  sampleSufficient: boolean,
  tolerance: number,
): MetricComparisonResult {
  const direction = METRIC_DIRECTIONS[metricName];
  const absoluteDifference = valueA !== null && valueB !== null ? valueB - valueA : null;
  const percentageDifference =
    absoluteDifference !== null && valueA !== null && Math.abs(valueA) > tolerance ? (absoluteDifference / valueA) * 100 : null;

  let winner: ComparisonWinner;
  if (!sampleSufficient || valueA === null || valueB === null) {
    winner = "UNAVAILABLE";
  } else if (Math.abs(valueB - valueA) <= tolerance) {
    winner = "TIE";
  } else if (direction === "HIGHER_IS_BETTER") {
    winner = valueB > valueA ? "B" : "A";
  } else {
    winner = valueB < valueA ? "B" : "A";
  }

  return { metricName, direction, valueA, valueB, absoluteDifference, percentageDifference, winner };
}

/**
 * Compara dois resultados de avaliação já calculados (nunca recalcula
 * nada). `hasData` para cada lado é `status !== "EMPTY"` — um lado vazio
 * torna todas as suas métricas indisponíveis (`null`), nunca `0`
 * fabricado. Amostra insuficiente em qualquer um dos lados
 * (`status !== "OK"`) força `winner: "UNAVAILABLE"` em todas as métricas,
 * mesmo quando os valores brutos estão disponíveis para inspeção.
 */
export function compareEvaluations(
  resultA: ModelEvaluationResult,
  resultB: ModelEvaluationResult,
  config: PredictionEvaluationConfig,
): ModelComparison {
  const hasDataA = resultA.status !== "EMPTY" && resultA.status !== "REJECTED";
  const hasDataB = resultB.status !== "EMPTY" && resultB.status !== "REJECTED";
  const sampleSufficient = resultA.status === "OK" && resultB.status === "OK";

  const comparisons = COMPARED_METRICS.map((metricName) =>
    compareMetric(
      metricName,
      metricValue(resultA.metrics, metricName, hasDataA),
      metricValue(resultB.metrics, metricName, hasDataB),
      sampleSufficient,
      config.numericTolerance,
    ),
  );

  return {
    labelA: resultA.label,
    labelB: resultB.label,
    sampleSizeA: resultA.metrics.validRecords,
    sampleSizeB: resultB.metrics.validRecords,
    comparisons,
    overallStatus: worseStatus(resultA.status, resultB.status),
  };
}

/** Compara múltiplos pares (ex.: modelo real vs cada benchmark) na ordem
 * fornecida. */
export function compareMultiple(
  pairs: [ModelEvaluationResult, ModelEvaluationResult][],
  config: PredictionEvaluationConfig,
): ModelComparison[] {
  return pairs.map(([a, b]) => compareEvaluations(a, b, config));
}
