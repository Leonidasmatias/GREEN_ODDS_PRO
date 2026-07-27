// Fase 4 — Sprint 4.3 — Prediction Orchestrator.
// Configuração centralizada do orquestrador: versão, pesos, limiares de
// consistência, thresholds de Green Score e parâmetros de explicabilidade
// — mais as configurações completas do Prediction Engine (Sprint 4.1) e
// do Goal Distribution Engine (Sprint 4.2), reaproveitadas sem alteração
// como sub-campos, nunca duplicadas.
//
// PROVISIONAL — pending historical calibration: todos os pesos e
// limiares abaixo são julgamento de engenharia desta sprint, não
// resultado de backtest com dados reais de eSoccer — a mesma convenção já
// usada em `PredictionModelConfig.ts` (Sprint 4.1) e
// `GoalDistributionConfig.ts` (Sprint 4.2).

import {
  DEFAULT_PREDICTION_MODEL_CONFIG,
  validatePredictionModelConfig,
  type PredictionModelConfig,
} from "../prediction/index.ts";
import {
  DEFAULT_GOAL_DISTRIBUTION_CONFIG,
  validateGoalDistributionConfig,
  type GoalDistributionConfig,
} from "../goal-distribution/index.ts";
import type { DataSufficiencyStatus } from "./types.ts";
import { isFiniteNumber } from "./types.ts";

export class PredictionOrchestratorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionOrchestratorConfigurationError";
  }
}

/**
 * Versão explícita do orquestrador, centralizada em um único lugar. Deve
 * mudar sempre que a fórmula de agregação, os pesos ou a explicabilidade
 * forem alterados de forma que o resultado numérico deixe de ser
 * comparável ao de versões anteriores.
 */
export const PREDICTION_ORCHESTRATOR_MODEL_VERSION = "esoccer-orchestrator-v1.0.0-provisional";

/** Pontuação (0..100) atribuída a cada status de suficiência de dados,
 * usada para converter `DataSufficiencyStatus` (Sprints 4.1/4.2) em um
 * número combinável pela Confidence/Green Score Engine desta sprint. */
export type DataSufficiencyStatusScores = Record<DataSufficiencyStatus, number>;

export interface ConsistencyThresholds {
  /** Delta máximo (0..1) entre as probabilidades correspondentes dos dois
   * motores para que, com o mesmo vencedor, o resultado seja considerado
   * fortemente alinhado (bônus). */
  alignedThreshold: number;
  /** Delta (0..1) a partir do qual uma divergência de vencedor é tratada
   * como MAJOR_DIVERGENCE (penalidade maior) em vez de MINOR_DIVERGENCE. */
  majorDivergenceThreshold: number;
}

export interface ConsistencyAdjustments {
  alignedBonus: number;
  minorDivergencePenalty: number;
  majorDivergencePenalty: number;
}

export interface ConfidenceWeights {
  predictionConfidence: number;
  goalDistributionConfidence: number;
  signalCount: number;
}

export interface GreenScoreWeights {
  predictionConfidence: number;
  goalDistributionConfidence: number;
  dataQuality: number;
  headToHeadReliability: number;
  formReliability: number;
}

export interface GreenScoreThresholds {
  /** Score máximo (inclusive) ainda classificado como LOW. */
  lowMax: number;
  /** Score máximo (inclusive) ainda classificado como MEDIUM. */
  mediumMax: number;
  /** Score máximo (inclusive) ainda classificado como HIGH; acima disso, VERY_HIGH. */
  highMax: number;
}

export interface PredictionExplanationConfig {
  /** Quantidade de sinais retornados em `topSignals`. */
  topSignalsCount: number;
  /** Total de gols esperados acima do qual um sinal HIGH_SCORING_TREND é considerado. */
  highScoringTotalGoalsThreshold: number;
  /** Total de gols esperados abaixo do qual um sinal LOW_SCORING_TREND é considerado. */
  lowScoringTotalGoalsThreshold: number;
  /** Escala de referência (gols/partida) usada para normalizar a
   * magnitude de sinais derivados do Goal Distribution Engine para 0..1. */
  magnitudeReferenceScale: number;
}

export interface PredictionOrchestratorConfig {
  modelVersion: string;
  predictionConfig: PredictionModelConfig;
  goalDistributionConfig: GoalDistributionConfig;
  dataSufficiencyStatusScores: DataSufficiencyStatusScores;
  consistencyThresholds: ConsistencyThresholds;
  consistencyAdjustments: ConsistencyAdjustments;
  confidenceWeights: ConfidenceWeights;
  greenScoreWeights: GreenScoreWeights;
  greenScoreThresholds: GreenScoreThresholds;
  explanation: PredictionExplanationConfig;
}

export const DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES: DataSufficiencyStatusScores = {
  INSUFFICIENT: 10,
  LIMITED: 40,
  SUFFICIENT: 70,
  STRONG: 100,
};

export const DEFAULT_CONSISTENCY_THRESHOLDS: ConsistencyThresholds = {
  alignedThreshold: 0.05,
  majorDivergenceThreshold: 0.15,
};

export const DEFAULT_CONSISTENCY_ADJUSTMENTS: ConsistencyAdjustments = {
  alignedBonus: 8,
  minorDivergencePenalty: 8,
  majorDivergencePenalty: 20,
};

export const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  predictionConfidence: 0.4,
  goalDistributionConfidence: 0.4,
  signalCount: 0.2,
};

export const DEFAULT_GREEN_SCORE_WEIGHTS: GreenScoreWeights = {
  predictionConfidence: 0.25,
  goalDistributionConfidence: 0.25,
  dataQuality: 0.2,
  headToHeadReliability: 0.15,
  formReliability: 0.15,
};

export const DEFAULT_GREEN_SCORE_THRESHOLDS: GreenScoreThresholds = {
  lowMax: 39,
  mediumMax: 64,
  highMax: 84,
};

export const DEFAULT_EXPLANATION_CONFIG: PredictionExplanationConfig = {
  topSignalsCount: 5,
  highScoringTotalGoalsThreshold: 3.0,
  lowScoringTotalGoalsThreshold: 1.5,
  magnitudeReferenceScale: 2.0,
};

export const DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG: PredictionOrchestratorConfig = {
  modelVersion: PREDICTION_ORCHESTRATOR_MODEL_VERSION,
  predictionConfig: DEFAULT_PREDICTION_MODEL_CONFIG,
  goalDistributionConfig: DEFAULT_GOAL_DISTRIBUTION_CONFIG,
  dataSufficiencyStatusScores: DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES,
  consistencyThresholds: DEFAULT_CONSISTENCY_THRESHOLDS,
  consistencyAdjustments: DEFAULT_CONSISTENCY_ADJUSTMENTS,
  confidenceWeights: DEFAULT_CONFIDENCE_WEIGHTS,
  greenScoreWeights: DEFAULT_GREEN_SCORE_WEIGHTS,
  greenScoreThresholds: DEFAULT_GREEN_SCORE_THRESHOLDS,
  explanation: DEFAULT_EXPLANATION_CONFIG,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Valida a configuração completa do orquestrador, incluindo as
 * sub-configurações do Prediction Engine e do Goal Distribution Engine
 * (reaproveitando `validatePredictionModelConfig`/
 * `validateGoalDistributionConfig` das Sprints 4.1/4.2 — nunca
 * duplicando a lógica de validação). Lança sempre
 * `PredictionOrchestratorConfigurationError`, envolvendo a mensagem
 * original quando a falha vem de uma sub-configuração, para que o
 * chamador só precise capturar um único tipo de erro.
 */
export function validatePredictionOrchestratorConfig(config: PredictionOrchestratorConfig): void {
  if (typeof config.modelVersion !== "string" || config.modelVersion.trim().length === 0) {
    throw new PredictionOrchestratorConfigurationError("modelVersion deve ser uma string não vazia.");
  }

  try {
    validatePredictionModelConfig(config.predictionConfig);
  } catch (error) {
    throw new PredictionOrchestratorConfigurationError(`predictionConfig inválido: ${errorMessage(error)}`);
  }

  try {
    validateGoalDistributionConfig(config.goalDistributionConfig);
  } catch (error) {
    throw new PredictionOrchestratorConfigurationError(`goalDistributionConfig inválido: ${errorMessage(error)}`);
  }

  const scores = config.dataSufficiencyStatusScores;
  for (const [name, value] of Object.entries(scores)) {
    if (!isFiniteNumber(value) || value < 0 || value > 100) {
      throw new PredictionOrchestratorConfigurationError(
        `dataSufficiencyStatusScores.${name} deve ser um número finito entre 0 e 100 (recebido: ${String(value)}).`,
      );
    }
  }
  if (!(scores.INSUFFICIENT < scores.LIMITED && scores.LIMITED < scores.SUFFICIENT && scores.SUFFICIENT < scores.STRONG)) {
    throw new PredictionOrchestratorConfigurationError(
      "dataSufficiencyStatusScores deve satisfazer INSUFFICIENT < LIMITED < SUFFICIENT < STRONG.",
    );
  }

  const { alignedThreshold, majorDivergenceThreshold } = config.consistencyThresholds;
  if (!isFiniteNumber(alignedThreshold) || alignedThreshold < 0 || alignedThreshold > 1) {
    throw new PredictionOrchestratorConfigurationError("consistencyThresholds.alignedThreshold deve ser um número finito entre 0 e 1.");
  }
  if (!isFiniteNumber(majorDivergenceThreshold) || majorDivergenceThreshold <= alignedThreshold || majorDivergenceThreshold > 1) {
    throw new PredictionOrchestratorConfigurationError(
      "consistencyThresholds.majorDivergenceThreshold deve ser um número finito maior que alignedThreshold e no máximo 1.",
    );
  }

  const { minorDivergencePenalty, majorDivergencePenalty } = config.consistencyAdjustments;
  for (const [name, value] of Object.entries(config.consistencyAdjustments)) {
    if (!isFiniteNumber(value) || value < 0) {
      throw new PredictionOrchestratorConfigurationError(
        `consistencyAdjustments.${name} deve ser um número finito maior ou igual a zero (recebido: ${String(value)}).`,
      );
    }
  }
  if (majorDivergencePenalty < minorDivergencePenalty) {
    throw new PredictionOrchestratorConfigurationError(
      "consistencyAdjustments.majorDivergencePenalty deve ser maior ou igual a minorDivergencePenalty.",
    );
  }

  for (const [name, value] of Object.entries(config.confidenceWeights)) {
    if (!isFiniteNumber(value) || value < 0) {
      throw new PredictionOrchestratorConfigurationError(
        `confidenceWeights.${name} deve ser um número finito maior ou igual a zero (recebido: ${String(value)}).`,
      );
    }
  }
  const confidenceWeightSum = Object.values(config.confidenceWeights).reduce((sum, value) => sum + value, 0);
  if (confidenceWeightSum <= 0) {
    throw new PredictionOrchestratorConfigurationError("confidenceWeights deve ter soma maior que zero.");
  }

  for (const [name, value] of Object.entries(config.greenScoreWeights)) {
    if (!isFiniteNumber(value) || value < 0) {
      throw new PredictionOrchestratorConfigurationError(
        `greenScoreWeights.${name} deve ser um número finito maior ou igual a zero (recebido: ${String(value)}).`,
      );
    }
  }
  const greenScoreWeightSum = Object.values(config.greenScoreWeights).reduce((sum, value) => sum + value, 0);
  if (greenScoreWeightSum <= 0) {
    throw new PredictionOrchestratorConfigurationError("greenScoreWeights deve ter soma maior que zero.");
  }

  const { lowMax, mediumMax, highMax } = config.greenScoreThresholds;
  for (const [name, value] of Object.entries(config.greenScoreThresholds)) {
    if (!isFiniteNumber(value) || value < 0 || value > 100) {
      throw new PredictionOrchestratorConfigurationError(
        `greenScoreThresholds.${name} deve ser um número finito entre 0 e 100 (recebido: ${String(value)}).`,
      );
    }
  }
  if (!(lowMax < mediumMax && mediumMax < highMax)) {
    throw new PredictionOrchestratorConfigurationError("greenScoreThresholds deve satisfazer lowMax < mediumMax < highMax.");
  }

  const explanation = config.explanation;
  if (!isFiniteNumber(explanation.topSignalsCount) || !Number.isInteger(explanation.topSignalsCount) || explanation.topSignalsCount <= 0) {
    throw new PredictionOrchestratorConfigurationError("explanation.topSignalsCount deve ser um inteiro positivo finito.");
  }
  if (!isFiniteNumber(explanation.lowScoringTotalGoalsThreshold) || explanation.lowScoringTotalGoalsThreshold <= 0) {
    throw new PredictionOrchestratorConfigurationError("explanation.lowScoringTotalGoalsThreshold deve ser um número finito maior que zero.");
  }
  if (
    !isFiniteNumber(explanation.highScoringTotalGoalsThreshold) ||
    explanation.highScoringTotalGoalsThreshold <= explanation.lowScoringTotalGoalsThreshold
  ) {
    throw new PredictionOrchestratorConfigurationError(
      "explanation.highScoringTotalGoalsThreshold deve ser um número finito maior que lowScoringTotalGoalsThreshold.",
    );
  }
  if (!isFiniteNumber(explanation.magnitudeReferenceScale) || explanation.magnitudeReferenceScale <= 0) {
    throw new PredictionOrchestratorConfigurationError("explanation.magnitudeReferenceScale deve ser um número finito maior que zero.");
  }
}
