// Fase 4 — Sprint 4.5 — Historical Prediction Evaluation & Benchmarking Framework.
// Historical Evaluation Engine: casa (join) previsões e resultados reais
// por `matchId`, aplica a política de registros inválidos configurada,
// reaproveita `validatePredictionQualityRecords` (Sprint 4.4, nunca
// duplicada) para detectar previsões malformadas, e calcula as métricas
// globais via `computeEvaluationMetrics` (`SegmentMetrics.ts`, desta
// sprint). Nunca recalcula uma previsão — apenas avalia previsões já
// existentes. Função pura: nenhum acesso a Prisma, rede, relógio do
// sistema ou número aleatório; nunca muta `dataset.predictions`/
// `dataset.actuals` nem qualquer objeto neles contido.

import { validatePredictionQualityRecords } from "../prediction-quality/index.ts";
import { computeEvaluationMetrics, toOutcomeProbabilityPair } from "./SegmentMetrics.ts";
import type { PredictionEvaluationConfig } from "./PredictionEvaluationConfig.ts";
import {
  toPredictionQualityRecord,
  type ActualMatchOutcome,
  type EvaluationDataset,
  type EvaluationDatasetSummary,
  type EvaluationMetrics,
  type EvaluationRejection,
  type EvaluationStatus,
  type EvaluationWarning,
  type HistoricalPredictionRecord,
} from "./types.ts";

export type HistoricalEvaluationResult = {
  validRecords: HistoricalPredictionRecord[];
  datasetSummary: EvaluationDatasetSummary;
  globalMetrics: EvaluationMetrics;
  warnings: EvaluationWarning[];
  rejectedRecords: EvaluationRejection[];
  status: EvaluationStatus;
};

const EMPTY_GLOBAL_METRICS: EvaluationMetrics = {
  totalRecords: 0,
  validRecords: 0,
  ignoredRecords: 0,
  correct: 0,
  incorrect: 0,
  accuracy: 0,
  macroPrecision: 0,
  macroRecall: 0,
  brierScore: 0,
  logLoss: 0,
  averageConfidence: 0,
  averagePredictedProbability: 0,
  averageObservedOutcome: 0,
};

/** Deduplica preservando a primeira ocorrência (ordem determinística de
 * entrada); ocorrências subsequentes do mesmo `matchId` são reportadas
 * como duplicatas, nunca silenciosamente sobrescritas. */
function deduplicateByMatchId<T extends { matchId: string }>(
  items: T[],
): { unique: T[]; duplicateMatchIds: string[] } {
  const seen = new Set<string>();
  const unique: T[] = [];
  const duplicateMatchIds: string[] = [];
  for (const item of items) {
    if (seen.has(item.matchId)) {
      duplicateMatchIds.push(item.matchId);
      continue;
    }
    seen.add(item.matchId);
    unique.push(item);
  }
  return { unique, duplicateMatchIds };
}

function buildDuplicateWarnings(matchIds: string[], details: string): EvaluationWarning[] {
  return matchIds.map((matchId) => ({ code: "DUPLICATE_MATCH_ID", matchId, details }));
}

/**
 * Casa previsões e resultados reais, aplica a política de registros
 * inválidos e calcula a avaliação global. Nunca lança exceção por causa
 * da qualidade dos dados — apenas por configuração inválida (delegado a
 * `validatePredictionEvaluationConfig`, chamado pelo `EvaluationReport`).
 */
export function evaluateHistoricalDataset(
  dataset: EvaluationDataset,
  config: PredictionEvaluationConfig,
): HistoricalEvaluationResult {
  const warnings: EvaluationWarning[] = [];
  const rejectedRecords: EvaluationRejection[] = [];

  const predictionsDedup = deduplicateByMatchId(dataset.predictions);
  const actualsDedup = deduplicateByMatchId(dataset.actuals);
  warnings.push(...buildDuplicateWarnings(predictionsDedup.duplicateMatchIds, "duplicate prediction"));
  warnings.push(...buildDuplicateWarnings(actualsDedup.duplicateMatchIds, "duplicate actual result"));
  if (config.invalidRecordPolicy === "collect") {
    for (const matchId of predictionsDedup.duplicateMatchIds) rejectedRecords.push({ matchId, reason: "duplicate_prediction" });
    for (const matchId of actualsDedup.duplicateMatchIds) rejectedRecords.push({ matchId, reason: "duplicate_actual" });
  }

  const actualsByMatchId = new Map<string, ActualMatchOutcome>(actualsDedup.unique.map((actual) => [actual.matchId, actual]));
  const predictionMatchIds = new Set(predictionsDedup.unique.map((snapshot) => snapshot.matchId));

  let matchedRecords = 0;
  const joined: HistoricalPredictionRecord[] = [];

  for (const snapshot of predictionsDedup.unique) {
    const actual = actualsByMatchId.get(snapshot.matchId);
    if (!actual) {
      warnings.push({ code: "PREDICTION_WITHOUT_OUTCOME", matchId: snapshot.matchId, details: null });
      if (config.invalidRecordPolicy === "collect") {
        rejectedRecords.push({ matchId: snapshot.matchId, reason: "prediction_without_outcome" });
      }
      continue;
    }
    matchedRecords += 1;
    joined.push({ snapshot, actual });
  }

  for (const actual of actualsDedup.unique) {
    if (!predictionMatchIds.has(actual.matchId)) {
      warnings.push({ code: "OUTCOME_WITHOUT_PREDICTION", matchId: actual.matchId, details: null });
    }
  }

  const validRecords: HistoricalPredictionRecord[] = [];
  for (const record of joined) {
    const { valid, invalid } = validatePredictionQualityRecords([toPredictionQualityRecord(record)]);
    if (valid.length === 1) {
      validRecords.push(record);
      continue;
    }
    const reason = invalid[0]?.reason ?? "invalid_record";
    warnings.push({ code: "INVALID_RECORD_EXCLUDED", matchId: record.snapshot.matchId, details: reason });
    if (config.invalidRecordPolicy === "collect") {
      rejectedRecords.push({ matchId: record.snapshot.matchId, reason });
    }
  }

  const hasAnyDataIssue =
    predictionsDedup.duplicateMatchIds.length > 0 ||
    actualsDedup.duplicateMatchIds.length > 0 ||
    joined.length !== predictionsDedup.unique.length || // some prediction had no matching actual
    validRecords.length !== joined.length || // some joined pair failed Sprint 4.4 validation
    warnings.some((warning) => warning.code === "OUTCOME_WITHOUT_PREDICTION");

  const totalPredictions = dataset.predictions.length;
  const totalActuals = dataset.actuals.length;
  const isDatasetEmpty = totalPredictions === 0 && totalActuals === 0;

  if (config.invalidRecordPolicy === "reject" && hasAnyDataIssue) {
    return {
      validRecords: [],
      datasetSummary: {
        datasetId: dataset.datasetId,
        totalPredictions,
        totalActuals,
        matchedRecords,
        validRecords: 0,
        ignoredRecords: totalPredictions,
      },
      globalMetrics: { ...EMPTY_GLOBAL_METRICS },
      warnings,
      rejectedRecords,
      status: "REJECTED",
    };
  }

  if (isDatasetEmpty) {
    warnings.push({ code: "EMPTY_DATASET", matchId: null, details: null });
    const emptyStatus: EvaluationStatus = config.emptyDatasetBehavior === "REJECT" ? "REJECTED" : "EMPTY";
    return {
      validRecords: [],
      datasetSummary: {
        datasetId: dataset.datasetId,
        totalPredictions: 0,
        totalActuals: 0,
        matchedRecords: 0,
        validRecords: 0,
        ignoredRecords: 0,
      },
      globalMetrics: { ...EMPTY_GLOBAL_METRICS },
      warnings,
      rejectedRecords,
      status: emptyStatus,
    };
  }

  const rawMetrics = computeEvaluationMetrics(validRecords.map(toOutcomeProbabilityPair));
  const globalMetrics: EvaluationMetrics = {
    ...rawMetrics,
    totalRecords: totalPredictions,
    validRecords: validRecords.length,
    ignoredRecords: totalPredictions - validRecords.length,
  };

  let status: EvaluationStatus;
  if (validRecords.length === 0) {
    status = config.emptyDatasetBehavior === "REJECT" ? "REJECTED" : "EMPTY";
    warnings.push({ code: "EMPTY_DATASET", matchId: null, details: "no valid records after join and validation" });
  } else if (validRecords.length < config.minRecordsForEvaluation) {
    status = "INSUFFICIENT_SAMPLE";
    warnings.push({ code: "INSUFFICIENT_SAMPLE_SIZE", matchId: null, details: `validRecords=${validRecords.length}` });
  } else {
    status = "OK";
  }

  return {
    validRecords,
    datasetSummary: {
      datasetId: dataset.datasetId,
      totalPredictions,
      totalActuals,
      matchedRecords,
      validRecords: validRecords.length,
      ignoredRecords: totalPredictions - validRecords.length,
    },
    globalMetrics,
    warnings,
    rejectedRecords,
    status,
  };
}
