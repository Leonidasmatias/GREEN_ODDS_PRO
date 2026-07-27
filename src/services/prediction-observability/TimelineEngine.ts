// Fase 5 — Sprint 5.3 — Intelligence Observability & Monitoring Framework.
// Timeline Engine: constrói uma linha do tempo determinística a partir de
// `MonitoringProfile[]` já consolidado — NUNCA lê `Date.now()`, o
// `timestamp` de cada evento é sempre o fornecido pelo chamador. Como
// `LearningReport` carrega apenas um par baseline/current (não uma série
// multi-ponto), os eventos representam o estado OBSERVADO nesta chamada
// — a exceção é `DRIFT_CHANGE`, que já representa um delta real entre
// janelas (calculado pela Sprint 5.1). Função pura: nenhum acesso a
// Prisma, rede, relógio do sistema ou número aleatório.

import type { PredictionObservabilityConfig } from "./PredictionObservabilityConfig.ts";
import type { MonitoringProfile, StrategyStatus, TimelineEvent, TimelineEventType } from "./types.ts";

const TIMELINE_EVENT_TYPE_ORDER: TimelineEventType[] = ["STRATEGY_CHANGE", "RISK_CHANGE", "RELIABILITY_CHANGE", "RECOMMENDATION_CHANGE", "DRIFT_CHANGE"];

function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  const typeRankA = TIMELINE_EVENT_TYPE_ORDER.indexOf(a.type);
  const typeRankB = TIMELINE_EVENT_TYPE_ORDER.indexOf(b.type);
  if (typeRankA !== typeRankB) return typeRankA - typeRankB;

  const dimensionA = a.dimension ?? "";
  const dimensionB = b.dimension ?? "";
  if (dimensionA !== dimensionB) return dimensionA < dimensionB ? -1 : 1;

  const keyA = a.key ?? "";
  const keyB = b.key ?? "";
  if (keyA !== keyB) return keyA < keyB ? -1 : 1;

  return a.description < b.description ? -1 : a.description > b.description ? 1 : 0;
}

/**
 * Constrói a linha do tempo — ordenação totalmente determinística (tipo
 * de evento em ordem fixa, depois dimensão+chave), independente de
 * `timestamp` (que é o mesmo valor, fornecido pelo chamador, em todos os
 * eventos desta chamada). Truncada deterministicamente em
 * `config.maxTimelineEvents` após a ordenação — nunca afeta
 * `DashboardMetrics`, que nunca depende da timeline.
 */
export function buildTimeline(
  strategyStatus: StrategyStatus,
  monitoringProfiles: MonitoringProfile[],
  config: PredictionObservabilityConfig,
  timestamp: string | null,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    timestamp,
    dimension: null,
    key: null,
    type: "STRATEGY_CHANGE",
    description: `strategy status observed: ${strategyStatus}`,
  });

  for (const profile of monitoringProfiles) {
    if (profile.riskAssessment) {
      events.push({
        timestamp,
        dimension: profile.dimension,
        key: profile.key,
        type: "RISK_CHANGE",
        description: `risk level observed: ${profile.riskAssessment.level}`,
      });
    }

    if (profile.reliabilityScore !== null) {
      events.push({
        timestamp,
        dimension: profile.dimension,
        key: profile.key,
        type: "RELIABILITY_CHANGE",
        description: `reliability score observed: ${profile.reliabilityScore}`,
      });
    }

    if (profile.recommendation) {
      events.push({
        timestamp,
        dimension: profile.dimension,
        key: profile.key,
        type: "RECOMMENDATION_CHANGE",
        description: `recommendation observed: ${profile.recommendation.type}`,
      });
    }

    for (const signal of profile.driftSignals) {
      events.push({
        timestamp,
        dimension: profile.dimension,
        key: profile.key,
        type: "DRIFT_CHANGE",
        description: `${signal.metric} changed by ${signal.absoluteDelta} (${signal.type}, severity ${signal.severity}).`,
      });
    }
  }

  return events.sort(compareEvents).slice(0, config.maxTimelineEvents);
}
