// Fase 4 — Sprint 4.1 — Prediction Engine Foundation.
// Configuração centralizada do modelo: versão, pesos e limiares de
// suficiência de dados. Nenhum número mágico deve aparecer fora deste
// arquivo nos demais módulos do Prediction Engine.
//
// PROVISIONAL — pending historical calibration: todos os pesos, a
// temperatura do softmax e os limiares de suficiência de dados abaixo são
// julgamento de engenharia desta sprint, não resultado de backtest com
// dados reais de eSoccer. Serão recalibrados quando houver amostra real
// liquidada suficiente, seguindo a mesma convenção já usada em
// MomentumEngine/StrengthEngine/ConfidenceEngine/GreenScoreEngine (Fase 1.5)
// e no EsoccerClassifier/DataQualityEngine (Fases 3/3.5).

export class PredictionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionConfigurationError";
  }
}

/**
 * Versão explícita do modelo, centralizada em um único lugar. Deve mudar
 * sempre que features, pesos, fórmula ou normalização forem alterados de
 * forma que o resultado numérico deixe de ser comparável ao de versões
 * anteriores.
 */
export const PREDICTION_MODEL_VERSION = "esoccer-outcome-v1.0.0-provisional";

/**
 * Pesos de combinação das oito features do modelo (sete de tilt
 * casa/visitante + o componente de empate). Todos devem ser finitos e
 * não-negativos: um peso negativo inverteria semanticamente o significado
 * da feature (ex.: rating maior do mandante passaria a favorecer o
 * visitante), o que não é uma configuração válida para este modelo.
 */
export interface PredictionModelWeights {
  ratingDifference: number;
  formDifference: number;
  strengthDifference: number;
  momentumDifference: number;
  homeAdvantage: number;
  headToHead: number;
  greenScoreDifference: number;
  drawBalance: number;
}

/**
 * Limiares (escala 0..100, mesma escala de ConfidenceEngine.confidenceScore)
 * usados pelo avaliador de suficiência de dados para classificar a amostra
 * disponível. `minHomeAwaySampleSize` é o número mínimo de partidas
 * mandante/visitante exigido para que a feature `homeAdvantage` e o
 * respectivo componente de suficiência sejam considerados disponíveis.
 */
export interface DataSufficiencyThresholds {
  minConfidenceForLimited: number;
  minConfidenceForSufficient: number;
  minConfidenceForStrong: number;
  minHomeAwaySampleSize: number;
}

export interface PredictionModelConfig {
  modelVersion: string;
  weights: PredictionModelWeights;
  /** Temperatura do softmax (>0). Valores maiores produzem distribuições
   * mais achatadas (menos extremas); valores menores, mais extremas. */
  temperature: number;
  /** Janela de forma (FormEngine) usada como sinal de "forma recente" no
   * modelo. Deve corresponder a uma das três janelas padrão do Módulo 2. */
  formWindow: 5 | 10 | 20;
  dataSufficiencyThresholds: DataSufficiencyThresholds;
}

export const DEFAULT_PREDICTION_MODEL_WEIGHTS: PredictionModelWeights = {
  ratingDifference: 1.1,
  formDifference: 0.8,
  strengthDifference: 1.0,
  momentumDifference: 0.5,
  homeAdvantage: 0.3,
  headToHead: 0.6,
  greenScoreDifference: 0.7,
  drawBalance: 1.0,
};

export const DEFAULT_DATA_SUFFICIENCY_THRESHOLDS: DataSufficiencyThresholds = {
  minConfidenceForLimited: 25,
  minConfidenceForSufficient: 50,
  minConfidenceForStrong: 75,
  minHomeAwaySampleSize: 3,
};

export const DEFAULT_PREDICTION_MODEL_CONFIG: PredictionModelConfig = {
  modelVersion: PREDICTION_MODEL_VERSION,
  weights: DEFAULT_PREDICTION_MODEL_WEIGHTS,
  temperature: 4,
  formWindow: 10,
  dataSufficiencyThresholds: DEFAULT_DATA_SUFFICIENCY_THRESHOLDS,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Valida uma configuração do modelo antes do uso. Lança
 * `PredictionConfigurationError` com uma mensagem estruturada para a
 * primeira violação encontrada; nunca "corrige" silenciosamente uma
 * configuração inválida.
 */
export function validatePredictionModelConfig(config: PredictionModelConfig): void {
  if (typeof config.modelVersion !== "string" || config.modelVersion.trim().length === 0) {
    throw new PredictionConfigurationError("modelVersion deve ser uma string não vazia.");
  }

  if (!isFiniteNumber(config.temperature) || config.temperature <= 0) {
    throw new PredictionConfigurationError("temperature deve ser um número finito maior que zero.");
  }

  if (![5, 10, 20].includes(config.formWindow)) {
    throw new PredictionConfigurationError("formWindow deve ser 5, 10 ou 20.");
  }

  const weightEntries = Object.entries(config.weights) as [keyof PredictionModelWeights, number][];
  for (const [name, value] of weightEntries) {
    if (!isFiniteNumber(value) || value < 0) {
      throw new PredictionConfigurationError(
        `weights.${name} deve ser um número finito maior ou igual a zero (recebido: ${String(value)}).`,
      );
    }
  }

  const thresholds = config.dataSufficiencyThresholds;
  const { minConfidenceForLimited, minConfidenceForSufficient, minConfidenceForStrong } = thresholds;

  for (const [name, value] of Object.entries(thresholds)) {
    if (!isFiniteNumber(value) || value < 0) {
      throw new PredictionConfigurationError(
        `dataSufficiencyThresholds.${name} deve ser um número finito maior ou igual a zero (recebido: ${String(value)}).`,
      );
    }
  }

  if (!(minConfidenceForLimited < minConfidenceForSufficient && minConfidenceForSufficient < minConfidenceForStrong)) {
    throw new PredictionConfigurationError(
      "dataSufficiencyThresholds deve satisfazer minConfidenceForLimited < minConfidenceForSufficient < minConfidenceForStrong.",
    );
  }

  if (minConfidenceForStrong > 100) {
    throw new PredictionConfigurationError("dataSufficiencyThresholds.minConfidenceForStrong não pode exceder 100.");
  }
}
