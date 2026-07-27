// Fase 5 — Sprint 5.1 — Learning Data Foundation & Drift Detection.
// Window Comparison Engine: fatia um conjunto de registros já válidos em
// duas janelas históricas por `sequenceKey` (fornecido pelo chamador,
// nunca posição de array ou data corrente) e compara suas métricas
// agregadas — reaproveitando `computeEvaluationMetrics` (Sprint 4.5).
// Não aceita mistura de tipos de `sequenceKey` dentro da mesma
// comparação. Função pura: nenhum acesso a Prisma, rede, relógio do
// sistema ou número aleatório.

import { computeEvaluationMetrics } from "../prediction-evaluation/index.ts";
import { detectSequenceKeyType, toEvaluationPair } from "./HistoricalProfileEngine.ts";
import type { PredictionLearningConfig } from "./PredictionLearningConfig.ts";
import {
  isFiniteNumber,
  worseLearningStatus,
  type LearningHistoricalRecord,
  type LearningMetricDirection,
  type LearningStatus,
  type LearningWarning,
  type LearningWindowDefinition,
  type MetricDelta,
  type WindowComparison,
  type WindowMetrics,
} from "./types.ts";

function withinBounds(key: string | number, from: string | number | null, to: string | number | null): boolean {
  if (from !== null) {
    if (typeof key === "number" && typeof from === "number" ? key < from : String(key) < String(from)) return false;
  }
  if (to !== null) {
    if (typeof key === "number" && typeof to === "number" ? key > to : String(key) > String(to)) return false;
  }
  return true;
}

export type WindowSliceResult = { records: LearningHistoricalRecord[]; warnings: LearningWarning[] };

/**
 * Fatia `records` (já válidos) segundo `definition` — inclusivo em ambas
 * as extremidades. Registros sem `sequenceKey` nunca são incluídos (não
 * podem ser posicionados). Quando os tipos de `sequenceKey` presentes no
 * conjunto completo são incompatíveis entre si, a fatia é sempre vazia,
 * com um aviso — nunca uma ordem inventada.
 */
export function sliceBySequenceWindow(records: LearningHistoricalRecord[], definition: LearningWindowDefinition): WindowSliceResult {
  const keyType = detectSequenceKeyType(records);
  if (keyType === null) {
    const hasAnySequenceKey = records.some((record) => record.sequenceKey !== null);
    if (!hasAnySequenceKey) {
      return { records: [], warnings: [{ code: "NO_SEQUENCE_KEY_PROVIDED", dimension: null, key: null, details: "no usable sequenceKey found across records" }] };
    }
    return { records: [], warnings: [{ code: "MIXED_SEQUENCE_KEY_TYPES", dimension: null, key: null, details: "mixed sequenceKey types across records" }] };
  }

  const sliced = records.filter(
    (record) => record.sequenceKey !== null && withinBounds(record.sequenceKey, definition.fromSequenceKey, definition.toSequenceKey),
  );
  return { records: sliced, warnings: [] };
}

function statusForSampleSize(sampleSize: number, minimumRecords: number): LearningStatus {
  if (sampleSize === 0) return "EMPTY";
  if (sampleSize < minimumRecords) return "INSUFFICIENT_SAMPLE";
  return "OK";
}

function buildWindowMetrics(definition: LearningWindowDefinition, slice: WindowSliceResult, config: PredictionLearningConfig): WindowMetrics {
  const metrics = computeEvaluationMetrics(slice.records.map(toEvaluationPair));
  const status = statusForSampleSize(slice.records.length, config.minimumRecordsPerWindow);
  const warnings = [...slice.warnings];
  if (status !== "OK" && slice.warnings.length === 0) {
    warnings.push({ code: "WINDOW_EMPTY", dimension: null, key: null, details: `${definition.label} sampleSize=${slice.records.length}` });
  }
  return { definition, totalRecords: slice.records.length, validRecords: slice.records.length, status, metrics, warnings };
}

type DeltaMetricKey = "accuracy" | "macroPrecision" | "macroRecall" | "brierScore" | "logLoss" | "averageConfidence";

const DELTA_METRIC_DIRECTIONS: Record<DeltaMetricKey, LearningMetricDirection> = {
  accuracy: "HIGHER_IS_BETTER",
  macroPrecision: "HIGHER_IS_BETTER",
  macroRecall: "HIGHER_IS_BETTER",
  brierScore: "LOWER_IS_BETTER",
  logLoss: "LOWER_IS_BETTER",
  averageConfidence: "INFORMATIVE",
};

const DELTA_METRICS: DeltaMetricKey[] = ["accuracy", "macroPrecision", "macroRecall", "brierScore", "logLoss", "averageConfidence"];

function computeDelta(metricName: DeltaMetricKey, baseline: WindowMetrics, current: WindowMetrics, tolerance: number): MetricDelta {
  const hasData = baseline.status !== "EMPTY" && current.status !== "EMPTY";
  const baselineValue = hasData && isFiniteNumber(baseline.metrics[metricName]) ? baseline.metrics[metricName] : null;
  const currentValue = hasData && isFiniteNumber(current.metrics[metricName]) ? current.metrics[metricName] : null;
  const absoluteDelta = baselineValue !== null && currentValue !== null ? currentValue - baselineValue : null;
  const relativeDelta =
    absoluteDelta !== null && baselineValue !== null && Math.abs(baselineValue) > tolerance ? (absoluteDelta / baselineValue) * 100 : null;

  return {
    metricName,
    direction: DELTA_METRIC_DIRECTIONS[metricName],
    baselineValue,
    currentValue,
    absoluteDelta,
    relativeDelta,
  };
}

/**
 * Compara duas janelas a partir de fatias (`WindowSliceResult`) já
 * calculadas — evita refatiar os mesmos registros quando o chamador
 * (`LearningReport`) já precisou da fatia para outro propósito (ex.:
 * construir perfis por janela). `compareLearningWindows` é a variante
 * pública que fatia internamente a partir de registros brutos.
 */
export function compareWindowSlices(
  baselineDefinition: LearningWindowDefinition,
  baselineSlice: WindowSliceResult,
  currentDefinition: LearningWindowDefinition,
  currentSlice: WindowSliceResult,
  config: PredictionLearningConfig,
): WindowComparison {
  const baseline = buildWindowMetrics(baselineDefinition, baselineSlice, config);
  const current = buildWindowMetrics(currentDefinition, currentSlice, config);

  const deltas = DELTA_METRICS.map((metricName) => computeDelta(metricName, baseline, current, config.numericTolerance));

  return { baseline, current, deltas, status: worseLearningStatus(baseline.status, current.status) };
}

/**
 * Compara duas janelas históricas (definidas exclusivamente por
 * `sequenceKey`) sobre o mesmo conjunto de registros já válidos. Nunca
 * lança exceção por causa da qualidade dos dados — janelas vazias ou com
 * amostra insuficiente produzem `status` apropriado, nunca uma exceção.
 */
export function compareLearningWindows(
  records: LearningHistoricalRecord[],
  baselineDefinition: LearningWindowDefinition,
  currentDefinition: LearningWindowDefinition,
  config: PredictionLearningConfig,
): WindowComparison {
  const baselineSlice = sliceBySequenceWindow(records, baselineDefinition);
  const currentSlice = sliceBySequenceWindow(records, currentDefinition);
  return compareWindowSlices(baselineDefinition, baselineSlice, currentDefinition, currentSlice, config);
}
