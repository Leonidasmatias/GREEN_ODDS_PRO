// Fase 5 — Sprint 5.3 — Intelligence Observability & Monitoring Framework.
// Barrel export: fachada pública oficial do módulo. Exporta apenas o
// ponto de entrada principal (`buildObservabilityReport`, consumindo um
// `LearningReport` da Sprint 5.1 e um `AdaptiveReport` da Sprint 5.2)
// mais os motores individuais para uso avançado explicitamente previsto
// (`buildMonitoringProfiles`, `analyzeTrends`, `buildAlerts`,
// `buildDashboardMetrics`, `buildTimeline`) e a configuração/tipos
// públicos. Funções auxiliares internas (agrupamento por perfil,
// arredondamento, comparadores de ordenação etc.) nunca são
// reexportadas — permanecem privadas aos seus arquivos.

export { buildObservabilityReport } from "./ObservabilityReport.ts";

export { buildMonitoringProfiles } from "./ProfileMonitoringEngine.ts";

export { analyzeTrends } from "./TrendAnalysisEngine.ts";

export { buildAlerts } from "./AlertEngine.ts";

export { buildDashboardMetrics } from "./DashboardMetricsEngine.ts";

export { buildTimeline } from "./TimelineEngine.ts";

export {
  PREDICTION_OBSERVABILITY_MODEL_VERSION,
  DEFAULT_PREDICTION_OBSERVABILITY_CONFIG,
  DEFAULT_MONITORING_STATUS_BY_RECOMMENDATION,
  validatePredictionObservabilityConfig,
  PredictionObservabilityConfigurationError,
} from "./PredictionObservabilityConfig.ts";
export type { PredictionObservabilityConfig, MonitoringStatusByRecommendation } from "./PredictionObservabilityConfig.ts";

export { isFiniteNumber } from "./types.ts";
export type {
  MonitoringStatus,
  MonitoringProfile,
  TrendType,
  TrendAnalysisEntry,
  AlertLevel,
  AlertType,
  TechnicalAlert,
  DashboardMetrics,
  TimelineEventType,
  TimelineEvent,
  ObservabilityReportOptions,
  ObservabilityReportMetadata,
  ObservabilityReport,
} from "./types.ts";
