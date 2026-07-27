// Fase 5 — Sprint 5.3 — Intelligence Observability & Monitoring Framework.
// Configuração centralizada: limiares de alerta, limiares de tendência e
// limites de linha do tempo. Nenhum número mágico deve aparecer fora
// deste arquivo nos demais módulos do framework — lição aplicada
// diretamente das auditorias das Sprints 5.1/5.2.
//
// PROVISIONAL — pending historical calibration: os valores abaixo são
// julgamento de engenharia desta sprint — a mesma convenção já usada em
// todas as configs anteriores (Sprints 4.1–5.2).

import { ALL_RECOMMENDATION_TYPES, isFiniteNumber } from "./types.ts";
import type { MonitoringStatus, RecommendationType } from "./types.ts";

export class PredictionObservabilityConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionObservabilityConfigurationError";
  }
}

export const PREDICTION_OBSERVABILITY_MODEL_VERSION = "esoccer-prediction-observability-v1.0.0-provisional";

const ALL_MONITORING_STATUSES: MonitoringStatus[] = ["STABLE", "WARNING", "CRITICAL", "IMPROVING", "DISABLED", "NEW"];

export type MonitoringStatusByRecommendation = Record<RecommendationType, MonitoringStatus>;

export interface PredictionObservabilityConfig {
  modelVersion: string;
  /** PROVISIONAL — score de confiabilidade (0–100) abaixo do qual
   * `AlertEngine` emite um alerta `LOW_RELIABILITY`. */
  lowReliabilityAlertThreshold: number;
  /** PROVISIONAL — quantidade mínima de métricas distintas com sinal de
   * degradação simultâneo para `TrendAnalysisEngine` classificar um
   * perfil como `CONTINUOUS_DRIFT` (em vez de uma degradação isolada). */
  continuousDriftMinMetricCount: number;
  /** PROVISIONAL — score de confiabilidade (0–100) abaixo do qual um
   * perfil com sinal de melhoria é classificado como `RECOVERY` (ainda
   * não plenamente estável) em vez de simplesmente estável/melhorando. */
  recoveryReliabilityThreshold: number;
  /** Quantidade máxima de eventos retidos em `TimelineEngine` — corte
   * determinístico (mantém os primeiros N após a ordenação canônica),
   * nunca trunca de forma a corromper médias ou contagens do dashboard
   * (que nunca dependem da timeline). */
  maxTimelineEvents: number;
  /** Mapeamento determinístico de `RecommendationType` (Sprint 5.2) para
   * `MonitoringStatus` — nunca recalculado a partir de sinais brutos. */
  monitoringStatusByRecommendation: MonitoringStatusByRecommendation;
  /** Casas decimais aplicadas apenas na serialização do relatório —
   * nunca durante o cálculo interno. */
  decimalPlaces: number;
}

export const DEFAULT_MONITORING_STATUS_BY_RECOMMENDATION: MonitoringStatusByRecommendation = {
  PROFILE_STABLE: "STABLE",
  PROFILE_IMPROVING: "IMPROVING",
  INCREASE_MONITORING: "WARNING",
  REDUCE_CONFIDENCE: "CRITICAL",
  TEMPORARILY_DISABLE_PROFILE: "DISABLED",
  NEEDS_MORE_DATA: "NEW",
};

export const DEFAULT_PREDICTION_OBSERVABILITY_CONFIG: PredictionObservabilityConfig = {
  modelVersion: PREDICTION_OBSERVABILITY_MODEL_VERSION,
  lowReliabilityAlertThreshold: 50,
  continuousDriftMinMetricCount: 2,
  recoveryReliabilityThreshold: 50,
  maxTimelineEvents: 500,
  monitoringStatusByRecommendation: DEFAULT_MONITORING_STATUS_BY_RECOMMENDATION,
  decimalPlaces: 4,
};

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 1;
}

function isPercentageScore(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

/**
 * Valida a configuração antes do uso. Lança
 * `PredictionObservabilityConfigurationError` com uma mensagem
 * estruturada para a primeira violação encontrada; nunca "corrige"
 * silenciosamente uma configuração inválida.
 */
export function validatePredictionObservabilityConfig(config: PredictionObservabilityConfig): void {
  if (typeof config.modelVersion !== "string" || config.modelVersion.trim().length === 0) {
    throw new PredictionObservabilityConfigurationError("modelVersion deve ser uma string não vazia.");
  }

  if (!isPercentageScore(config.lowReliabilityAlertThreshold)) {
    throw new PredictionObservabilityConfigurationError("lowReliabilityAlertThreshold deve ser um número finito entre 0 e 100.");
  }
  if (!isPositiveInteger(config.continuousDriftMinMetricCount)) {
    throw new PredictionObservabilityConfigurationError("continuousDriftMinMetricCount deve ser um inteiro maior ou igual a 1.");
  }
  if (!isPercentageScore(config.recoveryReliabilityThreshold)) {
    throw new PredictionObservabilityConfigurationError("recoveryReliabilityThreshold deve ser um número finito entre 0 e 100.");
  }
  if (!isNonNegativeInteger(config.maxTimelineEvents)) {
    throw new PredictionObservabilityConfigurationError("maxTimelineEvents deve ser um inteiro maior ou igual a zero.");
  }

  if (typeof config.monitoringStatusByRecommendation !== "object" || config.monitoringStatusByRecommendation === null) {
    throw new PredictionObservabilityConfigurationError("monitoringStatusByRecommendation deve ser um objeto.");
  }
  for (const type of ALL_RECOMMENDATION_TYPES) {
    const value = config.monitoringStatusByRecommendation[type];
    if (!ALL_MONITORING_STATUSES.includes(value)) {
      throw new PredictionObservabilityConfigurationError(`monitoringStatusByRecommendation.${type} deve ser um MonitoringStatus válido.`);
    }
  }

  if (!isNonNegativeInteger(config.decimalPlaces) || config.decimalPlaces > 15) {
    throw new PredictionObservabilityConfigurationError("decimalPlaces deve ser um inteiro entre 0 e 15.");
  }
}
