// Fase 4 — Sprint 4.5 — Historical Prediction Evaluation & Benchmarking Framework.
// Segment Metrics: define `computeEvaluationMetrics` — a única
// implementação de acurácia/Brier/Log Loss desta sprint, reutilizada pelo
// HistoricalEvaluationEngine (registros reais), pelo BenchmarkEngine
// (probabilidades sintéticas) e pelas próprias funções de segmentação
// abaixo — e calcula `SegmentEvaluation[]` para os nove segmentos
// suportados pelos contratos existentes (Sprints 4.1/4.3/4.4 + rótulos
// opcionais desta sprint). Funções puras: nenhum acesso a Prisma, rede,
// relógio do sistema ou número aleatório.
//
// Nota de reuso: as fórmulas de Brier Score/Log Loss aqui são a mesma
// definição matemática já usada por `CalibrationEngine.ts` (Sprint 4.4),
// reimplementadas em forma de probabilidades brutas porque benchmarks
// (`BenchmarkEngine.ts`) não possuem um `PredictionResult` completo do
// qual extrair — o mesmo padrão de "reimplementar por incompatibilidade
// de forma, nunca reescrever o motor original" já usado pelo
// `GoalMarketsEngine.ts` (Sprint 4.2) ao não reaproveitar
// `PredictionNormalizer` (Sprint 4.1).

import type {
  EvaluationMetrics,
  EvaluationSegment,
  EvaluationSegmentType,
  EvaluationWarning,
  EvaluationStatus,
  GreenScoreCategory,
  HistoricalPredictionRecord,
  MatchOutcome,
  SegmentEvaluation,
} from "./types.ts";
import { clamp, isFiniteNumber } from "./types.ts";
import type { PredictionEvaluationConfig } from "./PredictionEvaluationConfig.ts";

const OUTCOMES: MatchOutcome[] = ["HOME_WIN", "DRAW", "AWAY_WIN"];
const LOG_LOSS_EPSILON = 1e-15;

/**
 * A unidade de entrada de `computeEvaluationMetrics`: um par
 * probabilidades-previstas + resultado-real, independente de vir de um
 * `PredictionResult` real (Sprint 4.3) ou de um benchmark sintético.
 * `confidence` é `null` para benchmarks (não têm um conceito de
 * confiança real).
 */
export type OutcomeProbabilityPair = {
  matchId: string;
  probabilities: { homeWin: number; draw: number; awayWin: number };
  confidence: number | null;
  actualOutcome: MatchOutcome;
};

/** Mesma regra de desempate determinística já usada pelo Prediction
 * Engine (Sprint 4.1): HOME_WIN > DRAW > AWAY_WIN em caso de empate exato. */
function pickWinner(probabilities: OutcomeProbabilityPair["probabilities"]): MatchOutcome {
  const { homeWin, draw, awayWin } = probabilities;
  if (homeWin >= draw && homeWin >= awayWin) return "HOME_WIN";
  if (draw >= awayWin) return "DRAW";
  return "AWAY_WIN";
}

function brierScoreForPair(pair: OutcomeProbabilityPair): number {
  const predicted: Record<MatchOutcome, number> = {
    HOME_WIN: pair.probabilities.homeWin,
    DRAW: pair.probabilities.draw,
    AWAY_WIN: pair.probabilities.awayWin,
  };
  return OUTCOMES.reduce((sum, outcome) => {
    const actual = outcome === pair.actualOutcome ? 1 : 0;
    const diff = predicted[outcome] - actual;
    return sum + diff * diff;
  }, 0);
}

function logLossForPair(pair: OutcomeProbabilityPair): number {
  const predicted: Record<MatchOutcome, number> = {
    HOME_WIN: pair.probabilities.homeWin,
    DRAW: pair.probabilities.draw,
    AWAY_WIN: pair.probabilities.awayWin,
  };
  const probabilityOfActual = clamp(predicted[pair.actualOutcome], LOG_LOSS_EPSILON, 1 - LOG_LOSS_EPSILON);
  return -Math.log(probabilityOfActual);
}

const EMPTY_METRICS: EvaluationMetrics = {
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

/**
 * Precisão/recall macro (média simples sobre as três classes) a partir da
 * matriz de confusão implícita nos pares — a mesma definição já usada por
 * `AccuracyMetrics.ts` (Sprint 4.4), reimplementada aqui em forma de
 * `OutcomeProbabilityPair` pela mesma razão documentada no cabeçalho
 * deste arquivo (benchmarks não têm um `PredictionResult`). Quando uma
 * classe não foi prevista nem ocorreu (`predictedCount===0` ou
 * `support===0`), sua métrica é `0` — nunca `NaN` — mesma convenção da
 * Sprint 4.4.
 */
function macroPrecisionAndRecall(pairs: OutcomeProbabilityPair[]): { macroPrecision: number; macroRecall: number } {
  const perClass = OUTCOMES.map((outcome) => {
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    for (const pair of pairs) {
      const predicted = pickWinner(pair.probabilities);
      if (pair.actualOutcome === outcome && predicted === outcome) truePositives += 1;
      else if (pair.actualOutcome !== outcome && predicted === outcome) falsePositives += 1;
      else if (pair.actualOutcome === outcome && predicted !== outcome) falseNegatives += 1;
    }
    const support = truePositives + falseNegatives;
    const predictedCount = truePositives + falsePositives;
    return {
      precision: predictedCount > 0 ? truePositives / predictedCount : 0,
      recall: support > 0 ? truePositives / support : 0,
    };
  });
  return {
    macroPrecision: perClass.reduce((sum, metric) => sum + metric.precision, 0) / perClass.length,
    macroRecall: perClass.reduce((sum, metric) => sum + metric.recall, 0) / perClass.length,
  };
}

/**
 * Calcula o pacote completo de métricas para um conjunto de pares já
 * válidos (assume que a validação/filtragem já ocorreu — esta função
 * nunca decide o que é válido). `totalRecords`/`validRecords` são
 * sempre iguais a `pairs.length` e `ignoredRecords` sempre `0` aqui — o
 * `HistoricalEvaluationEngine` sobrescreve esses três campos com as
 * contagens reais do dataset completo (incluindo registros inválidos)
 * quando monta a avaliação global. Devolve `EMPTY_METRICS` (nunca NaN)
 * para uma lista vazia.
 */
export function computeEvaluationMetrics(pairs: OutcomeProbabilityPair[]): EvaluationMetrics {
  const n = pairs.length;
  if (n === 0) return { ...EMPTY_METRICS };

  let correct = 0;
  let brierSum = 0;
  let logLossSum = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;
  let topProbabilitySum = 0;

  for (const pair of pairs) {
    if (pickWinner(pair.probabilities) === pair.actualOutcome) correct += 1;
    brierSum += brierScoreForPair(pair);
    logLossSum += logLossForPair(pair);
    topProbabilitySum += Math.max(pair.probabilities.homeWin, pair.probabilities.draw, pair.probabilities.awayWin);
    if (pair.confidence !== null && isFiniteNumber(pair.confidence)) {
      confidenceSum += pair.confidence;
      confidenceCount += 1;
    }
  }

  const accuracy = correct / n;
  const { macroPrecision, macroRecall } = macroPrecisionAndRecall(pairs);

  return {
    totalRecords: n,
    validRecords: n,
    ignoredRecords: 0,
    correct,
    incorrect: n - correct,
    accuracy,
    macroPrecision,
    macroRecall,
    brierScore: brierSum / n,
    logLoss: logLossSum / n,
    averageConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
    averagePredictedProbability: topProbabilitySum / n,
    averageObservedOutcome: accuracy,
  };
}

/** Converte um registro histórico já casado para o par consumido por
 * `computeEvaluationMetrics`. */
export function toOutcomeProbabilityPair(record: HistoricalPredictionRecord): OutcomeProbabilityPair {
  return {
    matchId: record.snapshot.matchId,
    probabilities: record.snapshot.result.prediction.probabilities,
    confidence: record.snapshot.result.confidence,
    actualOutcome: record.actual.outcome,
  };
}

function statusForSampleSize(sampleSize: number, minRecordsPerSegment: number): EvaluationStatus {
  if (sampleSize === 0) return "EMPTY";
  if (sampleSize < minRecordsPerSegment) return "INSUFFICIENT_SAMPLE";
  return "OK";
}

function buildSegmentEvaluation(
  segment: EvaluationSegment,
  records: HistoricalPredictionRecord[],
  config: PredictionEvaluationConfig,
): SegmentEvaluation {
  const metrics = computeEvaluationMetrics(records.map(toOutcomeProbabilityPair));
  const status = statusForSampleSize(records.length, config.minRecordsPerSegment);
  const warnings: EvaluationWarning[] =
    status === "OK"
      ? []
      : [
          {
            code: "SEGMENT_INSUFFICIENT_SAMPLE",
            matchId: null,
            details: `${segment.type}:${segment.key} sampleSize=${records.length}`,
          },
        ];
  return { segment, metrics, status, warnings };
}

function sortedEntries(groups: Map<string, HistoricalPredictionRecord[]>): [string, HistoricalPredictionRecord[]][] {
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function groupBySingleKey(
  records: HistoricalPredictionRecord[],
  keyOf: (record: HistoricalPredictionRecord) => string | null,
): Map<string, HistoricalPredictionRecord[]> {
  const groups = new Map<string, HistoricalPredictionRecord[]>();
  for (const record of records) {
    const key = keyOf(record);
    if (key === null) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(record);
    else groups.set(key, [record]);
  }
  return groups;
}

function playerSegments(records: HistoricalPredictionRecord[], config: PredictionEvaluationConfig): SegmentEvaluation[] {
  const groups = new Map<string, HistoricalPredictionRecord[]>();
  for (const record of records) {
    for (const playerId of [record.snapshot.homePlayerId, record.snapshot.awayPlayerId]) {
      const bucket = groups.get(playerId);
      if (bucket) bucket.push(record);
      else groups.set(playerId, [record]);
    }
  }
  return sortedEntries(groups).map(([key, group]) => buildSegmentEvaluation({ type: "PLAYER", key }, group, config));
}

function virtualTeamSegments(records: HistoricalPredictionRecord[], config: PredictionEvaluationConfig): SegmentEvaluation[] {
  const groups = new Map<string, HistoricalPredictionRecord[]>();
  for (const record of records) {
    for (const team of [record.snapshot.virtualTeamHome, record.snapshot.virtualTeamAway]) {
      if (team === null) continue;
      const bucket = groups.get(team);
      if (bucket) bucket.push(record);
      else groups.set(team, [record]);
    }
  }
  return sortedEntries(groups).map(([key, group]) => buildSegmentEvaluation({ type: "VIRTUAL_TEAM", key }, group, config));
}

function leagueSegments(records: HistoricalPredictionRecord[], config: PredictionEvaluationConfig): SegmentEvaluation[] {
  const groups = groupBySingleKey(records, (record) => record.snapshot.league);
  return sortedEntries(groups).map(([key, group]) => buildSegmentEvaluation({ type: "LEAGUE", key }, group, config));
}

function periodSegments(records: HistoricalPredictionRecord[], config: PredictionEvaluationConfig): SegmentEvaluation[] {
  const groups = groupBySingleKey(records, (record) => record.snapshot.period);
  return sortedEntries(groups).map(([key, group]) => buildSegmentEvaluation({ type: "PERIOD", key }, group, config));
}

/** "HOME"/"AWAY"/"NEUTRAL" a partir do resultado previsto — o cenário
 * mandante/visitante/neutro pedido pela missão, distinto (mas
 * correlacionado) do segmento `PREDICTED_OUTCOME`, que usa os três
 * rótulos brutos `HOME_WIN`/`DRAW`/`AWAY_WIN`. */
function homeAwayKey(predictedOutcome: MatchOutcome): "HOME" | "AWAY" | "NEUTRAL" {
  if (predictedOutcome === "HOME_WIN") return "HOME";
  if (predictedOutcome === "AWAY_WIN") return "AWAY";
  return "NEUTRAL";
}

const HOME_AWAY_KEYS: ("HOME" | "AWAY" | "NEUTRAL")[] = ["HOME", "AWAY", "NEUTRAL"];

function homeAwaySegments(records: HistoricalPredictionRecord[], config: PredictionEvaluationConfig): SegmentEvaluation[] {
  return HOME_AWAY_KEYS.map((key) => {
    const group = records.filter((record) => homeAwayKey(record.snapshot.result.prediction.predictedOutcome) === key);
    return buildSegmentEvaluation({ type: "HOME_AWAY", key }, group, config);
  });
}

function predictedOutcomeSegments(records: HistoricalPredictionRecord[], config: PredictionEvaluationConfig): SegmentEvaluation[] {
  return OUTCOMES.map((key) => {
    const group = records.filter((record) => record.snapshot.result.prediction.predictedOutcome === key);
    return buildSegmentEvaluation({ type: "PREDICTED_OUTCOME", key }, group, config);
  });
}

const GREEN_SCORE_CATEGORIES: GreenScoreCategory[] = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"];

function greenScoreSegments(records: HistoricalPredictionRecord[], config: PredictionEvaluationConfig): SegmentEvaluation[] {
  return GREEN_SCORE_CATEGORIES.map((key) => {
    const group = records.filter((record) => record.snapshot.result.greenScore.category === key);
    return buildSegmentEvaluation({ type: "GREEN_SCORE", key }, group, config);
  });
}

/** Rótulo da faixa de confiança a partir de `config.confidenceBuckets`
 * (limites estritamente crescentes, validados por
 * `validatePredictionEvaluationConfig`). A última faixa é inclusiva em
 * ambas as extremidades (mesma convenção já usada pelas curvas de
 * calibração da Sprint 4.4). */
function confidenceBucketLabel(confidence: number, boundaries: number[]): string | null {
  if (!isFiniteNumber(confidence)) return null;
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const isLast = i === boundaries.length - 2;
    if (confidence >= start && (isLast ? confidence <= end : confidence < end)) {
      return `${start}-${end}`;
    }
  }
  return null;
}

function confidenceBucketSegments(records: HistoricalPredictionRecord[], config: PredictionEvaluationConfig): SegmentEvaluation[] {
  const groups = groupBySingleKey(records, (record) =>
    confidenceBucketLabel(record.snapshot.result.confidence, config.confidenceBuckets),
  );
  const boundaries = config.confidenceBuckets;
  const labels: string[] = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) labels.push(`${boundaries[i]}-${boundaries[i + 1]}`);
  return labels.map((key) => buildSegmentEvaluation({ type: "CONFIDENCE_BUCKET", key }, groups.get(key) ?? [], config));
}

/** Faixa de gols totais observados: `"0"`, `"1"`, `"2"`, `"3"`, `"4+"` —
 * um esquema fixo, determinístico e PROVISÓRIO; registros sem gols reais
 * (`homeGoals`/`awayGoals` nulos) são excluídos deste segmento, nunca
 * fabricados. */
function observedGoalsBucketLabel(homeGoals: number | null, awayGoals: number | null): string | null {
  if (homeGoals === null || awayGoals === null || !isFiniteNumber(homeGoals) || !isFiniteNumber(awayGoals)) return null;
  const total = homeGoals + awayGoals;
  if (total >= 4) return "4+";
  return String(total);
}

const OBSERVED_GOALS_LABELS = ["0", "1", "2", "3", "4+"];

function observedGoalsBucketSegments(records: HistoricalPredictionRecord[], config: PredictionEvaluationConfig): SegmentEvaluation[] {
  const groups = groupBySingleKey(records, (record) =>
    observedGoalsBucketLabel(record.actual.homeGoals, record.actual.awayGoals),
  );
  return OBSERVED_GOALS_LABELS.filter((label) => groups.has(label)).map((key) =>
    buildSegmentEvaluation({ type: "OBSERVED_GOALS_BUCKET", key }, groups.get(key) ?? [], config),
  );
}

/**
 * Calcula `SegmentEvaluation[]` para todos os segmentos habilitados em
 * `config.enabledSegments`, na ordem fixa dos tipos de segmento e, dentro
 * de cada tipo, em ordem determinística de chave.
 */
export function computeSegmentEvaluations(
  records: HistoricalPredictionRecord[],
  config: PredictionEvaluationConfig,
): SegmentEvaluation[] {
  const builders: Record<EvaluationSegmentType, () => SegmentEvaluation[]> = {
    PLAYER: () => playerSegments(records, config),
    LEAGUE: () => leagueSegments(records, config),
    VIRTUAL_TEAM: () => virtualTeamSegments(records, config),
    HOME_AWAY: () => homeAwaySegments(records, config),
    CONFIDENCE_BUCKET: () => confidenceBucketSegments(records, config),
    GREEN_SCORE: () => greenScoreSegments(records, config),
    PREDICTED_OUTCOME: () => predictedOutcomeSegments(records, config),
    PERIOD: () => periodSegments(records, config),
    OBSERVED_GOALS_BUCKET: () => observedGoalsBucketSegments(records, config),
  };

  const orderedTypes: EvaluationSegmentType[] = [
    "PLAYER",
    "LEAGUE",
    "VIRTUAL_TEAM",
    "HOME_AWAY",
    "CONFIDENCE_BUCKET",
    "GREEN_SCORE",
    "PREDICTED_OUTCOME",
    "PERIOD",
    "OBSERVED_GOALS_BUCKET",
  ];

  const result: SegmentEvaluation[] = [];
  for (const type of orderedTypes) {
    if (!config.enabledSegments.includes(type)) continue;
    result.push(...builders[type]());
  }
  return result;
}
