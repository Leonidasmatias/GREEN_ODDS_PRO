// Fase 4 — Sprint 4.5 — Historical Prediction Evaluation & Benchmarking Framework.
// Tipos compartilhados. Nenhum tipo aqui depende do Prisma Client — o
// framework inteiro opera sobre previsões e resultados reais já
// fornecidos pelo chamador, nunca lê banco de dados, rede ou relógio do
// sistema. Reaproveita `PredictionResult`/`MatchOutcome`/`GreenScoreCategory`
// (Sprint 4.3) e `PredictionQualityRecord` (Sprint 4.4) sem duplicá-los.

import type { GreenScoreCategory, MatchOutcome, PredictionResult } from "../prediction-orchestrator/index.ts";
import type { PredictionQualityRecord } from "../prediction-quality/index.ts";
// Referência de tipo apenas (import type, apagada na compilação) para
// `EvaluationReport.config` abaixo. `PredictionEvaluationConfig.ts`
// importa deste arquivo (`isFiniteNumber`, `EvaluationSegmentType`), o que
// forma um ciclo apenas ao nível de TIPOS — nunca em tempo de execução,
// já que `import type` não gera nenhum `require`/`import` real. Este é o
// único padrão seguro para expor "a configuração usada" dentro do
// relatório sem duplicar a definição de `PredictionEvaluationConfig`.
import type { PredictionEvaluationConfig } from "./PredictionEvaluationConfig.ts";

// Reexportado por conveniência: consumidores deste módulo não precisam
// importar diretamente dos barrels das Sprints 4.3/4.4 para o vocabulário
// já estabelecido, nunca redefinido aqui.
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
 * Uma previsão já produzida pelo Prediction Orchestrator (Sprint 4.3,
 * `result` reaproveitado sem alteração), identificada por `matchId` e
 * ainda **não casada** com um resultado real — o casamento (join) é
 * responsabilidade do `HistoricalEvaluationEngine`, nunca implícito.
 * `virtualTeamHome`/`virtualTeamAway`/`league`/`period`/`sequenceKey` são
 * rótulos opcionais fornecidos livremente pelo chamador (mesmo padrão já
 * usado por `league`/`period` na Sprint 4.4) — nenhum contrato existente
 * carrega equipe virtual ou uma chave temporal, então nunca são inferidos,
 * apenas aceitos quando fornecidos. `sequenceKey` é a ÚNICA fonte de
 * ordenação temporal aceita pelos benchmarks que dependem de histórico —
 * nunca `result.metadata.generatedAt` (hora de geração da previsão, não
 * da partida) nem qualquer outro campo implícito.
 */
export type PredictionSnapshot = {
  matchId: string;
  homePlayerId: string;
  awayPlayerId: string;
  virtualTeamHome: string | null;
  virtualTeamAway: string | null;
  league: string | null;
  period: string | null;
  sequenceKey: string | number | null;
  result: PredictionResult;
};

/**
 * O resultado real de uma partida, identificado por `matchId`, fornecido
 * pelo chamador — este framework nunca lê banco de dados nem infere um
 * resultado. `homeGoals`/`awayGoals` são opcionais (`null` quando
 * indisponíveis) e habilitam o segmento `OBSERVED_GOALS_BUCKET`; `outcome`
 * é sempre exigido.
 */
export type ActualMatchOutcome = {
  matchId: string;
  outcome: MatchOutcome;
  homeGoals: number | null;
  awayGoals: number | null;
};

/**
 * Um par previsão+resultado real já casado (join) por `matchId` e
 * validado — a unidade sobre a qual toda métrica desta sprint é
 * calculada. Nunca construído fora de `HistoricalEvaluationEngine`.
 */
export type HistoricalPredictionRecord = {
  snapshot: PredictionSnapshot;
  actual: ActualMatchOutcome;
};

/**
 * Converte um `HistoricalPredictionRecord` já casado para o formato
 * `PredictionQualityRecord` da Sprint 4.4 — permite reaproveitar
 * `computeAccuracyMetrics`/`computeBrierScoreReport`/etc. sem duplicar
 * nenhuma fórmula. Função pura, sem efeitos colaterais.
 */
export function toPredictionQualityRecord(record: HistoricalPredictionRecord): PredictionQualityRecord {
  return {
    matchId: record.snapshot.matchId,
    homePlayerId: record.snapshot.homePlayerId,
    awayPlayerId: record.snapshot.awayPlayerId,
    league: record.snapshot.league,
    period: record.snapshot.period,
    result: record.snapshot.result,
    actualOutcome: record.actual.outcome,
  };
}

/**
 * O conjunto de dados de entrada: previsões e resultados reais como
 * coleções **separadas** — o join, a detecção de duplicatas e os casos
 * órfãos (previsão sem resultado, resultado sem previsão) são
 * responsabilidade explícita do `HistoricalEvaluationEngine`.
 * `datasetId` é sempre fornecido pelo chamador (nunca gerado).
 */
export type EvaluationDataset = {
  datasetId: string;
  predictions: PredictionSnapshot[];
  actuals: ActualMatchOutcome[];
};

export type EvaluationSegmentType =
  | "PLAYER"
  | "LEAGUE"
  | "VIRTUAL_TEAM"
  | "HOME_AWAY"
  | "CONFIDENCE_BUCKET"
  | "GREEN_SCORE"
  | "PREDICTED_OUTCOME"
  | "PERIOD"
  | "OBSERVED_GOALS_BUCKET";

export type EvaluationSegment = {
  type: EvaluationSegmentType;
  key: string;
};

export type EvaluationStatus = "OK" | "INSUFFICIENT_SAMPLE" | "EMPTY" | "REJECTED";

/**
 * Pacote de métricas reutilizado tanto para a avaliação global quanto para
 * cada segmento e benchmark — única definição, nunca duplicada por
 * contexto. `averagePredictedProbability`/`averageObservedOutcome` seguem
 * a mesma terminologia já usada por `CalibrationBucket` (Sprint 4.4):
 * a primeira é a média de `topProbability`; a segunda é a taxa de acerto
 * observada (equivalente a `accuracy`, exposta com o nome pedido por esta
 * sprint para consistência com a linguagem de calibração).
 */
export type EvaluationMetrics = {
  totalRecords: number;
  validRecords: number;
  ignoredRecords: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  brierScore: number;
  logLoss: number;
  averageConfidence: number;
  averagePredictedProbability: number;
  averageObservedOutcome: number;
};

export type SegmentEvaluation = {
  segment: EvaluationSegment;
  metrics: EvaluationMetrics;
  status: EvaluationStatus;
  warnings: EvaluationWarning[];
};

export type BenchmarkType = "UNIFORM" | "MAJORITY_CLASS" | "HISTORICAL_FREQUENCY" | "GLOBAL_AVERAGE" | "CONSTANT_BASELINE";

/** `constantProbabilities` só é lido/exigido quando `type === "CONSTANT_BASELINE"`. */
export type BenchmarkDefinition = {
  type: BenchmarkType;
  constantProbabilities: { homeWin: number; draw: number; awayWin: number } | null;
};

export type BenchmarkResult = {
  definition: BenchmarkDefinition;
  metrics: EvaluationMetrics;
  status: EvaluationStatus;
  warnings: EvaluationWarning[];
};

export type ModelEvaluationResult = {
  label: string;
  metrics: EvaluationMetrics;
  status: EvaluationStatus;
};

export type MetricDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
export type ComparisonWinner = "A" | "B" | "TIE" | "UNAVAILABLE";

export type MetricComparisonResult = {
  metricName: string;
  direction: MetricDirection;
  valueA: number | null;
  valueB: number | null;
  absoluteDifference: number | null;
  percentageDifference: number | null;
  winner: ComparisonWinner;
};

export type ModelComparison = {
  labelA: string;
  labelB: string;
  sampleSizeA: number;
  sampleSizeB: number;
  comparisons: MetricComparisonResult[];
  overallStatus: EvaluationStatus;
};

export type EvaluationWarningCode =
  | "EMPTY_DATASET"
  | "INSUFFICIENT_SAMPLE_SIZE"
  | "DUPLICATE_MATCH_ID"
  | "PREDICTION_WITHOUT_OUTCOME"
  | "OUTCOME_WITHOUT_PREDICTION"
  | "INVALID_RECORD_EXCLUDED"
  | "SEGMENT_INSUFFICIENT_SAMPLE"
  | "BENCHMARK_UNAVAILABLE"
  | "METRIC_UNAVAILABLE"
  | "NO_SEQUENCE_KEY_PROVIDED";

export type EvaluationWarning = {
  code: EvaluationWarningCode;
  matchId: string | null;
  details: string | null;
};

export type EvaluationRejection = {
  matchId: string;
  reason: string;
};

export type EvaluationDatasetSummary = {
  datasetId: string;
  totalPredictions: number;
  totalActuals: number;
  matchedRecords: number;
  validRecords: number;
  ignoredRecords: number;
};

/**
 * Relatório final, serializável. `reportId`/`generatedAt` nunca são
 * gerados por este módulo — sempre fornecidos pelo chamador
 * (`generatedAt` pode ser `null` quando não aplicável). Nenhuma função
 * deste framework lê `Date.now()`/relógio do sistema.
 */
export type EvaluationReport = {
  reportId: string;
  generatedAt: string | null;
  modelVersion: string;
  config: PredictionEvaluationConfig;
  datasetSummary: EvaluationDatasetSummary;
  globalMetrics: EvaluationMetrics;
  segments: SegmentEvaluation[];
  benchmarks: BenchmarkResult[];
  comparisons: ModelComparison[];
  warnings: EvaluationWarning[];
  rejectedRecords: EvaluationRejection[];
  status: EvaluationStatus;
};
