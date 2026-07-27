// Fase 5 — Sprint 5.1 — Learning Data Foundation & Drift Detection.
// Tipos compartilhados. Nenhum tipo aqui depende do Prisma Client, rede ou
// relógio do sistema. Reaproveita `MatchOutcome`/`GreenScoreCategory`
// (Sprint 4.3) e `EvaluationMetrics` (Sprint 4.5, via alias `ProfileMetrics`)
// sem duplicá-los. Esta sprint NUNCA recalcula previsões nem altera o
// Prediction Engine — apenas consolida, compara e sinaliza a partir de
// dados JÁ avaliados.

import type { GreenScoreCategory, MatchOutcome } from "../prediction-orchestrator/index.ts";
import type { EvaluationMetrics, HistoricalPredictionRecord } from "../prediction-evaluation/index.ts";
// Referência de tipo apenas (import type, apagada na compilação) para
// `LearningReport.config` abaixo — mesmo padrão de ciclo type-only já
// verificado seguro na Sprint 4.5 (`types.ts` <-> `PredictionEvaluationConfig.ts`).
import type { PredictionLearningConfig } from "./PredictionLearningConfig.ts";

export type { MatchOutcome, GreenScoreCategory };

/** Pacote de métricas reaproveitado INTEGRALMENTE da Sprint 4.5 — nenhuma
 * fórmula de accuracy/Brier/Log Loss/precisão/recall é duplicada aqui. */
export type ProfileMetrics = EvaluationMetrics;

/** Clampa um valor numérico entre min e max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** true somente para números finitos (rejeita NaN, +Infinity, -Infinity e não-números). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Registro atômico consumido por esta sprint: uma previsão JÁ avaliada
 * (par previsão+resultado real já casado e validado), em forma achatada —
 * deliberadamente independente de `PredictionResult` (Sprint 4.3), que
 * carrega campos irrelevantes para aprendizado/drift (explicação,
 * qualidade de dados, warnings do orquestrador, metadata). `sequenceKey`
 * é a ÚNICA fonte de ordenação temporal aceita (nunca inferida de
 * relógio ou posição de array) — mesmo princípio já estabelecido pela
 * Sprint 4.5.
 */
export type LearningHistoricalRecord = {
  matchId: string;
  homePlayerId: string;
  awayPlayerId: string;
  virtualTeamHome: string | null;
  virtualTeamAway: string | null;
  league: string | null;
  period: string | null;
  sequenceKey: string | number | null;
  predictedOutcome: MatchOutcome;
  actualOutcome: MatchOutcome;
  probabilities: { homeWin: number; draw: number; awayWin: number };
  confidence: number;
  greenScoreCategory: GreenScoreCategory;
};

/**
 * Converte um `HistoricalPredictionRecord` já casado (Sprint 4.5) para o
 * formato achatado consumido por esta sprint — a integração explícita
 * entre os dois frameworks, sem duplicar o contrato de origem. Função
 * pura, sem efeitos colaterais.
 */
export function toLearningHistoricalRecord(record: HistoricalPredictionRecord): LearningHistoricalRecord {
  return {
    matchId: record.snapshot.matchId,
    homePlayerId: record.snapshot.homePlayerId,
    awayPlayerId: record.snapshot.awayPlayerId,
    virtualTeamHome: record.snapshot.virtualTeamHome,
    virtualTeamAway: record.snapshot.virtualTeamAway,
    league: record.snapshot.league,
    period: record.snapshot.period,
    sequenceKey: record.snapshot.sequenceKey,
    predictedOutcome: record.snapshot.result.prediction.predictedOutcome,
    actualOutcome: record.actual.outcome,
    probabilities: record.snapshot.result.prediction.probabilities,
    confidence: record.snapshot.result.confidence,
    greenScoreCategory: record.snapshot.result.greenScore.category,
  };
}

/** Conjunto de dados de entrada. `datasetId` é sempre fornecido pelo
 * chamador (nunca gerado). */
export type LearningDataset = {
  datasetId: string;
  records: LearningHistoricalRecord[];
};

export type ProfileDimension =
  | "GLOBAL"
  | "PLAYER"
  | "LEAGUE"
  | "VIRTUAL_TEAM"
  | "HOME_AWAY"
  | "PERIOD"
  | "PREDICTED_OUTCOME"
  | "GREEN_SCORE"
  | "CONFIDENCE_BUCKET";

/** Chave textual de um perfil dentro de sua dimensão — `"GLOBAL"` é a
 * única chave da dimensão `GLOBAL`. */
export type ProfileKey = string;

export const GLOBAL_PROFILE_KEY: ProfileKey = "GLOBAL";

/** Ordem canônica e fixa das dimensões — única fonte de verdade,
 * reaproveitada por `HistoricalProfileEngine`, `DriftDetectionEngine` e
 * `ReliabilityRankingEngine` (nunca duplicada por arquivo). */
export const PROFILE_DIMENSION_ORDER: ProfileDimension[] = [
  "GLOBAL",
  "PLAYER",
  "LEAGUE",
  "VIRTUAL_TEAM",
  "HOME_AWAY",
  "PERIOD",
  "PREDICTED_OUTCOME",
  "GREEN_SCORE",
  "CONFIDENCE_BUCKET",
];

export type LearningStatus = "OK" | "INSUFFICIENT_SAMPLE" | "EMPTY" | "REJECTED";

const LEARNING_STATUS_RANK: Record<LearningStatus, number> = { REJECTED: 0, EMPTY: 1, INSUFFICIENT_SAMPLE: 2, OK: 3 };

/** O pior (menos utilizável) dos dois status, na ordem
 * `REJECTED` < `EMPTY` < `INSUFFICIENT_SAMPLE` < `OK` — única fonte de
 * verdade, reaproveitada por `WindowComparisonEngine` e `LearningReport`
 * (nunca duplicada por arquivo). */
export function worseLearningStatus(a: LearningStatus, b: LearningStatus): LearningStatus {
  return LEARNING_STATUS_RANK[a] <= LEARNING_STATUS_RANK[b] ? a : b;
}

export type LearningWarningCode =
  | "EMPTY_DATASET"
  | "INSUFFICIENT_SAMPLE_SIZE"
  | "DUPLICATE_MATCH_ID"
  | "INVALID_RECORD_EXCLUDED"
  | "PROFILE_INSUFFICIENT_SAMPLE"
  | "MIXED_SEQUENCE_KEY_TYPES"
  | "NO_SEQUENCE_KEY_PROVIDED"
  | "WINDOW_EMPTY";

export type LearningWarning = {
  code: LearningWarningCode;
  dimension: ProfileDimension | null;
  key: ProfileKey | null;
  details: string | null;
};

export type RejectedLearningRecord = {
  matchId: string;
  reason: string;
};

/**
 * Perfil estatístico de uma dimensão+chave, construído sobre registros já
 * avaliados. `firstSequenceKey`/`lastSequenceKey` são `null` quando nenhum
 * registro do perfil possui `sequenceKey`, ou quando os tipos presentes
 * são incompatíveis entre si (nunca uma ordem inventada).
 */
export type HistoricalProfile = {
  dimension: ProfileDimension;
  key: ProfileKey;
  totalRecords: number;
  validRecords: number;
  status: LearningStatus;
  metrics: ProfileMetrics;
  firstSequenceKey: string | number | null;
  lastSequenceKey: string | number | null;
  warnings: LearningWarning[];
};

/**
 * Definição de uma janela histórica por intervalo de `sequenceKey`
 * (inclusivo em ambas as extremidades). `null` em `fromSequenceKey`/
 * `toSequenceKey` significa "sem limite" naquele lado. Nunca definida por
 * posição de array ou data corrente.
 */
export type LearningWindowDefinition = {
  label: string;
  fromSequenceKey: string | number | null;
  toSequenceKey: string | number | null;
};

export type WindowMetrics = {
  definition: LearningWindowDefinition;
  totalRecords: number;
  validRecords: number;
  status: LearningStatus;
  metrics: ProfileMetrics;
  warnings: LearningWarning[];
};

/** Direção de uma métrica de janela: `INFORMATIVE` é usada exclusivamente
 * por `averageConfidence` — uma mudança de confiança é relatada, nunca
 * interpretada isoladamente como melhora ou piora. */
export type LearningMetricDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "INFORMATIVE";

export type MetricDelta = {
  metricName: string;
  direction: LearningMetricDirection;
  baselineValue: number | null;
  currentValue: number | null;
  absoluteDelta: number | null;
  relativeDelta: number | null;
};

export type WindowComparison = {
  baseline: WindowMetrics;
  current: WindowMetrics;
  deltas: MetricDelta[];
  status: LearningStatus;
};

export type DriftSeverity = "INFO" | "WARNING" | "CRITICAL";
export type DriftDirection = "IMPROVEMENT" | "DEGRADATION" | "NEUTRAL";
export type DriftSignalType =
  | "PERFORMANCE_DEGRADATION"
  | "PERFORMANCE_IMPROVEMENT"
  | "CALIBRATION_DEGRADATION"
  | "CONFIDENCE_SHIFT"
  | "SAMPLE_INSUFFICIENT"
  | "PROFILE_DISAPPEARED"
  | "PROFILE_EMERGED";

/** Motivo textual, determinístico (nunca gerado a partir de aleatoriedade
 * ou relógio) — sempre construído a partir de um template fixo com os
 * valores numéricos do próprio sinal. */
export type DriftReason = string;

/**
 * Sinal técnico de drift entre duas janelas para uma dimensão+chave. `id`
 * é determinístico (`dimension:key:type:metric`), nunca UUID/random.
 */
export type DriftSignal = {
  id: string;
  dimension: ProfileDimension;
  key: ProfileKey;
  type: DriftSignalType;
  severity: DriftSeverity;
  metric: string;
  baselineValue: number | null;
  currentValue: number | null;
  absoluteDelta: number | null;
  relativeDelta: number | null;
  threshold: number;
  direction: DriftDirection;
  reason: DriftReason;
  baselineRecords: number;
  currentRecords: number;
};

export type ReliabilityMetricContribution = {
  metricName: string;
  weight: number;
  normalizedValue: number;
  contribution: number;
};

/**
 * Uma entrada do ranking técnico de confiabilidade. NUNCA representa uma
 * recomendação de aposta — puramente um score técnico derivado de
 * métricas históricas (accuracy, precisão, recall, Brier, Log Loss,
 * volume de amostra e estabilidade entre janelas).
 */
export type ReliabilityRankingEntry = {
  rank: number;
  dimension: ProfileDimension;
  key: ProfileKey;
  reliabilityScore: number;
  sampleSize: number;
  status: LearningStatus;
  metricContributions: ReliabilityMetricContribution[];
  warnings: LearningWarning[];
};

export type ReliabilityRanking = {
  entries: ReliabilityRankingEntry[];
  profileCount: number;
};

export type LearningDatasetSummary = {
  datasetId: string;
  totalRecords: number;
  validRecords: number;
  ignoredRecords: number;
  baselineRecords: number;
  currentRecords: number;
};

export type LearningReportOptions = {
  reportId: string;
  generatedAt?: string | null;
  baselineWindow: LearningWindowDefinition;
  currentWindow: LearningWindowDefinition;
};

/**
 * Relatório final, serializável. `reportId`/`generatedAt` nunca são
 * gerados por este módulo — sempre fornecidos pelo chamador. Nenhuma
 * função deste framework lê `Date.now()`, `Math.random()` ou gera UUID.
 */
export type LearningReport = {
  reportId: string;
  generatedAt: string | null;
  modelVersion: string;
  config: PredictionLearningConfig;
  datasetSummary: LearningDatasetSummary;
  historicalProfiles: HistoricalProfile[];
  windowComparisons: WindowComparison[];
  driftSignals: DriftSignal[];
  reliabilityRankings: ReliabilityRanking;
  warnings: LearningWarning[];
  rejectedRecords: RejectedLearningRecord[];
  status: LearningStatus;
};
