// Fase 5 — Sprint 5.3 — Intelligence Observability & Monitoring Framework.
// Alert Engine: gera alertas técnicos, puramente informativos, a partir
// de `MonitoringProfile[]` (já consolidado) e `TrendAnalysisEntry[]` (já
// classificado) — NUNCA recalcula nada, NUNCA executa nenhuma ação. Um
// mesmo perfil pode disparar múltiplos alertas simultaneamente (ao
// contrário de `Recommendation`, que é sempre única por perfil). Função
// pura: nenhum acesso a Prisma, rede, relógio do sistema ou número
// aleatório.

import { profileMapKey } from "./types.ts";
import type { PredictionObservabilityConfig } from "./PredictionObservabilityConfig.ts";
import type { AlertLevel, AlertType, MonitoringProfile, TechnicalAlert, TrendAnalysisEntry } from "./types.ts";

/** Ordem fixa de avaliação dos tipos de alerta — garante ordenação
 * determinística dentro de cada perfil, independente de qualquer
 * critério externo. */
const ALERT_TYPE_ORDER: AlertType[] = [
  "DRIFT_CRITICAL",
  "PROFILE_DISABLED",
  "HIGH_RISK",
  "LOW_RELIABILITY",
  "SAMPLE_TOO_SMALL",
  "IMPROVING_PROFILE",
  "NEW_PROFILE",
];

function buildAlert(profile: MonitoringProfile, type: AlertType, level: AlertLevel, message: string): TechnicalAlert {
  return { id: `${profile.dimension}:${profile.key}:${type}`, dimension: profile.dimension, key: profile.key, type, level, message };
}

function alertsForProfile(profile: MonitoringProfile, trend: TrendAnalysisEntry | undefined, config: PredictionObservabilityConfig): TechnicalAlert[] {
  const alerts: TechnicalAlert[] = [];

  if (profile.driftSignals.some((signal) => signal.severity === "CRITICAL")) {
    alerts.push(buildAlert(profile, "DRIFT_CRITICAL", "CRITICAL", "at least one critical-severity drift signal detected."));
  }

  if (profile.recommendation?.type === "TEMPORARILY_DISABLE_PROFILE") {
    alerts.push(buildAlert(profile, "PROFILE_DISABLED", "CRITICAL", "profile recommended for temporary disablement."));
  }

  if (profile.riskAssessment?.level === "CRITICAL") {
    alerts.push(buildAlert(profile, "HIGH_RISK", "CRITICAL", "risk assessment level is CRITICAL."));
  } else if (profile.riskAssessment?.level === "HIGH") {
    alerts.push(buildAlert(profile, "HIGH_RISK", "WARNING", "risk assessment level is HIGH."));
  }

  if (profile.reliabilityScore !== null && profile.reliabilityScore < config.lowReliabilityAlertThreshold) {
    alerts.push(buildAlert(profile, "LOW_RELIABILITY", "WARNING", `reliability score (${profile.reliabilityScore}) is below the configured threshold.`));
  }

  if (profile.profile.status === "INSUFFICIENT_SAMPLE" || profile.profile.status === "EMPTY") {
    alerts.push(buildAlert(profile, "SAMPLE_TOO_SMALL", "WARNING", `profile status is ${profile.profile.status}.`));
  }

  if (profile.recommendation?.type === "PROFILE_IMPROVING") {
    alerts.push(buildAlert(profile, "IMPROVING_PROFILE", "INFO", "performance improvement detected relative to the baseline window."));
  }

  if (trend?.trend === "NEWLY_CREATED_PROFILE") {
    alerts.push(buildAlert(profile, "NEW_PROFILE", "INFO", "profile has no prior observation history."));
  }

  return alerts.sort((a, b) => ALERT_TYPE_ORDER.indexOf(a.type) - ALERT_TYPE_ORDER.indexOf(b.type));
}

/**
 * Constrói todos os alertas técnicos aplicáveis, na mesma ordem de
 * `monitoringProfiles` (já determinística) e, dentro de cada perfil, na
 * ordem fixa `ALERT_TYPE_ORDER`. Um perfil sem nenhuma condição
 * aplicável não produz nenhum alerta.
 */
export function buildAlerts(
  monitoringProfiles: MonitoringProfile[],
  trendAnalysis: TrendAnalysisEntry[],
  config: PredictionObservabilityConfig,
): TechnicalAlert[] {
  const trendByProfile = new Map(trendAnalysis.map((entry) => [profileMapKey(entry.dimension, entry.key), entry]));
  const alerts: TechnicalAlert[] = [];
  for (const profile of monitoringProfiles) {
    const trend = trendByProfile.get(profileMapKey(profile.dimension, profile.key));
    alerts.push(...alertsForProfile(profile, trend, config));
  }
  return alerts;
}
