// Fase 5 — Sprint 5.1 — Learning Data Foundation & Drift Detection.
// Configuração centralizada: quantidades mínimas de amostra, limiares de
// drift, multiplicadores de severidade, política de registros inválidos,
// dimensões habilitadas e pesos do ranking de confiabilidade. Nenhum
// número mágico deve aparecer fora deste arquivo nos demais módulos do
// framework.
//
// PROVISIONAL — pending historical calibration: os limiares abaixo são
// julgamento de engenharia desta sprint — a mesma convenção já usada em
// `PredictionModelConfig.ts` (Sprint 4.1), `GoalDistributionConfig.ts`
// (Sprint 4.2), `PredictionOrchestratorConfig.ts` (Sprint 4.3),
// `PredictionQualityConfig.ts` (Sprint 4.4) e
// `PredictionEvaluationConfig.ts` (Sprint 4.5).

import { isFiniteNumber, type ProfileDimension } from "./types.ts";

export class PredictionLearningConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionLearningConfigurationError";
  }
}

export const PREDICTION_LEARNING_MODEL_VERSION = "esoccer-prediction-learning-v1.0.0-provisional";

export type InvalidLearningRecordPolicy = "reject" | "skip" | "collect";

/** Pesos usados por `ReliabilityRankingEngine` — renormalizados
 * automaticamente para somar 1 (mesmo padrão de médias ponderadas
 * configuráveis já usado desde a Sprint 4.3), nunca presumidos como já
 * normalizados pelo chamador. */
export type ReliabilityWeights = {
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  brierScore: number;
  logLoss: number;
  sampleSize: number;
  stability: number;
};

/** Penalização de estabilidade aplicada por `ReliabilityRankingEngine`
 * para cada severidade de sinal de drift associado a um perfil — quanto
 * maior, mais um sinal daquela severidade reduz o sub-score de
 * estabilidade (escala 0–1 por severidade). */
export type DriftSeverityPenalty = {
  INFO: number;
  WARNING: number;
  CRITICAL: number;
};

export interface PredictionLearningConfig {
  modelVersion: string;
  /** Quantidade mínima de registros válidos para que UM perfil histórico
   * seja considerado com amostra suficiente. */
  minimumRecordsPerProfile: number;
  /** Quantidade mínima de registros válidos para que UMA janela
   * (baseline ou current) seja considerada com amostra suficiente. */
  minimumRecordsPerWindow: number;
  /** Quantidade mínima de registros válidos, em AMBAS as janelas, para
   * que a detecção de drift seja permitida para uma dimensão+chave —
   * abaixo disso, apenas um sinal `SAMPLE_INSUFFICIENT` é emitido. */
  minimumRecordsForDrift: number;
  /** PROVISIONAL — limiar de variação absoluta de accuracy considerada
   * detectável (abaixo de `numericTolerance`, nunca é sinal; entre a
   * tolerância e este limiar, sinal INFO). */
  accuracyDriftThreshold: number;
  /** PROVISIONAL — mesmo papel de `accuracyDriftThreshold`, para Brier Score. */
  brierDriftThreshold: number;
  /** PROVISIONAL — mesmo papel de `accuracyDriftThreshold`, para Log Loss. */
  logLossDriftThreshold: number;
  /** PROVISIONAL — limiar (escala 0–100) acima do qual uma variação de
   * confiança média é considerada relevante o bastante para relatar
   * (sempre severidade INFO — confiança nunca é interpretada isoladamente
   * como melhora ou piora). */
  confidenceDriftThreshold: number;
  /** PROVISIONAL — multiplicador do limiar de cada métrica que define a
   * fronteira INFO→WARNING (deve ser > 0). */
  warningSeverityMultiplier: number;
  /** PROVISIONAL — multiplicador do limiar de cada métrica que define a
   * fronteira WARNING→CRITICAL (deve ser > `warningSeverityMultiplier`). */
  criticalSeverityMultiplier: number;
  /** Limites (0..100) das faixas de confiança usadas pela dimensão
   * `CONFIDENCE_BUCKET` — mesma convenção da Sprint 4.5
   * (`confidenceBuckets`): estritamente crescentes, de 0 a 100. */
  confidenceBuckets: number[];
  /** Casas decimais aplicadas apenas na serialização do relatório —
   * nunca durante o cálculo interno. */
  decimalPlaces: number;
  /** Tolerância (>=0) abaixo da qual uma variação numérica é considerada
   * ruído (estabilidade), nunca um sinal de drift. */
  numericTolerance: number;
  invalidRecordPolicy: InvalidLearningRecordPolicy;
  enabledDimensions: ProfileDimension[];
  reliabilityWeights: ReliabilityWeights;
  /** PROVISIONAL — teto (>0) usado para normalizar Log Loss em uma escala
   * 0–1 no sub-score de `ReliabilityRankingEngine`. Log Loss acima deste
   * valor é tratado como pior caso (sub-score 0). Não relacionado a
   * `logLossDriftThreshold` (drift), apenas à pontuação de confiabilidade. */
  reliabilityLogLossCap: number;
  /** PROVISIONAL — penalização de estabilidade por severidade de sinal de
   * drift associado ao mesmo perfil, usada por `ReliabilityRankingEngine`. */
  driftSeverityPenalty: DriftSeverityPenalty;
  /** PROVISIONAL — teto (0–100) de `reliabilityScore` para perfis com
   * `status !== "OK"`: garante que nenhum perfil com amostra insuficiente
   * apareça como altamente confiável, independentemente da qualidade
   * bruta de suas métricas. */
  insufficientSampleScoreCeiling: number;
}

const ALL_DIMENSIONS: ProfileDimension[] = [
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

export const DEFAULT_CONFIDENCE_BUCKETS: number[] = [0, 20, 40, 60, 80, 100];

export const DEFAULT_RELIABILITY_WEIGHTS: ReliabilityWeights = {
  accuracy: 0.25,
  macroPrecision: 0.15,
  macroRecall: 0.15,
  brierScore: 0.15,
  logLoss: 0.15,
  sampleSize: 0.1,
  stability: 0.05,
};

export const DEFAULT_DRIFT_SEVERITY_PENALTY: DriftSeverityPenalty = { INFO: 0.1, WARNING: 0.3, CRITICAL: 0.6 };

export const DEFAULT_PREDICTION_LEARNING_CONFIG: PredictionLearningConfig = {
  modelVersion: PREDICTION_LEARNING_MODEL_VERSION,
  minimumRecordsPerProfile: 10,
  minimumRecordsPerWindow: 10,
  minimumRecordsForDrift: 10,
  accuracyDriftThreshold: 0.05,
  brierDriftThreshold: 0.05,
  logLossDriftThreshold: 0.05,
  confidenceDriftThreshold: 5,
  warningSeverityMultiplier: 1,
  criticalSeverityMultiplier: 2,
  confidenceBuckets: DEFAULT_CONFIDENCE_BUCKETS,
  decimalPlaces: 4,
  numericTolerance: 1e-6,
  invalidRecordPolicy: "skip",
  enabledDimensions: ALL_DIMENSIONS,
  reliabilityWeights: DEFAULT_RELIABILITY_WEIGHTS,
  reliabilityLogLossCap: 2,
  driftSeverityPenalty: DEFAULT_DRIFT_SEVERITY_PENALTY,
  insufficientSampleScoreCeiling: 40,
};

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

const VALID_POLICIES: InvalidLearningRecordPolicy[] = ["reject", "skip", "collect"];
const RELIABILITY_WEIGHT_KEYS: (keyof ReliabilityWeights)[] = [
  "accuracy",
  "macroPrecision",
  "macroRecall",
  "brierScore",
  "logLoss",
  "sampleSize",
  "stability",
];
const DRIFT_SEVERITY_KEYS: (keyof DriftSeverityPenalty)[] = ["INFO", "WARNING", "CRITICAL"];

/**
 * Valida a configuração antes do uso. Lança
 * `PredictionLearningConfigurationError` com uma mensagem estruturada
 * para a primeira violação encontrada; nunca "corrige" silenciosamente
 * uma configuração inválida.
 */
export function validatePredictionLearningConfig(config: PredictionLearningConfig): void {
  if (typeof config.modelVersion !== "string" || config.modelVersion.trim().length === 0) {
    throw new PredictionLearningConfigurationError("modelVersion deve ser uma string não vazia.");
  }

  if (!isNonNegativeInteger(config.minimumRecordsPerProfile)) {
    throw new PredictionLearningConfigurationError("minimumRecordsPerProfile deve ser um inteiro maior ou igual a zero.");
  }
  if (!isNonNegativeInteger(config.minimumRecordsPerWindow)) {
    throw new PredictionLearningConfigurationError("minimumRecordsPerWindow deve ser um inteiro maior ou igual a zero.");
  }
  if (!isNonNegativeInteger(config.minimumRecordsForDrift)) {
    throw new PredictionLearningConfigurationError("minimumRecordsForDrift deve ser um inteiro maior ou igual a zero.");
  }

  if (!isFiniteNumber(config.accuracyDriftThreshold) || config.accuracyDriftThreshold < 0) {
    throw new PredictionLearningConfigurationError("accuracyDriftThreshold deve ser um número finito maior ou igual a zero.");
  }
  if (!isFiniteNumber(config.brierDriftThreshold) || config.brierDriftThreshold < 0) {
    throw new PredictionLearningConfigurationError("brierDriftThreshold deve ser um número finito maior ou igual a zero.");
  }
  if (!isFiniteNumber(config.logLossDriftThreshold) || config.logLossDriftThreshold < 0) {
    throw new PredictionLearningConfigurationError("logLossDriftThreshold deve ser um número finito maior ou igual a zero.");
  }
  if (!isFiniteNumber(config.confidenceDriftThreshold) || config.confidenceDriftThreshold < 0) {
    throw new PredictionLearningConfigurationError("confidenceDriftThreshold deve ser um número finito maior ou igual a zero.");
  }

  if (!isFiniteNumber(config.warningSeverityMultiplier) || config.warningSeverityMultiplier <= 0) {
    throw new PredictionLearningConfigurationError("warningSeverityMultiplier deve ser um número finito maior que zero.");
  }
  if (!isFiniteNumber(config.criticalSeverityMultiplier) || config.criticalSeverityMultiplier <= config.warningSeverityMultiplier) {
    throw new PredictionLearningConfigurationError(
      "criticalSeverityMultiplier deve ser um número finito maior que warningSeverityMultiplier.",
    );
  }

  if (!Array.isArray(config.confidenceBuckets) || config.confidenceBuckets.length < 2) {
    throw new PredictionLearningConfigurationError("confidenceBuckets deve ser um array com pelo menos 2 limites.");
  }
  for (const value of config.confidenceBuckets) {
    if (!isFiniteNumber(value) || value < 0 || value > 100) {
      throw new PredictionLearningConfigurationError(
        `confidenceBuckets contém um limite fora do intervalo [0, 100] (recebido: ${String(value)}).`,
      );
    }
  }
  if (config.confidenceBuckets[0] !== 0) {
    throw new PredictionLearningConfigurationError("confidenceBuckets deve começar em 0.");
  }
  if (config.confidenceBuckets[config.confidenceBuckets.length - 1] !== 100) {
    throw new PredictionLearningConfigurationError("confidenceBuckets deve terminar em 100.");
  }
  for (let i = 1; i < config.confidenceBuckets.length; i += 1) {
    if (config.confidenceBuckets[i] <= config.confidenceBuckets[i - 1]) {
      throw new PredictionLearningConfigurationError(
        "confidenceBuckets deve ser estritamente crescente (sem lacunas nem sobreposições).",
      );
    }
  }

  if (!isNonNegativeInteger(config.decimalPlaces) || config.decimalPlaces > 15) {
    throw new PredictionLearningConfigurationError("decimalPlaces deve ser um inteiro entre 0 e 15.");
  }

  if (!isFiniteNumber(config.numericTolerance) || config.numericTolerance < 0) {
    throw new PredictionLearningConfigurationError("numericTolerance deve ser um número finito maior ou igual a zero.");
  }

  if (!VALID_POLICIES.includes(config.invalidRecordPolicy)) {
    throw new PredictionLearningConfigurationError('invalidRecordPolicy deve ser "reject", "skip" ou "collect".');
  }

  if (!Array.isArray(config.enabledDimensions) || config.enabledDimensions.length === 0) {
    throw new PredictionLearningConfigurationError("enabledDimensions deve ser um array não vazio.");
  }
  for (const dimension of config.enabledDimensions) {
    if (!ALL_DIMENSIONS.includes(dimension)) {
      throw new PredictionLearningConfigurationError(`enabledDimensions contém uma dimensão desconhecida: ${String(dimension)}.`);
    }
  }

  if (typeof config.reliabilityWeights !== "object" || config.reliabilityWeights === null) {
    throw new PredictionLearningConfigurationError("reliabilityWeights deve ser um objeto.");
  }
  let weightSum = 0;
  for (const key of RELIABILITY_WEIGHT_KEYS) {
    const value = config.reliabilityWeights[key];
    if (!isFiniteNumber(value) || value < 0) {
      throw new PredictionLearningConfigurationError(`reliabilityWeights.${key} deve ser um número finito maior ou igual a zero.`);
    }
    weightSum += value;
  }
  if (weightSum <= 0) {
    throw new PredictionLearningConfigurationError("reliabilityWeights deve conter ao menos um peso maior que zero.");
  }

  if (!isFiniteNumber(config.reliabilityLogLossCap) || config.reliabilityLogLossCap <= 0) {
    throw new PredictionLearningConfigurationError("reliabilityLogLossCap deve ser um número finito maior que zero.");
  }

  if (typeof config.driftSeverityPenalty !== "object" || config.driftSeverityPenalty === null) {
    throw new PredictionLearningConfigurationError("driftSeverityPenalty deve ser um objeto.");
  }
  for (const severity of DRIFT_SEVERITY_KEYS) {
    const value = config.driftSeverityPenalty[severity];
    if (!isFiniteNumber(value) || value < 0 || value > 1) {
      throw new PredictionLearningConfigurationError(`driftSeverityPenalty.${severity} deve ser um número finito entre 0 e 1.`);
    }
  }

  if (!isFiniteNumber(config.insufficientSampleScoreCeiling) || config.insufficientSampleScoreCeiling < 0 || config.insufficientSampleScoreCeiling > 100) {
    throw new PredictionLearningConfigurationError("insufficientSampleScoreCeiling deve ser um número finito entre 0 e 100.");
  }
}
