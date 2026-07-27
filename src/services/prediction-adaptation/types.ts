// Fase 5 — Sprint 5.2 — Adaptive Intelligence & Recommendation Framework.
// Tipos compartilhados. Nenhum tipo aqui depende do Prisma Client, rede ou
// relógio do sistema. Consome EXCLUSIVAMENTE a API pública da Sprint 5.1
// (`../prediction-learning/index.ts`) — nunca importa diretamente das
// Sprints 4.3/4.5, mesmo que a missão permita fazê-lo, porque tudo que é
// necessário já é reexportado transitivamente por `prediction-learning`.
// Isso satisfaz literalmente o critério de aceite "Integração apenas pelo
// LearningReport". Este módulo NUNCA recalibra probabilidades, altera
// Green Score, altera o Prediction Engine ou a Historical Evaluation —
// apenas consome dados já calculados e produz inteligência de apoio à
// decisão (recomendações, estratégia, ajuste de confiança sugerido e
// risco), nunca aplicada automaticamente.

import type {
  DriftSignal,
  HistoricalProfile,
  LearningReport,
  LearningStatus,
  ProfileDimension,
  ProfileKey,
  ReliabilityRanking,
} from "../prediction-learning/index.ts";
import type { PredictionAdaptationConfig } from "./PredictionAdaptationConfig.ts";

export type { DriftSignal, HistoricalProfile, LearningReport, LearningStatus, ProfileDimension, ProfileKey, ReliabilityRanking };

/** true somente para números finitos (rejeita NaN, +Infinity, -Infinity e não-números). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Busca o `reliabilityScore` de uma dimensão+chave em `reliabilityRanking`
 * — única fonte de verdade, reaproveitada por `RecommendationEngine` e
 * `RiskAssessmentEngine` (nunca duplicada por arquivo). `null` quando
 * nenhuma entrada corresponde (nunca fabricado como `0`). */
export function reliabilityScoreFor(reliabilityRanking: ReliabilityRanking, dimension: string, key: string): number | null {
  const entry = reliabilityRanking.entries.find((candidate) => candidate.dimension === dimension && candidate.key === key);
  return entry ? entry.reliabilityScore : null;
}

/**
 * Classificação técnica de apoio à decisão para uma dimensão+chave — NUNCA
 * uma recomendação de aposta, EV, ROI, Kelly ou stake. `TEMPORARILY_DISABLE_PROFILE`
 * é a mais severa (amostra crítica/drift crítico); `PROFILE_STABLE` é o
 * estado padrão na ausência de qualquer sinal relevante.
 */
export type RecommendationType =
  | "REDUCE_CONFIDENCE"
  | "INCREASE_MONITORING"
  | "TEMPORARILY_DISABLE_PROFILE"
  | "PROFILE_STABLE"
  | "PROFILE_IMPROVING"
  | "NEEDS_MORE_DATA";

/**
 * Uma recomendação técnica para uma dimensão+chave, derivada
 * deterministicamente do status do perfil (Sprint 5.1), dos sinais de
 * drift associados e do score de confiabilidade — nunca de dados
 * inventados. `triggeredBySignalIds` contém os `DriftSignal.id`
 * (ordenados) que embasam a recomendação; vazio quando nenhum sinal de
 * drift está associado (ex.: `PROFILE_STABLE` sem histórico de drift).
 */
export type Recommendation = {
  dimension: ProfileDimension;
  key: ProfileKey;
  type: RecommendationType;
  reason: string;
  triggeredBySignalIds: string[];
};

/** Estado geral do modelo — NUNCA uma decisão de aposta, apenas um
 * indicador técnico de quão de perto o modelo deveria ser observado. */
export type StrategyStatus = "NORMAL" | "WATCH" | "WARNING" | "CRITICAL";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Nível de risco técnico de uma dimensão+chave. `reliabilityScore` é
 * `null` quando nenhuma entrada de ranking corresponde a essa
 * dimensão+chave (nunca fabricado como `0`).
 */
export type RiskAssessment = {
  dimension: ProfileDimension;
  key: ProfileKey;
  level: RiskLevel;
  reliabilityScore: number | null;
};

/**
 * Fator de confiança sugerido (não aplicado automaticamente — apenas
 * informativo) derivado unicamente do `RecommendationType` via
 * `config.confidenceMultipliers`. NUNCA altera as probabilidades reais de
 * uma previsão.
 */
export type ConfidenceAdjustment = {
  dimension: ProfileDimension;
  key: ProfileKey;
  recommendationType: RecommendationType;
  suggestedMultiplier: number;
};

/** Consolidação, por dimensão+chave, da recomendação + ajuste de
 * confiança sugerido + avaliação de risco — a unidade de saída principal
 * do relatório. */
export type AdaptiveDecision = {
  dimension: ProfileDimension;
  key: ProfileKey;
  recommendation: Recommendation;
  confidenceAdjustment: ConfidenceAdjustment;
  riskAssessment: RiskAssessment;
};

export type AdaptiveReportOptions = {
  reportId: string;
  generatedAt?: string | null;
};

/**
 * Relatório final, serializável. `reportId`/`generatedAt` nunca são
 * gerados por este módulo — sempre fornecidos pelo chamador.
 * `sourceReportId`/`sourceStatus` referenciam o `LearningReport` (Sprint
 * 5.1) que originou esta análise, para rastreabilidade. Nenhuma função
 * deste framework lê `Date.now()`, `Math.random()` ou gera UUID.
 */
export type AdaptiveReport = {
  reportId: string;
  generatedAt: string | null;
  modelVersion: string;
  config: PredictionAdaptationConfig;
  sourceReportId: string;
  sourceStatus: LearningStatus;
  strategyStatus: StrategyStatus;
  decisions: AdaptiveDecision[];
};
