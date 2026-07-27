// Fase 5 — Sprint 5.3 — Intelligence Observability & Monitoring Framework.
// Profile Monitoring Engine: consolida, por dimensão+chave, tudo que já
// foi calculado pelas Sprints 5.1 (histórico, drift, confiabilidade) e
// 5.2 (recomendação, risco, ajuste de confiança, estratégia) — NUNCA
// recalcula nenhuma métrica. Função pura: nenhum acesso a Prisma, rede,
// relógio do sistema ou número aleatório.

import { groupSignalsByProfile, profileMapKey } from "./types.ts";
import type { PredictionObservabilityConfig } from "./PredictionObservabilityConfig.ts";
import type {
  AdaptiveReport,
  DriftSignal,
  HistoricalProfile,
  MonitoringProfile,
  MonitoringStatus,
  ReliabilityRanking,
  StrategyStatus,
} from "./types.ts";

function statusFor(recommendationType: string | null, config: PredictionObservabilityConfig): MonitoringStatus {
  if (recommendationType === null) return "NEW";
  return config.monitoringStatusByRecommendation[recommendationType as keyof typeof config.monitoringStatusByRecommendation];
}

/**
 * Constrói exatamente um `MonitoringProfile` por perfil em
 * `learningReport.historicalProfiles`, na mesma ordem (já determinística,
 * produzida pela Sprint 5.1). `recommendation`/`riskAssessment`/
 * `confidenceAdjustment` são `null` apenas quando `adaptiveReport` não
 * contém uma decisão correspondente (nunca fabricados).
 */
export function buildMonitoringProfiles(
  profiles: HistoricalProfile[],
  driftSignals: DriftSignal[],
  reliabilityRanking: ReliabilityRanking,
  adaptiveReport: AdaptiveReport,
  config: PredictionObservabilityConfig,
): MonitoringProfile[] {
  const signalsByProfile = groupSignalsByProfile(driftSignals);
  const reliabilityByProfile = new Map(reliabilityRanking.entries.map((entry) => [profileMapKey(entry.dimension, entry.key), entry.reliabilityScore]));
  const decisionByProfile = new Map(adaptiveReport.decisions.map((decision) => [profileMapKey(decision.dimension, decision.key), decision]));
  const strategyStatus: StrategyStatus = adaptiveReport.strategyStatus;

  return profiles.map((profile) => {
    const mapKey = profileMapKey(profile.dimension, profile.key);
    const decision = decisionByProfile.get(mapKey);
    const recommendation = decision?.recommendation ?? null;

    return {
      dimension: profile.dimension,
      key: profile.key,
      profile,
      driftSignals: signalsByProfile.get(mapKey) ?? [],
      reliabilityScore: reliabilityByProfile.get(mapKey) ?? null,
      recommendation,
      riskAssessment: decision?.riskAssessment ?? null,
      confidenceAdjustment: decision?.confidenceAdjustment ?? null,
      strategyStatus,
      status: statusFor(recommendation?.type ?? null, config),
    };
  });
}
