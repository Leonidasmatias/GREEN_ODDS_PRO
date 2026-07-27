// Fase 5 — Sprint 5.3 — Intelligence Observability & Monitoring Framework.
// Trend Analysis Engine: classifica a tendência técnica de cada perfil a
// partir SOMENTE dos sinais de drift já detectados (Sprint 5.1) e do
// score de confiabilidade — nunca prevê o futuro, nunca inventa uma
// série multi-ponto que os dados não possuem (`LearningReport` carrega
// apenas um par baseline/current). Função pura: nenhum acesso a Prisma,
// rede, relógio do sistema ou número aleatório.
//
// Prioridade determinística (primeira regra que casar vence):
//   1. PROFILE_EMERGED, ou nenhum sequenceKey observado no perfil -> NEWLY_CREATED_PROFILE
//   2. degradação em >= config.continuousDriftMinMetricCount métricas
//      distintas simultaneamente                                  -> CONTINUOUS_DRIFT
//   3. degradação WARNING/CRITICAL sem nenhuma melhoria             -> DETERIORATION
//   4. melhoria presente E confiabilidade abaixo de
//      recoveryReliabilityThreshold                                 -> RECOVERY
//   5. qualquer degradação restante (apenas INFO)                   -> DECREASING_STABILITY
//   6. nenhuma das anteriores                                       -> INCREASING_STABILITY

import { groupSignalsByProfile, profileMapKey, reliabilityScoreFor } from "./types.ts";
import type { PredictionObservabilityConfig } from "./PredictionObservabilityConfig.ts";
import type { DriftSignal, HistoricalProfile, ReliabilityRanking, TrendAnalysisEntry, TrendType } from "./types.ts";

function analyzeTrendForProfile(
  profile: HistoricalProfile,
  signals: DriftSignal[],
  reliabilityScore: number | null,
  config: PredictionObservabilityConfig,
): { trend: TrendType; reason: string } {
  const emerged = signals.some((signal) => signal.type === "PROFILE_EMERGED");
  if (emerged || (profile.firstSequenceKey === null && profile.lastSequenceKey === null)) {
    return { trend: "NEWLY_CREATED_PROFILE", reason: "profile has no prior observation history." };
  }

  const degradationSignals = signals.filter((signal) => signal.direction === "DEGRADATION");
  const improvementSignals = signals.filter((signal) => signal.direction === "IMPROVEMENT");
  const distinctDegradedMetrics = new Set(degradationSignals.map((signal) => signal.metric)).size;

  if (distinctDegradedMetrics >= config.continuousDriftMinMetricCount) {
    return { trend: "CONTINUOUS_DRIFT", reason: `${distinctDegradedMetrics} distinct metrics degrading simultaneously.` };
  }

  const hasNonInfoDegradation = degradationSignals.some((signal) => signal.severity !== "INFO");
  if (hasNonInfoDegradation && improvementSignals.length === 0) {
    return { trend: "DETERIORATION", reason: "warning/critical degradation with no offsetting improvement." };
  }

  if (improvementSignals.length > 0 && reliabilityScore !== null && reliabilityScore < config.recoveryReliabilityThreshold) {
    return { trend: "RECOVERY", reason: `improvement detected but reliability (${reliabilityScore}) is still below the recovery threshold.` };
  }

  if (degradationSignals.length > 0) {
    return { trend: "DECREASING_STABILITY", reason: "minor (info-severity) degradation detected." };
  }

  return { trend: "INCREASING_STABILITY", reason: "no degradation signal observed." };
}

/**
 * Analisa a tendência de cada perfil em `profiles`, na mesma ordem
 * (determinística, produzida pela Sprint 5.1). Nunca recalcula métricas
 * — apenas classifica a partir de `DriftSignal`/`ReliabilityRanking` já
 * calculados.
 */
export function analyzeTrends(
  profiles: HistoricalProfile[],
  driftSignals: DriftSignal[],
  reliabilityRanking: ReliabilityRanking,
  config: PredictionObservabilityConfig,
): TrendAnalysisEntry[] {
  const signalsByProfile = groupSignalsByProfile(driftSignals);
  return profiles.map((profile) => {
    const signals = signalsByProfile.get(profileMapKey(profile.dimension, profile.key)) ?? [];
    const reliabilityScore = reliabilityScoreFor(reliabilityRanking, profile.dimension, profile.key);
    const { trend, reason } = analyzeTrendForProfile(profile, signals, reliabilityScore, config);
    return { dimension: profile.dimension, key: profile.key, trend, reason };
  });
}
