// Fase 5 — Sprint 5.3 — Intelligence Observability & Monitoring Framework.
// Tipos compartilhados. Nenhum tipo aqui depende do Prisma Client, rede ou
// relógio do sistema. Consome EXCLUSIVAMENTE as APIs públicas de
// `prediction-learning` (Sprint 5.1) e `prediction-adaptation` (Sprint
// 5.2) — nunca arquivos internos dessas sprints. Este módulo NUNCA
// recalcula qualquer métrica, previsão, Green Score, drift, recomendação
// ou decisão adaptativa — apenas observa, mede, organiza e apresenta o
// que já foi calculado.

import type {
  DriftSignal,
  DriftSignalType,
  HistoricalProfile,
  LearningReport,
  LearningStatus,
  ProfileDimension,
  ProfileKey,
  ReliabilityRanking,
} from "../prediction-learning/index.ts";
import type { AdaptiveReport, ConfidenceAdjustment, Recommendation, RecommendationType, RiskAssessment, StrategyStatus } from "../prediction-adaptation/index.ts";
import type { PredictionObservabilityConfig } from "./PredictionObservabilityConfig.ts";

export type { DriftSignal, DriftSignalType, HistoricalProfile, LearningReport, LearningStatus, ProfileDimension, ProfileKey, ReliabilityRanking };
export type { AdaptiveReport, ConfidenceAdjustment, Recommendation, RecommendationType, RiskAssessment, StrategyStatus };

/** true somente para números finitos (rejeita NaN, +Infinity, -Infinity e não-números). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Chave de agrupamento por dimensão+chave — única fonte de verdade,
 * reaproveitada por todos os engines deste módulo (nunca duplicada por
 * arquivo). */
export function profileMapKey(dimension: string, key: string): string {
  return `${dimension}::${key}`;
}

/** Agrupa `DriftSignal[]` por dimensão+chave — única fonte de verdade,
 * reaproveitada por `ProfileMonitoringEngine` e `TrendAnalysisEngine`. */
export function groupSignalsByProfile(driftSignals: DriftSignal[]): Map<string, DriftSignal[]> {
  const groups = new Map<string, DriftSignal[]>();
  for (const signal of driftSignals) {
    const mapKey = profileMapKey(signal.dimension, signal.key);
    const bucket = groups.get(mapKey);
    if (bucket) bucket.push(signal);
    else groups.set(mapKey, [signal]);
  }
  return groups;
}

/** Busca o `reliabilityScore` de uma dimensão+chave em
 * `reliabilityRanking` — única fonte de verdade, reaproveitada por
 * `TrendAnalysisEngine`. `null` quando nenhuma entrada corresponde
 * (nunca fabricado como `0`). */
export function reliabilityScoreFor(reliabilityRanking: ReliabilityRanking, dimension: string, key: string): number | null {
  const entry = reliabilityRanking.entries.find((candidate) => candidate.dimension === dimension && candidate.key === key);
  return entry ? entry.reliabilityScore : null;
}

/** Classificação de monitoramento derivada UNICAMENTE de
 * `Recommendation.type` (Sprint 5.2), via
 * `config.monitoringStatusByRecommendation` — nunca recalculada a partir
 * de sinais brutos. `NEW` cobre tanto `NEEDS_MORE_DATA` quanto a ausência
 * defensiva de uma recomendação correspondente. */
export type MonitoringStatus = "STABLE" | "WARNING" | "CRITICAL" | "IMPROVING" | "DISABLED" | "NEW";

/** Lista completa de `RecommendationType` (Sprint 5.2) — única fonte de
 * verdade, reaproveitada por `PredictionObservabilityConfig.ts` (validação)
 * e `DashboardMetricsEngine.ts` (distribuição completa, incluindo zeros),
 * nunca duplicada por arquivo. */
export const ALL_RECOMMENDATION_TYPES: RecommendationType[] = [
  "REDUCE_CONFIDENCE",
  "INCREASE_MONITORING",
  "TEMPORARILY_DISABLE_PROFILE",
  "PROFILE_STABLE",
  "PROFILE_IMPROVING",
  "NEEDS_MORE_DATA",
];

/**
 * Consolidação, por dimensão+chave, de tudo que já foi calculado pelas
 * Sprints 5.1/5.2 para aquele perfil — histórico, drift, confiabilidade,
 * recomendação, risco, ajuste de confiança e estratégia (denormalizada,
 * mesmo valor global em todas as entradas). `recommendation`/
 * `riskAssessment`/`confidenceAdjustment` são `null` apenas quando o
 * `AdaptiveReport` fornecido não contém uma decisão correspondente
 * (nunca fabricados).
 */
export type MonitoringProfile = {
  dimension: ProfileDimension;
  key: ProfileKey;
  profile: HistoricalProfile;
  driftSignals: DriftSignal[];
  reliabilityScore: number | null;
  recommendation: Recommendation | null;
  riskAssessment: RiskAssessment | null;
  confidenceAdjustment: ConfidenceAdjustment | null;
  strategyStatus: StrategyStatus;
  status: MonitoringStatus;
};

/**
 * Tendência técnica de um perfil — derivada apenas dos sinais de drift já
 * detectados e da série histórica já calculada (Sprint 5.1), nunca de
 * previsão futura. Como `LearningReport` carrega apenas UM par de janelas
 * (baseline/current), a tendência reflete essa única comparação — nunca
 * uma série multi-ponto inventada.
 */
export type TrendType =
  | "INCREASING_STABILITY"
  | "DECREASING_STABILITY"
  | "CONTINUOUS_DRIFT"
  | "RECOVERY"
  | "DETERIORATION"
  | "NEWLY_CREATED_PROFILE";

export type TrendAnalysisEntry = {
  dimension: ProfileDimension;
  key: ProfileKey;
  trend: TrendType;
  reason: string;
};

export type AlertLevel = "INFO" | "WARNING" | "CRITICAL";

export type AlertType =
  | "DRIFT_CRITICAL"
  | "LOW_RELIABILITY"
  | "PROFILE_DISABLED"
  | "HIGH_RISK"
  | "IMPROVING_PROFILE"
  | "NEW_PROFILE"
  | "SAMPLE_TOO_SMALL";

/** Alerta técnico — puramente informativo. Este módulo NUNCA executa
 * ações a partir de um alerta. */
export type TechnicalAlert = {
  id: string;
  dimension: ProfileDimension;
  key: ProfileKey;
  type: AlertType;
  level: AlertLevel;
  message: string;
};

export type DashboardMetrics = {
  totalProfiles: number;
  monitoredProfiles: number;
  stableProfiles: number;
  warningProfiles: number;
  criticalProfiles: number;
  improvingProfiles: number;
  disabledProfiles: number;
  averageReliability: number;
  averageRisk: number;
  averageConfidenceMultiplier: number;
  driftDistribution: Record<DriftSignalType, number>;
  recommendationDistribution: Record<RecommendationType, number>;
};

export type TimelineEventType = "STRATEGY_CHANGE" | "RISK_CHANGE" | "RELIABILITY_CHANGE" | "RECOMMENDATION_CHANGE" | "DRIFT_CHANGE";

/**
 * Um evento de linha do tempo. `timestamp` é SEMPRE fornecido pelo
 * chamador (`ObservabilityReportOptions.timelineTimestamp`), nunca
 * `Date.now()`. Como cada chamada de `buildObservabilityReport` observa
 * apenas UM par de janelas, os eventos representam o estado OBSERVADO
 * nesta chamada — nunca uma mudança inferida sem uma linha de base real
 * (a exceção é `DRIFT_CHANGE`, que já representa um delta real entre
 * janelas, calculado pela Sprint 5.1).
 */
export type TimelineEvent = {
  timestamp: string | null;
  dimension: ProfileDimension | null;
  key: ProfileKey | null;
  type: TimelineEventType;
  description: string;
};

export type ObservabilityReportOptions = {
  reportId: string;
  generatedAt?: string | null;
  timelineTimestamp?: string | null;
};

export type ObservabilityReportMetadata = {
  sourceLearningReportId: string;
  sourceAdaptiveReportId: string;
  sourceLearningStatus: LearningStatus;
  sourceStrategyStatus: StrategyStatus;
};

/**
 * Relatório final, serializável. `reportId`/`generatedAt` nunca são
 * gerados por este módulo — sempre fornecidos pelo chamador. Nenhuma
 * função deste framework lê `Date.now()`, `Math.random()` ou gera UUID.
 */
export type ObservabilityReport = {
  reportId: string;
  generatedAt: string | null;
  modelVersion: string;
  config: PredictionObservabilityConfig;
  dashboardMetrics: DashboardMetrics;
  monitoredProfiles: MonitoringProfile[];
  trendAnalysis: TrendAnalysisEntry[];
  alerts: TechnicalAlert[];
  timeline: TimelineEvent[];
  metadata: ObservabilityReportMetadata;
};
