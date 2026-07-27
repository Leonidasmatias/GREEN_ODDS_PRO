// Fase 4 — Sprint 4.4 — Prediction Calibration & Quality Framework.
// Calibration Engine: Brier Score (global e agrupado por jogador/liga/
// período), Log Loss e a curva de calibração clássica (probabilidade
// prevista vs acerto observado, em faixas de 0–100%). Funções puras:
// nenhum acesso a Prisma, rede, relógio do sistema ou número aleatório.

import {
  aggregateGroupsToMetric,
  clamp,
  groupRecordsByKey,
  groupRecordsByPlayer,
  type BrierScoreReport,
  type CalibrationBucket,
  type CalibrationCurve,
  type MatchOutcome,
  type PredictionQualityRecord,
} from "./types.ts";

const OUTCOMES: MatchOutcome[] = ["HOME_WIN", "DRAW", "AWAY_WIN"];

/** Evita `ln(0) = -Infinity`: a mesma prática padrão de clampar
 * probabilidades para um epsilon antes do logaritmo, sem alterar o
 * significado da métrica para probabilidades normais. */
const LOG_LOSS_EPSILON = 1e-15;

/**
 * Brier Score multi-classe de UM registro:
 * `Σ_c (p[c] - o[c])²`, onde `o` é o vetor one-hot do resultado real.
 * Intervalo `[0, 2]` — `0` é uma previsão perfeita.
 */
function brierScoreForRecord(record: PredictionQualityRecord): number {
  const { homeWin, draw, awayWin } = record.result.prediction.probabilities;
  const predicted: Record<MatchOutcome, number> = { HOME_WIN: homeWin, DRAW: draw, AWAY_WIN: awayWin };

  return OUTCOMES.reduce((sum, outcome) => {
    const actual = outcome === record.actualOutcome ? 1 : 0;
    const diff = predicted[outcome] - actual;
    return sum + diff * diff;
  }, 0);
}

/** Brier Score global (média sobre os registros). `0` para lista vazia —
 * amostra insuficiente é responsabilidade do relatório final. */
export function computeBrierScore(records: PredictionQualityRecord[]): number {
  if (records.length === 0) return 0;
  return records.reduce((sum, record) => sum + brierScoreForRecord(record), 0) / records.length;
}

/** Log Loss (entropia cruzada multi-classe) de UM registro:
 * `-ln(p[actual])`, com `p[actual]` clampado para `[epsilon, 1-epsilon]`. */
function logLossForRecord(record: PredictionQualityRecord): number {
  const { homeWin, draw, awayWin } = record.result.prediction.probabilities;
  const predicted: Record<MatchOutcome, number> = { HOME_WIN: homeWin, DRAW: draw, AWAY_WIN: awayWin };
  const probabilityOfActual = clamp(predicted[record.actualOutcome], LOG_LOSS_EPSILON, 1 - LOG_LOSS_EPSILON);
  return -Math.log(probabilityOfActual);
}

/** Log Loss global (média sobre os registros). `0` para lista vazia. */
export function computeLogLoss(records: PredictionQualityRecord[]): number {
  if (records.length === 0) return 0;
  return records.reduce((sum, record) => sum + logLossForRecord(record), 0) / records.length;
}

/**
 * Brier Score global e agrupado por jogador (mandante e visitante),
 * liga e período — `league`/`period` ausentes (`null`) são simplesmente
 * excluídos do respectivo agrupamento, nunca fabricados.
 */
export function computeBrierScoreReport(records: PredictionQualityRecord[]): BrierScoreReport {
  return {
    global: computeBrierScore(records),
    byPlayer: aggregateGroupsToMetric(groupRecordsByPlayer(records), computeBrierScore),
    byLeague: aggregateGroupsToMetric(groupRecordsByKey(records, (record) => record.league), computeBrierScore),
    byPeriod: aggregateGroupsToMetric(groupRecordsByKey(records, (record) => record.period), computeBrierScore),
  };
}

/**
 * Curva de calibração clássica: agrupa os registros em `bucketCount`
 * faixas igualmente espaçadas de `topProbability` (a probabilidade que o
 * Prediction Engine atribuiu ao resultado que efetivamente previu —
 * reaproveitada da Sprint 4.1, nunca recalculada) e compara, em cada
 * faixa, a probabilidade média prevista contra a taxa de acerto
 * observada. `expectedCalibrationError` é a média ponderada (pelo
 * tamanho de cada faixa) do erro de calibração — a métrica ECE padrão.
 * Faixas vazias reportam `0` em vez de `NaN`.
 */
export function computeCalibrationCurve(records: PredictionQualityRecord[], bucketCount: number): CalibrationCurve {
  const buckets: CalibrationBucket[] = [];

  for (let i = 0; i < bucketCount; i += 1) {
    const bucketStart = i / bucketCount;
    const bucketEnd = (i + 1) / bucketCount;
    const isLastBucket = i === bucketCount - 1;

    const inBucket = records.filter((record) => {
      const p = record.result.prediction.topProbability;
      return p >= bucketStart && (isLastBucket ? p <= bucketEnd : p < bucketEnd);
    });

    const sampleSize = inBucket.length;
    const averagePredictedProbability =
      sampleSize > 0 ? inBucket.reduce((sum, record) => sum + record.result.prediction.topProbability, 0) / sampleSize : 0;
    const observedAccuracy =
      sampleSize > 0
        ? inBucket.filter((record) => record.result.prediction.predictedOutcome === record.actualOutcome).length / sampleSize
        : 0;

    buckets.push({
      bucketStart,
      bucketEnd,
      sampleSize,
      averagePredictedProbability,
      observedAccuracy,
      calibrationError: Math.abs(observedAccuracy - averagePredictedProbability),
    });
  }

  const totalSampleSize = records.length;
  const expectedCalibrationError =
    totalSampleSize > 0
      ? buckets.reduce((sum, bucket) => sum + (bucket.sampleSize / totalSampleSize) * bucket.calibrationError, 0)
      : 0;

  return { buckets, expectedCalibrationError };
}
