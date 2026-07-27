// Fase 5 — Sprint 5.3 — Intelligence Observability & Monitoring Framework.
// Dashboard Metrics Engine: agrega `MonitoringProfile[]` (já
// consolidado) em métricas estruturadas — NUNCA recalcula nenhuma
// métrica individual, apenas conta/agrega o que já existe. Sem
// gráficos, apenas dados estruturados. Função pura: nenhum acesso a
// Prisma, rede, relógio do sistema ou número aleatório.

import { ALL_RECOMMENDATION_TYPES } from "./types.ts";
import type { DashboardMetrics, DriftSignalType, MonitoringProfile } from "./types.ts";

const ALL_DRIFT_SIGNAL_TYPES: DriftSignalType[] = [
  "PERFORMANCE_DEGRADATION",
  "PERFORMANCE_IMPROVEMENT",
  "CALIBRATION_DEGRADATION",
  "CONFIDENCE_SHIFT",
  "SAMPLE_INSUFFICIENT",
  "PROFILE_DISAPPEARED",
  "PROFILE_EMERGED",
];

/** Ordem ordinal fixa dos níveis de risco — usada apenas para calcular
 * `averageRisk` numericamente (posição no vetor), nunca uma métrica de
 * negócio configurável. */
const RISK_LEVEL_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function emptyDistribution<T extends string>(keys: T[]): Record<T, number> {
  const result = {} as Record<T, number>;
  for (const key of keys) result[key] = 0;
  return result;
}

/**
 * Agrega `monitoringProfiles` em métricas estruturadas para dashboard.
 * `driftDistribution`/`recommendationDistribution` sempre contêm TODAS
 * as chaves possíveis (mesmo com contagem zero) — nunca omitem uma
 * categoria sem ocorrências.
 */
export function buildDashboardMetrics(monitoringProfiles: MonitoringProfile[]): DashboardMetrics {
  const driftDistribution = emptyDistribution(ALL_DRIFT_SIGNAL_TYPES);
  const recommendationDistribution = emptyDistribution(ALL_RECOMMENDATION_TYPES);

  let stableProfiles = 0;
  let warningProfiles = 0;
  let criticalProfiles = 0;
  let improvingProfiles = 0;
  let disabledProfiles = 0;
  let monitoredProfiles = 0;

  const reliabilityScores: number[] = [];
  const riskOrdinals: number[] = [];
  const confidenceMultipliers: number[] = [];

  for (const profile of monitoringProfiles) {
    if (profile.status !== "NEW") monitoredProfiles += 1;
    if (profile.status === "STABLE") stableProfiles += 1;
    else if (profile.status === "WARNING") warningProfiles += 1;
    else if (profile.status === "CRITICAL") criticalProfiles += 1;
    else if (profile.status === "IMPROVING") improvingProfiles += 1;
    else if (profile.status === "DISABLED") disabledProfiles += 1;

    if (profile.reliabilityScore !== null) reliabilityScores.push(profile.reliabilityScore);
    if (profile.riskAssessment) riskOrdinals.push(RISK_LEVEL_ORDER.indexOf(profile.riskAssessment.level));
    if (profile.confidenceAdjustment) confidenceMultipliers.push(profile.confidenceAdjustment.suggestedMultiplier);

    for (const signal of profile.driftSignals) driftDistribution[signal.type] += 1;
    if (profile.recommendation) recommendationDistribution[profile.recommendation.type] += 1;
  }

  return {
    totalProfiles: monitoringProfiles.length,
    monitoredProfiles,
    stableProfiles,
    warningProfiles,
    criticalProfiles,
    improvingProfiles,
    disabledProfiles,
    averageReliability: average(reliabilityScores),
    averageRisk: average(riskOrdinals),
    averageConfidenceMultiplier: average(confidenceMultipliers),
    driftDistribution,
    recommendationDistribution,
  };
}
