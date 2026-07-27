// Fase 5 — Sprint 5.2 — Adaptive Intelligence & Recommendation Framework.
// Recommendation Engine: deriva UMA recomendação técnica por
// dimensão+chave a partir do status do perfil (Sprint 5.1), dos sinais
// de drift associados e do score de confiabilidade — nunca recalcula
// métricas, nunca recalibra probabilidades. Função pura: nenhum acesso a
// Prisma, rede, relógio do sistema ou número aleatório.
//
// Prioridade determinística (primeira regra que casar vence — nunca
// combina múltiplos tipos para o mesmo perfil):
//   1. amostra ausente/rejeitada no perfil                  -> NEEDS_MORE_DATA
//   2. perfil desapareceu na janela atual (PROFILE_DISAPPEARED) -> TEMPORARILY_DISABLE_PROFILE
//   3. amostra insuficiente (perfil, SAMPLE_INSUFFICIENT ou
//      PROFILE_EMERGED)                                      -> NEEDS_MORE_DATA
//   4. sinal de degradação CRITICAL                           -> TEMPORARILY_DISABLE_PROFILE
//   5. sinal de degradação WARNING, ou confiabilidade abaixo
//      de `recommendationLowReliabilityThreshold`             -> REDUCE_CONFIDENCE
//   6. sinal de degradação INFO, ou qualquer CONFIDENCE_SHIFT  -> INCREASE_MONITORING
//   7. sinal de melhoria (PERFORMANCE_IMPROVEMENT)             -> PROFILE_IMPROVING
//   8. nenhuma das anteriores                                 -> PROFILE_STABLE

import { reliabilityScoreFor } from "./types.ts";
import type { PredictionAdaptationConfig } from "./PredictionAdaptationConfig.ts";
import type { DriftSignal, HistoricalProfile, Recommendation, ReliabilityRanking } from "./types.ts";

function profileMapKey(dimension: string, key: string): string {
  return `${dimension}::${key}`;
}

function groupSignalsByProfile(driftSignals: DriftSignal[]): Map<string, DriftSignal[]> {
  const groups = new Map<string, DriftSignal[]>();
  for (const signal of driftSignals) {
    const mapKey = profileMapKey(signal.dimension, signal.key);
    const bucket = groups.get(mapKey);
    if (bucket) bucket.push(signal);
    else groups.set(mapKey, [signal]);
  }
  return groups;
}

function signalIds(signals: DriftSignal[]): string[] {
  return signals.map((signal) => signal.id).sort();
}

function hasSignal(signals: DriftSignal[], predicate: (signal: DriftSignal) => boolean): boolean {
  return signals.some(predicate);
}

function buildRecommendationForProfile(
  profile: HistoricalProfile,
  signals: DriftSignal[],
  reliabilityScore: number | null,
  config: PredictionAdaptationConfig,
): Recommendation {
  const base = { dimension: profile.dimension, key: profile.key, triggeredBySignalIds: signalIds(signals) };

  if (profile.status === "EMPTY" || profile.status === "REJECTED") {
    return { ...base, type: "NEEDS_MORE_DATA", reason: `profile status is ${profile.status}: no usable data to assess.` };
  }

  const disappeared = signals.find((signal) => signal.type === "PROFILE_DISAPPEARED");
  if (disappeared) {
    return { ...base, type: "TEMPORARILY_DISABLE_PROFILE", reason: "profile present in baseline but absent from the current window." };
  }

  const sampleInsufficient = hasSignal(signals, (signal) => signal.type === "SAMPLE_INSUFFICIENT" || signal.type === "PROFILE_EMERGED");
  if (profile.status === "INSUFFICIENT_SAMPLE" || sampleInsufficient) {
    return { ...base, type: "NEEDS_MORE_DATA", reason: "sample size below the minimum required for a reliable assessment." };
  }

  const criticalDegradation = hasSignal(
    signals,
    (signal) => signal.direction === "DEGRADATION" && signal.severity === "CRITICAL",
  );
  if (criticalDegradation) {
    return { ...base, type: "TEMPORARILY_DISABLE_PROFILE", reason: "critical-severity performance/calibration degradation detected." };
  }

  const warningDegradation = hasSignal(signals, (signal) => signal.direction === "DEGRADATION" && signal.severity === "WARNING");
  const lowReliability = reliabilityScore !== null && reliabilityScore < config.recommendationLowReliabilityThreshold;
  if (warningDegradation || lowReliability) {
    return {
      ...base,
      type: "REDUCE_CONFIDENCE",
      reason: warningDegradation
        ? "warning-severity performance/calibration degradation detected."
        : `reliability score (${reliabilityScore}) is below the configured threshold (${config.recommendationLowReliabilityThreshold}).`,
    };
  }

  const infoDegradation = hasSignal(signals, (signal) => signal.direction === "DEGRADATION" && signal.severity === "INFO");
  const confidenceShift = hasSignal(signals, (signal) => signal.type === "CONFIDENCE_SHIFT");
  if (infoDegradation || confidenceShift) {
    return { ...base, type: "INCREASE_MONITORING", reason: "minor degradation or a confidence shift was detected; closer monitoring advised." };
  }

  const improvement = hasSignal(signals, (signal) => signal.type === "PERFORMANCE_IMPROVEMENT");
  if (improvement) {
    return { ...base, type: "PROFILE_IMPROVING", reason: "performance improvement detected relative to the baseline window." };
  }

  return { ...base, type: "PROFILE_STABLE", reason: "no relevant drift signal and sufficient, stable sample." };
}

/**
 * Constrói exatamente uma `Recommendation` por perfil em `profiles`, na
 * mesma ordem (já determinística, produzida pela Sprint 5.1). Nunca
 * combina múltiplos tipos de recomendação para o mesmo perfil.
 */
export function buildRecommendations(
  profiles: HistoricalProfile[],
  driftSignals: DriftSignal[],
  reliabilityRanking: ReliabilityRanking,
  config: PredictionAdaptationConfig,
): Recommendation[] {
  const signalsByProfile = groupSignalsByProfile(driftSignals);
  return profiles.map((profile) => {
    const signals = signalsByProfile.get(profileMapKey(profile.dimension, profile.key)) ?? [];
    const reliabilityScore = reliabilityScoreFor(reliabilityRanking, profile.dimension, profile.key);
    return buildRecommendationForProfile(profile, signals, reliabilityScore, config);
  });
}
