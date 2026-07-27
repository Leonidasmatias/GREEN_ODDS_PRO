// Fase 5 — Sprint 5.2 — Adaptive Intelligence & Recommendation Framework.
// Configuração centralizada: fatores de confiança sugeridos, mapeamento
// de risco por recomendação e limiares de confiabilidade. Nenhum número
// mágico deve aparecer fora deste arquivo nos demais módulos do
// framework — lição aplicada diretamente da auditoria da Sprint 5.1
// (`PredictionLearningConfig.ts`).
//
// PROVISIONAL — pending historical calibration: os valores abaixo são
// julgamento de engenharia desta sprint — a mesma convenção já usada em
// todas as configs anteriores (Sprints 4.1–5.1).

import { isFiniteNumber } from "./types.ts";
import type { RecommendationType, RiskLevel } from "./types.ts";

export class PredictionAdaptationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionAdaptationConfigurationError";
  }
}

export const PREDICTION_ADAPTATION_MODEL_VERSION = "esoccer-prediction-adaptation-v1.0.0-provisional";

const ALL_RECOMMENDATION_TYPES: RecommendationType[] = [
  "REDUCE_CONFIDENCE",
  "INCREASE_MONITORING",
  "TEMPORARILY_DISABLE_PROFILE",
  "PROFILE_STABLE",
  "PROFILE_IMPROVING",
  "NEEDS_MORE_DATA",
];

const ALL_RISK_LEVELS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export type RecommendationConfidenceMultipliers = Record<RecommendationType, number>;
export type RecommendationRiskLevels = Record<RecommendationType, RiskLevel>;

export interface PredictionAdaptationConfig {
  modelVersion: string;
  /** Fator de confiança sugerido (0–1) por tipo de recomendação — apenas
   * informativo, nunca aplicado automaticamente a uma previsão. */
  confidenceMultipliers: RecommendationConfidenceMultipliers;
  /** Nível de risco base por tipo de recomendação, antes de qualquer
   * escalonamento por confiabilidade baixa. */
  riskLevelByRecommendation: RecommendationRiskLevels;
  /** PROVISIONAL — score de confiabilidade (0–100) abaixo do qual
   * `RecommendationEngine` escala a recomendação para
   * `REDUCE_CONFIDENCE` mesmo sem um sinal de drift ativo (qualidade
   * absoluta baixa, não necessariamente uma mudança recente). */
  recommendationLowReliabilityThreshold: number;
  /** PROVISIONAL — score de confiabilidade (0–100) do perfil GLOBAL
   * abaixo do qual `StrategyEngine` nunca classifica o modelo como
   * `NORMAL` (no mínimo `WATCH`), mesmo sem drift ativo. */
  strategyLowReliabilityThreshold: number;
  /** PROVISIONAL — score de confiabilidade (0–100) abaixo do qual
   * `RiskAssessmentEngine` escala o nível de risco base em um degrau
   * (`LOW`→`MEDIUM`→`HIGH`→`CRITICAL`, nunca além de `CRITICAL`). */
  riskReliabilityFloor: number;
  /** Casas decimais aplicadas apenas na serialização do relatório —
   * nunca durante o cálculo interno. */
  decimalPlaces: number;
}

export const DEFAULT_CONFIDENCE_MULTIPLIERS: RecommendationConfidenceMultipliers = {
  PROFILE_STABLE: 1.0,
  PROFILE_IMPROVING: 1.0,
  INCREASE_MONITORING: 0.95,
  NEEDS_MORE_DATA: 0.9,
  REDUCE_CONFIDENCE: 0.8,
  TEMPORARILY_DISABLE_PROFILE: 0.5,
};

export const DEFAULT_RISK_LEVEL_BY_RECOMMENDATION: RecommendationRiskLevels = {
  PROFILE_STABLE: "LOW",
  PROFILE_IMPROVING: "LOW",
  NEEDS_MORE_DATA: "MEDIUM",
  INCREASE_MONITORING: "MEDIUM",
  REDUCE_CONFIDENCE: "HIGH",
  TEMPORARILY_DISABLE_PROFILE: "CRITICAL",
};

export const DEFAULT_PREDICTION_ADAPTATION_CONFIG: PredictionAdaptationConfig = {
  modelVersion: PREDICTION_ADAPTATION_MODEL_VERSION,
  confidenceMultipliers: DEFAULT_CONFIDENCE_MULTIPLIERS,
  riskLevelByRecommendation: DEFAULT_RISK_LEVEL_BY_RECOMMENDATION,
  recommendationLowReliabilityThreshold: 50,
  strategyLowReliabilityThreshold: 50,
  riskReliabilityFloor: 40,
  decimalPlaces: 4,
};

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isPercentageScore(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

/**
 * Valida a configuração antes do uso. Lança
 * `PredictionAdaptationConfigurationError` com uma mensagem estruturada
 * para a primeira violação encontrada; nunca "corrige" silenciosamente
 * uma configuração inválida.
 */
export function validatePredictionAdaptationConfig(config: PredictionAdaptationConfig): void {
  if (typeof config.modelVersion !== "string" || config.modelVersion.trim().length === 0) {
    throw new PredictionAdaptationConfigurationError("modelVersion deve ser uma string não vazia.");
  }

  if (typeof config.confidenceMultipliers !== "object" || config.confidenceMultipliers === null) {
    throw new PredictionAdaptationConfigurationError("confidenceMultipliers deve ser um objeto.");
  }
  for (const type of ALL_RECOMMENDATION_TYPES) {
    const value = config.confidenceMultipliers[type];
    if (!isFiniteNumber(value) || value < 0 || value > 1) {
      throw new PredictionAdaptationConfigurationError(`confidenceMultipliers.${type} deve ser um número finito entre 0 e 1.`);
    }
  }

  if (typeof config.riskLevelByRecommendation !== "object" || config.riskLevelByRecommendation === null) {
    throw new PredictionAdaptationConfigurationError("riskLevelByRecommendation deve ser um objeto.");
  }
  for (const type of ALL_RECOMMENDATION_TYPES) {
    const value = config.riskLevelByRecommendation[type];
    if (!ALL_RISK_LEVELS.includes(value)) {
      throw new PredictionAdaptationConfigurationError(`riskLevelByRecommendation.${type} deve ser um RiskLevel válido.`);
    }
  }

  if (!isPercentageScore(config.recommendationLowReliabilityThreshold)) {
    throw new PredictionAdaptationConfigurationError("recommendationLowReliabilityThreshold deve ser um número finito entre 0 e 100.");
  }
  if (!isPercentageScore(config.strategyLowReliabilityThreshold)) {
    throw new PredictionAdaptationConfigurationError("strategyLowReliabilityThreshold deve ser um número finito entre 0 e 100.");
  }
  if (!isPercentageScore(config.riskReliabilityFloor)) {
    throw new PredictionAdaptationConfigurationError("riskReliabilityFloor deve ser um número finito entre 0 e 100.");
  }

  if (!isNonNegativeInteger(config.decimalPlaces) || config.decimalPlaces > 15) {
    throw new PredictionAdaptationConfigurationError("decimalPlaces deve ser um inteiro entre 0 e 15.");
  }
}
