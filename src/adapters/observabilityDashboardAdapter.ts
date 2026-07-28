// Adaptador de apresentação: converte um `ObservabilityReport` (Sprint
// 5.3, `@/services/prediction-observability`) em modelos de visualização
// prontos para o dashboard `/intelligence`. NUNCA recalcula métricas,
// classificações, drift, confiabilidade, recomendações, risco ou
// estratégia — apenas traduz nomes técnicos, formata valores e organiza
// os dados já calculados. Função pura: nunca muta o `ObservabilityReport`
// recebido; todo array/objeto de saída é uma nova estrutura.

// Imports relativos (não `@/`) — este adaptador precisa ser executável
// também por `node --test` (sem bundler), mesma justificativa documentada
// em `intelligenceFormatters.ts`.
import {
  formatAlertLevel,
  formatAlertType,
  formatDimension,
  formatDriftSignalType,
  formatMonitoringStatus,
  formatMultiplier,
  formatPercentageScore,
  formatProfileLabel,
  formatRecommendation,
  formatReportDate,
  formatRisk,
  formatStrategyStatus,
  formatTimelineEventType,
  formatTrend,
  NOT_AVAILABLE,
} from "../lib/intelligenceFormatters.ts";
import type {
  AlertViewModel,
  DistributionEntryViewModel,
  IntelligenceDashboardViewModel,
  ProfileRowViewModel,
  SummaryCardViewModel,
  TimelineEventViewModel,
  TrendGroupViewModel,
} from "../lib/intelligenceTypes.ts";
import type { ObservabilityReport, TrendType } from "../services/prediction-observability/index.ts";

function buildSummaryCards(report: ObservabilityReport): SummaryCardViewModel[] {
  const m = report.dashboardMetrics;
  return [
    { key: "totalProfiles", label: "Total de perfis", value: m.totalProfiles.toLocaleString("pt-BR"), icon: "profiles" },
    { key: "monitoredProfiles", label: "Perfis monitorados", value: m.monitoredProfiles.toLocaleString("pt-BR"), icon: "monitored" },
    { key: "stableProfiles", label: "Perfis estáveis", value: m.stableProfiles.toLocaleString("pt-BR"), icon: "stable" },
    { key: "warningProfiles", label: "Perfis em alerta", value: m.warningProfiles.toLocaleString("pt-BR"), icon: "warning" },
    { key: "criticalProfiles", label: "Perfis críticos", value: m.criticalProfiles.toLocaleString("pt-BR"), icon: "critical" },
    { key: "improvingProfiles", label: "Perfis melhorando", value: m.improvingProfiles.toLocaleString("pt-BR"), icon: "improving" },
    { key: "disabledProfiles", label: "Perfis desabilitados", value: m.disabledProfiles.toLocaleString("pt-BR"), icon: "disabled" },
    { key: "averageReliability", label: "Confiabilidade média", value: formatPercentageScore(m.averageReliability), icon: "reliability" },
    { key: "averageRisk", label: "Risco médio", value: `${m.averageRisk.toFixed(2)} / 3`, icon: "risk" },
    { key: "averageConfidenceMultiplier", label: "Multiplicador médio de confiança", value: formatMultiplier(m.averageConfidenceMultiplier), icon: "confidence" },
  ];
}

function buildDistribution<T extends string>(distribution: Record<T, number>): DistributionEntryViewModel[] {
  const entries = Object.entries(distribution) as [T, number][];
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return entries.map(([code, count]) => ({
    code,
    label: code,
    count,
    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  }));
}

function buildDriftDistribution(report: ObservabilityReport): DistributionEntryViewModel[] {
  return buildDistribution(report.dashboardMetrics.driftDistribution).map((entry) => ({
    ...entry,
    label: formatDriftSignalType(entry.code as Parameters<typeof formatDriftSignalType>[0]),
  }));
}

function buildRecommendationDistribution(report: ObservabilityReport): DistributionEntryViewModel[] {
  return buildDistribution(report.dashboardMetrics.recommendationDistribution).map((entry) => ({
    ...entry,
    label: formatRecommendation(entry.code as Parameters<typeof formatRecommendation>[0]),
  }));
}

function buildProfileRows(report: ObservabilityReport): ProfileRowViewModel[] {
  const trendByProfile = new Map(report.trendAnalysis.map((entry) => [`${entry.dimension}::${entry.key}`, entry]));

  return report.monitoredProfiles.map((profile) => {
    const trendEntry = trendByProfile.get(`${profile.dimension}::${profile.key}`) ?? null;
    return {
      id: `${profile.dimension}::${profile.key}`,
      dimensionCode: profile.dimension,
      dimensionLabel: formatDimension(profile.dimension),
      key: profile.key,
      status: profile.status,
      statusLabel: formatMonitoringStatus(profile.status),
      reliabilityLabel: formatPercentageScore(profile.reliabilityScore),
      reliabilityValue: profile.reliabilityScore,
      driftSignalsCount: profile.driftSignals.length,
      recommendationCode: profile.recommendation?.type ?? null,
      recommendationLabel: profile.recommendation ? formatRecommendation(profile.recommendation.type) : NOT_AVAILABLE,
      riskCode: profile.riskAssessment?.level ?? null,
      riskLabel: profile.riskAssessment ? formatRisk(profile.riskAssessment.level) : NOT_AVAILABLE,
      suggestedMultiplierLabel: profile.confidenceAdjustment ? formatMultiplier(profile.confidenceAdjustment.suggestedMultiplier) : NOT_AVAILABLE,
      strategyStatus: profile.strategyStatus,
      trendCode: trendEntry?.trend ?? null,
      trendLabel: trendEntry ? formatTrend(trendEntry.trend).label : NOT_AVAILABLE,
    };
  });
}

function buildAlerts(report: ObservabilityReport): AlertViewModel[] {
  return report.alerts.map((alert) => ({
    id: alert.id,
    level: alert.level,
    levelLabel: formatAlertLevel(alert.level),
    type: alert.type,
    typeLabel: formatAlertType(alert.type),
    profileLabel: formatProfileLabel(alert.dimension, alert.key),
    message: alert.message,
    timestampLabel: NOT_AVAILABLE,
  }));
}

const TREND_ORDER: TrendType[] = ["DETERIORATION", "CONTINUOUS_DRIFT", "DECREASING_STABILITY", "RECOVERY", "INCREASING_STABILITY", "NEWLY_CREATED_PROFILE"];

function buildTrendGroups(report: ObservabilityReport): TrendGroupViewModel[] {
  const grouped = new Map<TrendType, { dimensionLabel: string; key: string }[]>();
  for (const entry of report.trendAnalysis) {
    const bucket = grouped.get(entry.trend);
    const profileRef = { dimensionLabel: formatDimension(entry.dimension), key: entry.key };
    if (bucket) bucket.push(profileRef);
    else grouped.set(entry.trend, [profileRef]);
  }

  return TREND_ORDER.filter((trend) => grouped.has(trend)).map((trend) => {
    const { label, description } = formatTrend(trend);
    const profiles = grouped.get(trend) ?? [];
    return { trend, label, description, count: profiles.length, profiles };
  });
}

function buildTimeline(report: ObservabilityReport): TimelineEventViewModel[] {
  return report.timeline.map((event, index) => ({
    id: `timeline-${index}`,
    type: event.type,
    typeLabel: formatTimelineEventType(event.type),
    profileLabel: formatProfileLabel(event.dimension, event.key),
    description: event.description,
    timestampLabel: formatReportDate(event.timestamp),
  }));
}

/**
 * Converte um `ObservabilityReport` já calculado em
 * `IntelligenceDashboardViewModel`. Nunca lança exceção por dados
 * ausentes dentro do relatório — valores ausentes viram
 * `"Não disponível"`, nunca `0` fabricado.
 */
export function buildIntelligenceDashboardViewModel(report: ObservabilityReport): IntelligenceDashboardViewModel {
  return {
    header: {
      modelVersion: report.modelVersion,
      generatedAtLabel: formatReportDate(report.generatedAt),
      reportId: report.reportId,
    },
    strategy: {
      status: report.metadata.sourceStrategyStatus,
      label: formatStrategyStatus(report.metadata.sourceStrategyStatus).label,
      description: formatStrategyStatus(report.metadata.sourceStrategyStatus).description,
      relatedAlertsCount: report.alerts.length,
      generatedAtLabel: formatReportDate(report.generatedAt),
    },
    summaryCards: buildSummaryCards(report),
    driftDistribution: buildDriftDistribution(report),
    recommendationDistribution: buildRecommendationDistribution(report),
    profiles: buildProfileRows(report),
    alerts: buildAlerts(report),
    trends: buildTrendGroups(report),
    timeline: buildTimeline(report),
  };
}
