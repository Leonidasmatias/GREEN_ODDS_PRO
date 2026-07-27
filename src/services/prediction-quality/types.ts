// Fase 4 — Sprint 4.4 — Prediction Calibration & Quality Framework.
// Tipos compartilhados pelo framework de qualidade. Nenhum tipo aqui
// depende do Prisma Client — o framework inteiro opera sobre registros já
// fornecidos pelo chamador (previsão do Prediction Orchestrator, Sprint
// 4.3, mais o resultado real da partida), nunca lê banco de dados nem
// chama os motores das Sprints 4.1/4.2/4.3 para gerar novas previsões.
// Esta sprint apenas MEDE a qualidade estatística de previsões já
// produzidas — não gera EV, Kelly, stake, ROI, ML ou recomendação.

import type { GreenScoreCategory, MatchOutcome, PredictionResult } from "../prediction-orchestrator/index.ts";

// Reexportado por conveniência: consumidores deste módulo não precisam
// importar diretamente de `../prediction-orchestrator/index.ts` para o
// vocabulário de resultado 1X2, inteiramente reaproveitado (nunca
// redefinido) desta sprint.
export type { MatchOutcome, GreenScoreCategory };

/** Clampa um valor numérico entre min e max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** true somente para números finitos (rejeita NaN, +Infinity, -Infinity e não-números). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Um registro avaliável: a previsão completa já produzida pelo Prediction
 * Orchestrator (Sprint 4.3, reaproveitada sem alteração) mais o resultado
 * real da partida (fornecido pelo chamador — este framework nunca lê
 * banco de dados nem inventa um resultado). `league`/`period` são rótulos
 * opcionais definidos livremente pelo chamador (ex.: `"esoccer-battle-8m"`,
 * `"2026-07"`) — o framework nunca assume uma política própria de
 * agrupamento por data ou competição, apenas agrupa pelo rótulo fornecido.
 */
export type PredictionQualityRecord = {
  matchId: string;
  homePlayerId: string;
  awayPlayerId: string;
  league: string | null;
  period: string | null;
  result: PredictionResult;
  actualOutcome: MatchOutcome;
};

export type MatchOutcomeConfusionMatrix = Record<MatchOutcome, Record<MatchOutcome, number>>;

export type PerClassMetric = {
  outcome: MatchOutcome;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  support: number;
  precision: number;
  recall: number;
};

export type AccuracyMetricsResult = {
  sampleSize: number;
  accuracy: number;
  confusionMatrix: MatchOutcomeConfusionMatrix;
  perClass: PerClassMetric[];
  macroPrecision: number;
  macroRecall: number;
};

export type GroupedMetricResult = {
  key: string;
  value: number;
  sampleSize: number;
};

export type BrierScoreReport = {
  global: number;
  byPlayer: GroupedMetricResult[];
  byLeague: GroupedMetricResult[];
  byPeriod: GroupedMetricResult[];
};

export type CalibrationBucket = {
  bucketStart: number;
  bucketEnd: number;
  sampleSize: number;
  averagePredictedProbability: number;
  observedAccuracy: number;
  calibrationError: number;
};

export type CalibrationCurve = {
  buckets: CalibrationBucket[];
  expectedCalibrationError: number;
};

export type ConfidenceReliabilityBucket = {
  bucketStart: number;
  bucketEnd: number;
  sampleSize: number;
  averageConfidence: number;
  observedAccuracy: number;
};

export type ConfidenceReliabilityResult = {
  buckets: ConfidenceReliabilityBucket[];
  isMonotonic: boolean;
};

export type GreenScoreCalibrationBucket = {
  category: GreenScoreCategory;
  sampleSize: number;
  observedAccuracy: number;
};

export type GreenScoreCalibrationResult = {
  buckets: GreenScoreCalibrationBucket[];
  isMonotonic: boolean;
};

export type PredictionQualityValidationIssue = {
  matchId: string;
  reason: string;
};

export type ValidatedRecords = {
  valid: PredictionQualityRecord[];
  invalid: PredictionQualityValidationIssue[];
};

/**
 * Saída pública do framework de qualidade. `precision`/`recall` vivem
 * dentro de `accuracy` (macro-média por classe) em vez de campos soltos no
 * topo — a mesma convenção de aninhamento já usada por
 * `PredictionResult.quality` (Sprint 4.3) — mas o relatório efetivamente
 * contém os dois, satisfazendo o requisito. `generatedAt` é informativo
 * apenas — nunca influencia nenhum cálculo.
 */
export type PredictionQualityReport = {
  modelVersion: string;
  generatedAt: string;
  sampleSize: number;
  validRecordCount: number;
  invalidRecordCount: number;
  validationIssues: PredictionQualityValidationIssue[];
  accuracy: AccuracyMetricsResult;
  brierScore: BrierScoreReport;
  logLoss: number;
  calibrationCurve: CalibrationCurve;
  confidenceReliability: ConfidenceReliabilityResult;
  greenScoreCalibration: GreenScoreCalibrationResult;
  warnings: string[];
};

/**
 * Agrupa registros por uma chave única derivada de cada registro.
 * `keyOf` retornando `null` exclui o registro do agrupamento (ex.: `league`
 * ausente) — nunca fabrica um rótulo de grupo que o chamador não forneceu.
 */
export function groupRecordsByKey(
  records: PredictionQualityRecord[],
  keyOf: (record: PredictionQualityRecord) => string | null,
): Map<string, PredictionQualityRecord[]> {
  const groups = new Map<string, PredictionQualityRecord[]>();
  for (const record of records) {
    const key = keyOf(record);
    if (key === null) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(record);
    else groups.set(key, [record]);
  }
  return groups;
}

/**
 * Agrupa registros por jogador: cada partida contribui para o grupo do
 * mandante E do visitante (uma partida tem sempre dois jogadores
 * avaliáveis) — por isso um agrupamento dedicado, distinto de
 * `groupRecordsByKey` (que atribui cada registro a no máximo um grupo).
 */
export function groupRecordsByPlayer(records: PredictionQualityRecord[]): Map<string, PredictionQualityRecord[]> {
  const groups = new Map<string, PredictionQualityRecord[]>();
  for (const record of records) {
    for (const playerId of [record.homePlayerId, record.awayPlayerId]) {
      const bucket = groups.get(playerId);
      if (bucket) bucket.push(record);
      else groups.set(playerId, [record]);
    }
  }
  return groups;
}

/** Aplica `compute` a cada grupo e devolve o resultado como um array
 * ordenado por chave (determinístico), no formato `GroupedMetricResult`. */
export function aggregateGroupsToMetric(
  groups: Map<string, PredictionQualityRecord[]>,
  compute: (records: PredictionQualityRecord[]) => number,
): GroupedMetricResult[] {
  return [...groups.entries()]
    .map(([key, records]) => ({ key, value: compute(records), sampleSize: records.length }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
