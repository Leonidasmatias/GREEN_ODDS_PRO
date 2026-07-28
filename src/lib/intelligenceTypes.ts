// Import relativo (não `@/`) — este arquivo é 100% tipos (apagado em
// tempo de execução), mas mantido consistente com os demais arquivos de
// lógica pura desta feature, que precisam ser executáveis também por
// `node --test` (sem bundler, sem resolução do alias `@/`).
import type { AlertLevel, AlertType, DashboardMetrics, MonitoringProfile, MonitoringStatus, ObservabilityReport, ObservabilityReportMetadata, TimelineEventType, TrendType } from "../services/prediction-observability/index.ts";

// `ProfileDimension`/`RiskLevel`/`RecommendationType`/`DriftSignalType`/
// `StrategyStatus` não são reexportados pelo barrel público de
// `prediction-observability` (permanecem internos àquele módulo, mesmo
// padrão já usado pelas Sprints 5.1/5.2/5.3 de só expor a API
// oficialmente documentada). Em vez de importar arquivos internos
// (proibido), derivamos os mesmos tipos ESTRUTURALMENTE a partir dos
// tipos que JÁ são públicos — nunca duplicados à mão, nunca desatualizam
// silenciosamente se o contrato de origem mudar.
export type ProfileDimension = MonitoringProfile["dimension"];
export type RiskLevel = NonNullable<MonitoringProfile["riskAssessment"]>["level"];
export type RecommendationType = NonNullable<MonitoringProfile["recommendation"]>["type"];
export type DriftSignalType = keyof DashboardMetrics["driftDistribution"];
export type StrategyStatus = ObservabilityReportMetadata["sourceStrategyStatus"];

/** "fixture" enquanto nao existir persistencia/endpoint real produzindo um
 * ObservabilityReport (Sprint 6.0) — nunca apresentado como dado ao vivo. */
export type IntelligenceSourceKind = "real" | "fixture";

export type IntelligenceDashboardDataResult =
  | { status: "success"; source: IntelligenceSourceKind; report: ObservabilityReport }
  | { status: "empty"; source: IntelligenceSourceKind }
  | { status: "error"; message: string };

export type SummaryCardViewModel = {
  key: string;
  label: string;
  value: string;
  icon: "profiles" | "monitored" | "stable" | "warning" | "critical" | "improving" | "disabled" | "reliability" | "risk" | "confidence";
};

export type StrategyStatusViewModel = {
  status: StrategyStatus;
  label: string;
  description: string;
  relatedAlertsCount: number;
  generatedAtLabel: string;
};

export type DistributionEntryViewModel = {
  code: string;
  label: string;
  count: number;
  percentage: number;
};

export type ProfileRowViewModel = {
  id: string;
  dimensionCode: ProfileDimension;
  dimensionLabel: string;
  key: string;
  status: MonitoringStatus;
  statusLabel: string;
  reliabilityLabel: string;
  reliabilityValue: number | null;
  driftSignalsCount: number;
  recommendationCode: RecommendationType | null;
  recommendationLabel: string;
  riskCode: RiskLevel | null;
  riskLabel: string;
  suggestedMultiplierLabel: string;
  strategyStatus: StrategyStatus;
  trendCode: TrendType | null;
  trendLabel: string;
};

export type AlertViewModel = {
  id: string;
  level: AlertLevel;
  levelLabel: string;
  type: AlertType;
  typeLabel: string;
  profileLabel: string;
  message: string;
  timestampLabel: string;
};

export type TrendGroupViewModel = {
  trend: TrendType;
  label: string;
  description: string;
  count: number;
  profiles: { dimensionLabel: string; key: string }[];
};

export type TimelineEventViewModel = {
  id: string;
  type: TimelineEventType;
  typeLabel: string;
  profileLabel: string;
  description: string;
  timestampLabel: string;
};

export type IntelligenceDashboardViewModel = {
  header: {
    modelVersion: string;
    generatedAtLabel: string;
    reportId: string;
  };
  strategy: StrategyStatusViewModel;
  summaryCards: SummaryCardViewModel[];
  driftDistribution: DistributionEntryViewModel[];
  recommendationDistribution: DistributionEntryViewModel[];
  profiles: ProfileRowViewModel[];
  alerts: AlertViewModel[];
  trends: TrendGroupViewModel[];
  timeline: TimelineEventViewModel[];
};
