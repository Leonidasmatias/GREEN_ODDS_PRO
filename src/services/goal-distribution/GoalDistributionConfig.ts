// Fase 4 — Sprint 4.2 — Goal Distribution Engine Foundation.
// Configuração centralizada do modelo: versão, pesos, limites de lambda,
// suavização (shrinkage), linhas de Over/Under e limiares de suficiência
// de dados. Nenhum número mágico deve aparecer fora deste arquivo nos
// demais módulos do Goal Distribution Engine.
//
// PROVISIONAL — pending historical calibration: todos os pesos, limites de
// lambda, parâmetros de suavização e limiares abaixo são julgamento de
// engenharia desta sprint, não resultado de backtest com dados reais de
// eSoccer. Serão recalibrados quando houver amostra real liquidada
// suficiente — a mesma convenção já usada em
// `src/services/prediction/PredictionModelConfig.ts` (Sprint 4.1).

import type { DataSufficiencyThresholds } from "../prediction/index.ts";
import { isFiniteNumber } from "./types.ts";

export class GoalDistributionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoalDistributionConfigurationError";
  }
}

/**
 * Versão explícita do modelo, centralizada em um único lugar. Deve mudar
 * sempre que features, pesos, fórmula, suavização ou normalização forem
 * alterados de forma que o resultado numérico deixe de ser comparável ao
 * de versões anteriores.
 */
export const GOAL_DISTRIBUTION_MODEL_VERSION = "esoccer-goal-distribution-v1.0.0-provisional";

/**
 * Pesos de combinação das cinco features do Expected Goals Engine. Todos
 * devem ser finitos e não-negativos: um peso negativo inverteria
 * semanticamente o significado da feature (mais forma recente reduzindo
 * gols esperados, por exemplo), o que não é uma configuração válida.
 */
export interface GoalDistributionModelWeights {
  recentForm: number;
  homeAwaySplit: number;
  headToHead: number;
  momentum: number;
  strength: number;
}

/**
 * Parâmetros de suavização (shrinkage) aplicados a cada taxa observada
 * antes da combinação, na forma:
 *
 *   adjustedRate = sampleWeight * observedRate + (1 - sampleWeight) * conservativeBaselineGoalsPerMatch
 *   sampleWeight = clamp(matchesCount / fullConfidenceSampleSize, 0, 1)
 *
 * Uma amostra de `fullConfidenceSampleSize` partidas ou mais é tratada como
 * totalmente confiável (`sampleWeight = 1`); menos que isso é misturado
 * proporcionalmente com a linha de base conservadora.
 */
export interface GoalDistributionShrinkageConfig {
  fullConfidenceSampleSize: number;
  conservativeBaselineGoalsPerMatch: number;
}

export interface GoalDistributionConfig {
  modelVersion: string;
  weights: GoalDistributionModelWeights;
  /** Limite inferior de lambda (>0) aplicado após toda a estimativa —
   * garante que nenhum expectedGoals seja zero absoluto. */
  minLambda: number;
  /** Limite superior de lambda — evita distribuições degeneradas quando
   * sinais de entrada são extremos. */
  maxLambda: number;
  /** Quantidade máxima de gols por jogador considerada na distribuição de
   * Poisson e na matriz de placares (suporta, no mínimo, 0..10). */
  maxGoalsPerPlayer: number;
  /** Quantidade padrão de placares exatos retornados em `topExactScores`. */
  defaultTopExactScores: number;
  /** Linhas padrão de Over/Under (todas terminadas em .5). */
  overUnderLines: number[];
  /** Reaproveitado da Sprint 4.1 (`PredictionDataSufficiency`) — mesmo
   * conceito e mesma escala (0..100, baseada em `ConfidenceEngine`), nunca
   * redefinido. `minHomeAwaySampleSize` também governa o gate da feature
   * `homeAwaySplit` do Expected Goals Engine. */
  dataSufficiencyThresholds: DataSufficiencyThresholds;
  shrinkage: GoalDistributionShrinkageConfig;
  /** Liga/desliga inteiramente a feature `headToHead`, independente de
   * `weights.headToHead` ou da amostra disponível — quando `false`, o H2H
   * nunca é consultado para a estimativa de gols (fica `NOT_APPLICABLE`),
   * mesmo que haja histórico de confronto direto. */
  headToHeadEnabled: boolean;
  /** Teto rígido para `weights.headToHead` — H2H nunca pode, por
   * configuração, dominar a estimativa de gols sozinho. */
  maxHeadToHeadWeight: number;
  /** Usado apenas quando NENHUM sinal de gols está disponível para um
   * lado (ex.: os dois jogadores são estreantes) — nunca zero absoluto. */
  fallbackBaseGoalsPerPlayer: number;
  /** Teto (em gols/partida) para o ajuste secundário de momentum —
   * mantém esse sinal indireto estritamente limitado. */
  maxMomentumGoalsAdjustment: number;
  /** Teto (em gols/partida) para o ajuste secundário de força
   * (ataque/defesa) — mantém esse sinal indireto estritamente limitado. */
  maxStrengthGoalsAdjustment: number;
  /** Tolerância aceita ao validar que somas de probabilidades públicas
   * (matriz de placares, Over/Under, BTTS, 1X2 derivado) ficam a, no
   * máximo, esta distância de 1. */
  normalizationTolerance: number;
}

export const DEFAULT_GOAL_DISTRIBUTION_WEIGHTS: GoalDistributionModelWeights = {
  recentForm: 1.0,
  homeAwaySplit: 0.8,
  headToHead: 0.5,
  momentum: 0.2,
  strength: 0.3,
};

export const DEFAULT_GOAL_DISTRIBUTION_DATA_SUFFICIENCY_THRESHOLDS: DataSufficiencyThresholds = {
  minConfidenceForLimited: 25,
  minConfidenceForSufficient: 50,
  minConfidenceForStrong: 75,
  minHomeAwaySampleSize: 3,
};

export const DEFAULT_GOAL_DISTRIBUTION_SHRINKAGE: GoalDistributionShrinkageConfig = {
  fullConfidenceSampleSize: 20,
  conservativeBaselineGoalsPerMatch: 1.3,
};

export const DEFAULT_OVER_UNDER_LINES: number[] = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5];

export const DEFAULT_GOAL_DISTRIBUTION_CONFIG: GoalDistributionConfig = {
  modelVersion: GOAL_DISTRIBUTION_MODEL_VERSION,
  weights: DEFAULT_GOAL_DISTRIBUTION_WEIGHTS,
  minLambda: 0.05,
  maxLambda: 6,
  maxGoalsPerPlayer: 10,
  defaultTopExactScores: 10,
  overUnderLines: DEFAULT_OVER_UNDER_LINES,
  dataSufficiencyThresholds: DEFAULT_GOAL_DISTRIBUTION_DATA_SUFFICIENCY_THRESHOLDS,
  shrinkage: DEFAULT_GOAL_DISTRIBUTION_SHRINKAGE,
  headToHeadEnabled: true,
  maxHeadToHeadWeight: 0.6,
  fallbackBaseGoalsPerPlayer: 1.3,
  maxMomentumGoalsAdjustment: 0.4,
  maxStrengthGoalsAdjustment: 0.4,
  normalizationTolerance: 1e-9,
};

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value > 0;
}

/** Uma linha "x.5" válida: finita, positiva, e cuja parte fracionária é
 * exatamente 0.5 (rejeita linhas inteiras e .25, fora do escopo desta
 * sprint). */
function isHalfLine(value: unknown): value is number {
  if (!isFiniteNumber(value) || value <= 0) return false;
  return Math.abs(value - (Math.floor(value) + 0.5)) < 1e-9;
}

/**
 * Valida uma configuração do modelo antes do uso. Lança
 * `GoalDistributionConfigurationError` com uma mensagem estruturada para a
 * primeira violação encontrada; nunca "corrige" silenciosamente uma
 * configuração inválida.
 */
export function validateGoalDistributionConfig(config: GoalDistributionConfig): void {
  if (typeof config.modelVersion !== "string" || config.modelVersion.trim().length === 0) {
    throw new GoalDistributionConfigurationError("modelVersion deve ser uma string não vazia.");
  }

  const weightEntries = Object.entries(config.weights) as [keyof GoalDistributionModelWeights, number][];
  for (const [name, value] of weightEntries) {
    if (!isFiniteNumber(value) || value < 0) {
      throw new GoalDistributionConfigurationError(
        `weights.${name} deve ser um número finito maior ou igual a zero (recebido: ${String(value)}).`,
      );
    }
  }

  if (!isFiniteNumber(config.minLambda) || config.minLambda <= 0) {
    throw new GoalDistributionConfigurationError("minLambda deve ser um número finito maior que zero.");
  }

  if (!isFiniteNumber(config.maxLambda) || config.maxLambda <= config.minLambda) {
    throw new GoalDistributionConfigurationError("maxLambda deve ser um número finito maior que minLambda.");
  }

  if (!isPositiveInteger(config.maxGoalsPerPlayer)) {
    throw new GoalDistributionConfigurationError("maxGoalsPerPlayer deve ser um inteiro positivo finito.");
  }

  const totalPossibleScores = (config.maxGoalsPerPlayer + 1) * (config.maxGoalsPerPlayer + 1);
  if (!isPositiveInteger(config.defaultTopExactScores) || config.defaultTopExactScores > totalPossibleScores) {
    throw new GoalDistributionConfigurationError(
      `defaultTopExactScores deve ser um inteiro positivo finito e não pode exceder o total de placares possíveis (${totalPossibleScores}).`,
    );
  }

  if (!Array.isArray(config.overUnderLines) || config.overUnderLines.length === 0) {
    throw new GoalDistributionConfigurationError("overUnderLines deve ser um array não vazio.");
  }
  const seenLines = new Set<number>();
  for (const line of config.overUnderLines) {
    if (!isHalfLine(line)) {
      throw new GoalDistributionConfigurationError(
        `overUnderLines contém uma linha inválida (${String(line)}) — cada linha deve ser finita, positiva e terminar em .5.`,
      );
    }
    if (seenLines.has(line)) {
      throw new GoalDistributionConfigurationError(`overUnderLines contém uma linha duplicada (${String(line)}).`);
    }
    seenLines.add(line);
  }

  const thresholds = config.dataSufficiencyThresholds;
  for (const [name, value] of Object.entries(thresholds)) {
    if (!isFiniteNumber(value) || value < 0) {
      throw new GoalDistributionConfigurationError(
        `dataSufficiencyThresholds.${name} deve ser um número finito maior ou igual a zero (recebido: ${String(value)}).`,
      );
    }
  }
  const { minConfidenceForLimited, minConfidenceForSufficient, minConfidenceForStrong } = thresholds;
  if (!(minConfidenceForLimited < minConfidenceForSufficient && minConfidenceForSufficient < minConfidenceForStrong)) {
    throw new GoalDistributionConfigurationError(
      "dataSufficiencyThresholds deve satisfazer minConfidenceForLimited < minConfidenceForSufficient < minConfidenceForStrong.",
    );
  }
  if (minConfidenceForStrong > 100) {
    throw new GoalDistributionConfigurationError("dataSufficiencyThresholds.minConfidenceForStrong não pode exceder 100.");
  }

  if (!isFiniteNumber(config.shrinkage.fullConfidenceSampleSize) || config.shrinkage.fullConfidenceSampleSize <= 0) {
    throw new GoalDistributionConfigurationError("shrinkage.fullConfidenceSampleSize deve ser um número finito maior que zero.");
  }
  if (
    !isFiniteNumber(config.shrinkage.conservativeBaselineGoalsPerMatch) ||
    config.shrinkage.conservativeBaselineGoalsPerMatch <= 0
  ) {
    throw new GoalDistributionConfigurationError(
      "shrinkage.conservativeBaselineGoalsPerMatch deve ser um número finito maior que zero.",
    );
  }

  if (typeof config.headToHeadEnabled !== "boolean") {
    throw new GoalDistributionConfigurationError("headToHeadEnabled deve ser um booleano.");
  }

  if (!isFiniteNumber(config.maxHeadToHeadWeight) || config.maxHeadToHeadWeight < 0) {
    throw new GoalDistributionConfigurationError("maxHeadToHeadWeight deve ser um número finito maior ou igual a zero.");
  }
  if (config.weights.headToHead > config.maxHeadToHeadWeight) {
    throw new GoalDistributionConfigurationError(
      `weights.headToHead (${config.weights.headToHead}) não pode exceder maxHeadToHeadWeight (${config.maxHeadToHeadWeight}).`,
    );
  }

  if (!isFiniteNumber(config.fallbackBaseGoalsPerPlayer) || config.fallbackBaseGoalsPerPlayer <= 0) {
    throw new GoalDistributionConfigurationError("fallbackBaseGoalsPerPlayer deve ser um número finito maior que zero.");
  }

  if (!isFiniteNumber(config.maxMomentumGoalsAdjustment) || config.maxMomentumGoalsAdjustment < 0) {
    throw new GoalDistributionConfigurationError("maxMomentumGoalsAdjustment deve ser um número finito maior ou igual a zero.");
  }
  if (!isFiniteNumber(config.maxStrengthGoalsAdjustment) || config.maxStrengthGoalsAdjustment < 0) {
    throw new GoalDistributionConfigurationError("maxStrengthGoalsAdjustment deve ser um número finito maior ou igual a zero.");
  }

  if (
    !isFiniteNumber(config.normalizationTolerance) ||
    config.normalizationTolerance <= 0 ||
    config.normalizationTolerance > 1
  ) {
    throw new GoalDistributionConfigurationError("normalizationTolerance deve ser um número finito no intervalo (0, 1].");
  }
}
