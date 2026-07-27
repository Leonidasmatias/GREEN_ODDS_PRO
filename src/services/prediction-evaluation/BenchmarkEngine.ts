// Fase 4 — Sprint 4.5 — Historical Prediction Evaluation & Benchmarking Framework.
// Benchmark Engine: gera probabilidades sintéticas para cinco baselines
// técnicos (distribuição uniforme, classe majoritária, frequência
// histórica, média global observada, baseline constante configurável) e
// calcula as mesmas métricas usadas para o modelo real via
// `computeEvaluationMetrics` (`SegmentMetrics.ts`). Nunca usa odds,
// mercado, retorno financeiro ou estratégia de aposta.
//
// Proteção contra data leakage: `HISTORICAL_FREQUENCY` é o único
// benchmark que depende de ordem — ordena estritamente por
// `sequenceKey` (fornecido pelo chamador; nunca inferido de
// `result.metadata.generatedAt` ou de qualquer campo implícito) e, para
// cada registro, usa apenas as contagens acumuladas de registros com
// `sequenceKey` ESTRITAMENTE anterior. Registros com o mesmo
// `sequenceKey` nunca se enxergam (tratados como contemporâneos, não
// como histórico um do outro) — o critério de desempate documentado para
// a ORDENAÇÃO (não para a regra de "estritamente anterior") é `matchId`
// em ordem alfabética. Se nenhum registro tiver `sequenceKey`, ou se os
// tipos forem incompatíveis entre si (mistura de `string`/`number`), o
// benchmark fica indisponível — nunca inventa uma ordem.
//
// Função pura: nenhum acesso a Prisma, rede, relógio do sistema ou
// número aleatório.

import { PredictionEvaluationConfigurationError } from "./PredictionEvaluationConfig.ts";
import { computeEvaluationMetrics } from "./SegmentMetrics.ts";
import type { OutcomeProbabilityPair } from "./SegmentMetrics.ts";
import type { PredictionEvaluationConfig } from "./PredictionEvaluationConfig.ts";
import {
  isFiniteNumber,
  type BenchmarkDefinition,
  type BenchmarkResult,
  type EvaluationWarning,
  type HistoricalPredictionRecord,
  type MatchOutcome,
} from "./types.ts";

type Probabilities = { homeWin: number; draw: number; awayWin: number };
const UNIFORM_PROBABILITIES: Probabilities = { homeWin: 1 / 3, draw: 1 / 3, awayWin: 1 / 3 };

function outcomeToProbabilities(outcome: MatchOutcome): Probabilities {
  return { homeWin: outcome === "HOME_WIN" ? 1 : 0, draw: outcome === "DRAW" ? 1 : 0, awayWin: outcome === "AWAY_WIN" ? 1 : 0 };
}

/** Mesma regra de desempate determinística do restante do framework:
 * HOME_WIN > DRAW > AWAY_WIN. Usada aqui para decidir a classe
 * majoritária quando duas ou mais classes empatam em frequência. */
function pickMostFrequentOutcome(counts: Record<MatchOutcome, number>): MatchOutcome {
  if (counts.HOME_WIN >= counts.DRAW && counts.HOME_WIN >= counts.AWAY_WIN) return "HOME_WIN";
  if (counts.DRAW >= counts.AWAY_WIN) return "DRAW";
  return "AWAY_WIN";
}

function countOutcomes(records: HistoricalPredictionRecord[]): Record<MatchOutcome, number> {
  const counts: Record<MatchOutcome, number> = { HOME_WIN: 0, DRAW: 0, AWAY_WIN: 0 };
  for (const record of records) counts[record.actual.outcome] += 1;
  return counts;
}

function toEmptyPairs(records: HistoricalPredictionRecord[], probabilitiesFor: (record: HistoricalPredictionRecord) => Probabilities): OutcomeProbabilityPair[] {
  return records.map((record) => ({
    matchId: record.snapshot.matchId,
    probabilities: probabilitiesFor(record),
    confidence: null,
    actualOutcome: record.actual.outcome,
  }));
}

function uniformBenchmark(records: HistoricalPredictionRecord[]): { pairs: OutcomeProbabilityPair[]; warnings: EvaluationWarning[] } {
  return { pairs: toEmptyPairs(records, () => UNIFORM_PROBABILITIES), warnings: [] };
}

/** Classe majoritária calculada IN-SAMPLE (sobre o próprio conjunto
 * avaliado) — uma baseline descritiva estática, convenção padrão em
 * aprendizado de máquina; distinta de `HISTORICAL_FREQUENCY`, a única
 * que exige proteção contra vazamento temporal. */
function majorityClassBenchmark(records: HistoricalPredictionRecord[]): { pairs: OutcomeProbabilityPair[]; warnings: EvaluationWarning[] } {
  const majority = pickMostFrequentOutcome(countOutcomes(records));
  return { pairs: toEmptyPairs(records, () => outcomeToProbabilities(majority)), warnings: [] };
}

/** Distribuição média observada IN-SAMPLE (mesma ressalva de
 * `majorityClassBenchmark`) — as frações reais de HOME_WIN/DRAW/AWAY_WIN
 * no conjunto, aplicadas como previsão constante para cada registro. */
function globalAverageBenchmark(records: HistoricalPredictionRecord[]): { pairs: OutcomeProbabilityPair[]; warnings: EvaluationWarning[] } {
  const counts = countOutcomes(records);
  const total = records.length;
  const probabilities: Probabilities =
    total > 0
      ? { homeWin: counts.HOME_WIN / total, draw: counts.DRAW / total, awayWin: counts.AWAY_WIN / total }
      : UNIFORM_PROBABILITIES;
  return { pairs: toEmptyPairs(records, () => probabilities), warnings: [] };
}

function validateConstantProbabilities(probabilities: Probabilities | null): Probabilities {
  if (!probabilities) {
    throw new PredictionEvaluationConfigurationError("BenchmarkDefinition.constantProbabilities é obrigatório para CONSTANT_BASELINE.");
  }
  const { homeWin, draw, awayWin } = probabilities;
  for (const [name, value] of Object.entries({ homeWin, draw, awayWin })) {
    if (!isFiniteNumber(value) || value < 0 || value > 1) {
      throw new PredictionEvaluationConfigurationError(
        `BenchmarkDefinition.constantProbabilities.${name} deve ser um número finito entre 0 e 1 (recebido: ${String(value)}).`,
      );
    }
  }
  if (Math.abs(homeWin + draw + awayWin - 1) > 1e-6) {
    throw new PredictionEvaluationConfigurationError("BenchmarkDefinition.constantProbabilities deve somar 1.");
  }
  return probabilities;
}

function constantBaselineBenchmark(
  records: HistoricalPredictionRecord[],
  probabilities: Probabilities | null,
): { pairs: OutcomeProbabilityPair[]; warnings: EvaluationWarning[] } {
  const validated = validateConstantProbabilities(probabilities);
  return { pairs: toEmptyPairs(records, () => validated), warnings: [] };
}

type SequenceKeyType = "string" | "number";

function detectSequenceKeyType(records: HistoricalPredictionRecord[]): SequenceKeyType | null {
  let detected: SequenceKeyType | null = null;
  for (const record of records) {
    const key = record.snapshot.sequenceKey;
    if (key === null) continue;
    const type: SequenceKeyType = typeof key === "number" ? "number" : "string";
    if (detected === null) detected = type;
    else if (detected !== type) return null; // mixed types: incomparable
  }
  return detected;
}

function compareSequenceKeys(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

/**
 * Baseline de frequência histórica com proteção estrita contra data
 * leakage. Devolve `pairs` vazio (e um aviso) quando nenhum registro tem
 * `sequenceKey`, ou quando os tipos de `sequenceKey` presentes são
 * incompatíveis entre si.
 */
function historicalFrequencyBenchmark(
  records: HistoricalPredictionRecord[],
): { pairs: OutcomeProbabilityPair[]; warnings: EvaluationWarning[] } {
  const keyType = detectSequenceKeyType(records);
  if (keyType === null) {
    return { pairs: [], warnings: [{ code: "NO_SEQUENCE_KEY_PROVIDED", matchId: null, details: "no usable sequenceKey found across records" }] };
  }

  const ordered = records.filter((record) => record.snapshot.sequenceKey !== null);
  const excludedCount = records.length - ordered.length;
  const warnings: EvaluationWarning[] = [];
  if (excludedCount > 0) {
    warnings.push({ code: "NO_SEQUENCE_KEY_PROVIDED", matchId: null, details: `${excludedCount} record(s) without sequenceKey excluded` });
  }

  const sorted = [...ordered].sort((a, b) => {
    const keyA = a.snapshot.sequenceKey as string | number;
    const keyB = b.snapshot.sequenceKey as string | number;
    const byKey = compareSequenceKeys(keyA, keyB);
    if (byKey !== 0) return byKey;
    return a.snapshot.matchId < b.snapshot.matchId ? -1 : a.snapshot.matchId > b.snapshot.matchId ? 1 : 0;
  });

  const pairs: OutcomeProbabilityPair[] = [];
  const runningCounts: Record<MatchOutcome, number> = { HOME_WIN: 0, DRAW: 0, AWAY_WIN: 0 };
  let runningTotal = 0;
  let index = 0;

  while (index < sorted.length) {
    const currentKey = sorted[index].snapshot.sequenceKey as string | number;
    const chunk: HistoricalPredictionRecord[] = [];
    while (index < sorted.length && compareSequenceKeys(sorted[index].snapshot.sequenceKey as string | number, currentKey) === 0) {
      chunk.push(sorted[index]);
      index += 1;
    }

    const probabilities: Probabilities =
      runningTotal > 0
        ? {
            homeWin: runningCounts.HOME_WIN / runningTotal,
            draw: runningCounts.DRAW / runningTotal,
            awayWin: runningCounts.AWAY_WIN / runningTotal,
          }
        : UNIFORM_PROBABILITIES;

    for (const record of chunk) {
      pairs.push({ matchId: record.snapshot.matchId, probabilities, confidence: null, actualOutcome: record.actual.outcome });
    }

    for (const record of chunk) {
      runningCounts[record.actual.outcome] += 1;
      runningTotal += 1;
    }
  }

  return { pairs, warnings };
}

/**
 * Calcula um benchmark técnico (mesmas métricas usadas para o modelo
 * real). `records` deve conter apenas registros já válidos (saída de
 * `evaluateHistoricalDataset`) — este motor nunca revalida nem
 * recalcula previsões.
 */
export function computeBenchmark(
  definition: BenchmarkDefinition,
  records: HistoricalPredictionRecord[],
  config: PredictionEvaluationConfig,
): BenchmarkResult {
  const { pairs, warnings } =
    definition.type === "UNIFORM"
      ? uniformBenchmark(records)
      : definition.type === "MAJORITY_CLASS"
        ? majorityClassBenchmark(records)
        : definition.type === "GLOBAL_AVERAGE"
          ? globalAverageBenchmark(records)
          : definition.type === "CONSTANT_BASELINE"
            ? constantBaselineBenchmark(records, definition.constantProbabilities)
            : historicalFrequencyBenchmark(records);

  const metrics = computeEvaluationMetrics(pairs);
  const status =
    pairs.length === 0
      ? "EMPTY"
      : pairs.length < config.minRecordsForEvaluation
        ? "INSUFFICIENT_SAMPLE"
        : "OK";

  const allWarnings =
    pairs.length === 0 && warnings.length === 0
      ? [{ code: "BENCHMARK_UNAVAILABLE" as const, matchId: null, details: `benchmark ${definition.type} produced no usable records` }]
      : warnings;

  return { definition, metrics, status, warnings: allWarnings };
}

/** Calcula todos os benchmarks solicitados, na ordem fornecida. */
export function computeBenchmarks(
  definitions: BenchmarkDefinition[],
  records: HistoricalPredictionRecord[],
  config: PredictionEvaluationConfig,
): BenchmarkResult[] {
  return definitions.map((definition) => computeBenchmark(definition, records, config));
}
