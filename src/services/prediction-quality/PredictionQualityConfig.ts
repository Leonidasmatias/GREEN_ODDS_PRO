// Fase 4 — Sprint 4.4 — Prediction Calibration & Quality Framework.
// Configuração centralizada: versão, granularidade das curvas de
// calibração e limiares de amostra mínima. Nenhum número mágico deve
// aparecer fora deste arquivo nos demais módulos do framework.
//
// PROVISIONAL — pending historical calibration: os limiares abaixo são
// julgamento de engenharia desta sprint — a mesma convenção já usada em
// `PredictionModelConfig.ts` (Sprint 4.1), `GoalDistributionConfig.ts`
// (Sprint 4.2) e `PredictionOrchestratorConfig.ts` (Sprint 4.3).

import { isFiniteNumber } from "./types.ts";

export class PredictionQualityConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionQualityConfigurationError";
  }
}

export const PREDICTION_QUALITY_MODEL_VERSION = "esoccer-prediction-quality-v1.0.0-provisional";

export interface PredictionQualityConfig {
  modelVersion: string;
  /** Quantidade de faixas (0..1) usadas pela curva de calibração
   * (probabilidade prevista vs acerto observado). */
  calibrationBucketCount: number;
  /** Quantidade de faixas (0..100) usadas pela confiabilidade de
   * confiança do Prediction Orchestrator. */
  confidenceBucketCount: number;
  /** Amostra mínima que uma faixa precisa ter para participar da
   * verificação de monotonicidade (faixas menores são reportadas mas
   * ignoradas na checagem, para não deixar ruído de amostra pequena
   * invalidar a avaliação inteira). */
  minSampleSizeForMonotonicityCheck: number;
  /** Amostra mínima do relatório inteiro abaixo da qual um aviso de
   * amostra insuficiente é adicionado — nunca bloqueia o relatório,
   * apenas o sinaliza. */
  minSampleSizeForReport: number;
}

export const DEFAULT_PREDICTION_QUALITY_CONFIG: PredictionQualityConfig = {
  modelVersion: PREDICTION_QUALITY_MODEL_VERSION,
  calibrationBucketCount: 10,
  confidenceBucketCount: 10,
  minSampleSizeForMonotonicityCheck: 5,
  minSampleSizeForReport: 10,
};

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value > 0;
}

/**
 * Valida a configuração antes do uso. Lança
 * `PredictionQualityConfigurationError` com uma mensagem estruturada para
 * a primeira violação encontrada; nunca "corrige" silenciosamente uma
 * configuração inválida.
 */
export function validatePredictionQualityConfig(config: PredictionQualityConfig): void {
  if (typeof config.modelVersion !== "string" || config.modelVersion.trim().length === 0) {
    throw new PredictionQualityConfigurationError("modelVersion deve ser uma string não vazia.");
  }
  if (!isPositiveInteger(config.calibrationBucketCount)) {
    throw new PredictionQualityConfigurationError("calibrationBucketCount deve ser um inteiro positivo finito.");
  }
  if (!isPositiveInteger(config.confidenceBucketCount)) {
    throw new PredictionQualityConfigurationError("confidenceBucketCount deve ser um inteiro positivo finito.");
  }
  if (!isFiniteNumber(config.minSampleSizeForMonotonicityCheck) || config.minSampleSizeForMonotonicityCheck < 0) {
    throw new PredictionQualityConfigurationError("minSampleSizeForMonotonicityCheck deve ser um número finito maior ou igual a zero.");
  }
  if (!isFiniteNumber(config.minSampleSizeForReport) || config.minSampleSizeForReport < 0) {
    throw new PredictionQualityConfigurationError("minSampleSizeForReport deve ser um número finito maior ou igual a zero.");
  }
}
