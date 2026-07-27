// Fase 4 — Sprint 4.5 — Historical Prediction Evaluation & Benchmarking Framework.
// Configuração centralizada: quantidade mínima de registros, buckets de
// confiança, política de registros inválidos, casas decimais, tolerância
// numérica e segmentos habilitados. Nenhum número mágico deve aparecer
// fora deste arquivo nos demais módulos do framework.
//
// PROVISIONAL — pending historical calibration: os limiares abaixo são
// julgamento de engenharia desta sprint — a mesma convenção já usada em
// `PredictionModelConfig.ts` (Sprint 4.1), `GoalDistributionConfig.ts`
// (Sprint 4.2), `PredictionOrchestratorConfig.ts` (Sprint 4.3) e
// `PredictionQualityConfig.ts` (Sprint 4.4).

import { isFiniteNumber, type EvaluationSegmentType } from "./types.ts";

export class PredictionEvaluationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionEvaluationConfigurationError";
  }
}

export const PREDICTION_EVALUATION_MODEL_VERSION = "esoccer-prediction-evaluation-v1.0.0-provisional";

export type InvalidRecordPolicy = "reject" | "skip" | "collect";
export type EmptyDatasetBehavior = "EMPTY_REPORT" | "REJECT";

export interface PredictionEvaluationConfig {
  modelVersion: string;
  /** Quantidade mínima de registros válidos para que a avaliação global
   * seja considerada com amostra suficiente (`EvaluationStatus`). */
  minRecordsForEvaluation: number;
  /** Quantidade mínima de registros válidos para que UM segmento seja
   * considerado com amostra suficiente. */
  minRecordsPerSegment: number;
  /** Limites (0..100) das faixas de confiança, estritamente crescentes,
   * começando em 0 e terminando em 100 — ex.: `[0, 20, 40, 60, 80, 100]`
   * define 5 faixas. Cada valor separa duas faixas adjacentes; não há
   * sobreposição nem lacuna possível por construção quando a lista é
   * estritamente crescente e cobre `[0, 100]` por completo. */
  confidenceBuckets: number[];
  invalidRecordPolicy: InvalidRecordPolicy;
  /** Casas decimais aplicadas apenas na serialização/apresentação do
   * relatório — nunca durante o cálculo interno, para não perder
   * precisão numérica antes da hora. */
  decimalPlaces: number;
  /** Tolerância (>=0) usada para decidir empates entre métricas no
   * `ModelComparisonEngine` — duas métricas cuja diferença absoluta seja
   * menor ou igual a esta tolerância são consideradas empatadas. */
  numericTolerance: number;
  enabledSegments: EvaluationSegmentType[];
  /** Comportamento quando o dataset não contém nenhum registro válido:
   * `EMPTY_REPORT` devolve um relatório zerado com status `EMPTY`;
   * `REJECT` devolve status `REJECTED`. Nunca lança exceção em nenhum
   * dos dois casos. */
  emptyDatasetBehavior: EmptyDatasetBehavior;
}

const ALL_SEGMENT_TYPES: EvaluationSegmentType[] = [
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

export const DEFAULT_CONFIDENCE_BUCKETS: number[] = [0, 20, 40, 60, 80, 100];

export const DEFAULT_PREDICTION_EVALUATION_CONFIG: PredictionEvaluationConfig = {
  modelVersion: PREDICTION_EVALUATION_MODEL_VERSION,
  minRecordsForEvaluation: 10,
  minRecordsPerSegment: 5,
  confidenceBuckets: DEFAULT_CONFIDENCE_BUCKETS,
  invalidRecordPolicy: "skip",
  decimalPlaces: 4,
  numericTolerance: 1e-6,
  enabledSegments: ALL_SEGMENT_TYPES,
  emptyDatasetBehavior: "EMPTY_REPORT",
};

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

const VALID_POLICIES: InvalidRecordPolicy[] = ["reject", "skip", "collect"];
const VALID_EMPTY_BEHAVIORS: EmptyDatasetBehavior[] = ["EMPTY_REPORT", "REJECT"];

/**
 * Valida a configuração antes do uso. Lança
 * `PredictionEvaluationConfigurationError` com uma mensagem estruturada
 * para a primeira violação encontrada; nunca "corrige" silenciosamente
 * uma configuração inválida.
 */
export function validatePredictionEvaluationConfig(config: PredictionEvaluationConfig): void {
  if (typeof config.modelVersion !== "string" || config.modelVersion.trim().length === 0) {
    throw new PredictionEvaluationConfigurationError("modelVersion deve ser uma string não vazia.");
  }
  if (!isNonNegativeInteger(config.minRecordsForEvaluation)) {
    throw new PredictionEvaluationConfigurationError("minRecordsForEvaluation deve ser um inteiro maior ou igual a zero.");
  }
  if (!isNonNegativeInteger(config.minRecordsPerSegment)) {
    throw new PredictionEvaluationConfigurationError("minRecordsPerSegment deve ser um inteiro maior ou igual a zero.");
  }

  if (!Array.isArray(config.confidenceBuckets) || config.confidenceBuckets.length < 2) {
    throw new PredictionEvaluationConfigurationError("confidenceBuckets deve ser um array com pelo menos 2 limites.");
  }
  for (const value of config.confidenceBuckets) {
    if (!isFiniteNumber(value) || value < 0 || value > 100) {
      throw new PredictionEvaluationConfigurationError(
        `confidenceBuckets contém um limite fora do intervalo [0, 100] (recebido: ${String(value)}).`,
      );
    }
  }
  if (config.confidenceBuckets[0] !== 0) {
    throw new PredictionEvaluationConfigurationError("confidenceBuckets deve começar em 0.");
  }
  if (config.confidenceBuckets[config.confidenceBuckets.length - 1] !== 100) {
    throw new PredictionEvaluationConfigurationError("confidenceBuckets deve terminar em 100.");
  }
  for (let i = 1; i < config.confidenceBuckets.length; i += 1) {
    if (config.confidenceBuckets[i] <= config.confidenceBuckets[i - 1]) {
      throw new PredictionEvaluationConfigurationError(
        "confidenceBuckets deve ser estritamente crescente (sem lacunas nem sobreposições).",
      );
    }
  }

  if (!VALID_POLICIES.includes(config.invalidRecordPolicy)) {
    throw new PredictionEvaluationConfigurationError('invalidRecordPolicy deve ser "reject", "skip" ou "collect".');
  }

  if (!isNonNegativeInteger(config.decimalPlaces) || config.decimalPlaces > 15) {
    throw new PredictionEvaluationConfigurationError("decimalPlaces deve ser um inteiro entre 0 e 15.");
  }

  if (!isFiniteNumber(config.numericTolerance) || config.numericTolerance < 0) {
    throw new PredictionEvaluationConfigurationError("numericTolerance deve ser um número finito maior ou igual a zero.");
  }

  if (!Array.isArray(config.enabledSegments) || config.enabledSegments.length === 0) {
    throw new PredictionEvaluationConfigurationError("enabledSegments deve ser um array não vazio.");
  }
  for (const segment of config.enabledSegments) {
    if (!ALL_SEGMENT_TYPES.includes(segment)) {
      throw new PredictionEvaluationConfigurationError(`enabledSegments contém um segmento desconhecido: ${String(segment)}.`);
    }
  }

  if (!VALID_EMPTY_BEHAVIORS.includes(config.emptyDatasetBehavior)) {
    throw new PredictionEvaluationConfigurationError('emptyDatasetBehavior deve ser "EMPTY_REPORT" ou "REJECT".');
  }
}
