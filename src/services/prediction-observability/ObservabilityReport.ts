// Fase 5 — Sprint 5.3 — Intelligence Observability & Monitoring Framework.
// Módulo principal: orquestra `ProfileMonitoringEngine` +
// `TrendAnalysisEngine` + `AlertEngine` + `DashboardMetricsEngine` +
// `TimelineEngine` em um único `ObservabilityReport` serializável, a
// partir de um `LearningReport` (Sprint 5.1) e um `AdaptiveReport`
// (Sprint 5.2) já calculados. Nunca lê `Date.now()`/relógio do sistema,
// gera UUID aleatório ou qualquer valor dependente do ambiente —
// `reportId`/`generatedAt`/timestamps da timeline são sempre fornecidos
// pelo chamador. Arredondamento (`config.decimalPlaces`) é aplicado
// apenas nesta camada de serialização, nunca durante o cálculo interno,
// e nunca sobre `config`.

import { buildMonitoringProfiles } from "./ProfileMonitoringEngine.ts";
import { analyzeTrends } from "./TrendAnalysisEngine.ts";
import { buildAlerts } from "./AlertEngine.ts";
import { buildDashboardMetrics } from "./DashboardMetricsEngine.ts";
import { buildTimeline } from "./TimelineEngine.ts";
import { validatePredictionObservabilityConfig, type PredictionObservabilityConfig } from "./PredictionObservabilityConfig.ts";
import {
  isFiniteNumber,
  type AdaptiveReport,
  type LearningReport,
  type ObservabilityReport,
  type ObservabilityReportOptions,
} from "./types.ts";

function roundNumber(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/** Arredonda recursivamente todo número finito encontrado em `value` para
 * `decimalPlaces` casas decimais — aplicado uma única vez, no final da
 * montagem do relatório, nunca durante o cálculo interno. Números não
 * finitos são preservados sem alteração, nunca silenciosamente zerados. */
function roundDeep<T>(value: T, decimalPlaces: number): T {
  if (typeof value === "number") {
    return (isFiniteNumber(value) ? roundNumber(value, decimalPlaces) : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => roundDeep(item, decimalPlaces)) as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = roundDeep(entryValue, decimalPlaces);
    }
    return result as T;
  }
  return value;
}

/**
 * Monta o relatório de observabilidade final a partir de um
 * `LearningReport` (Sprint 5.1) e um `AdaptiveReport` (Sprint 5.2) já
 * calculados. Lança `PredictionObservabilityConfigurationError` para uma
 * configuração inválida; nunca lança por causa do conteúdo dos
 * relatórios de origem — entradas vazias produzem um relatório com
 * arrays vazios, nunca uma exceção.
 */
export function buildObservabilityReport(
  learningReport: LearningReport,
  adaptiveReport: AdaptiveReport,
  config: PredictionObservabilityConfig,
  options: ObservabilityReportOptions,
): ObservabilityReport {
  validatePredictionObservabilityConfig(config);

  const { historicalProfiles, driftSignals, reliabilityRankings, status: sourceLearningStatus, reportId: sourceLearningReportId } = learningReport;

  const monitoredProfiles = buildMonitoringProfiles(historicalProfiles, driftSignals, reliabilityRankings, adaptiveReport, config);
  const trendAnalysis = analyzeTrends(historicalProfiles, driftSignals, reliabilityRankings, config);
  const alerts = buildAlerts(monitoredProfiles, trendAnalysis, config);
  const dashboardMetrics = buildDashboardMetrics(monitoredProfiles);
  const timeline = buildTimeline(adaptiveReport.strategyStatus, monitoredProfiles, config, options.timelineTimestamp ?? null);

  // `config` é deliberadamente excluído do arredondamento — mesma razão
  // documentada em `LearningReport.ts` (Sprint 5.1) e `AdaptiveReport.ts`
  // (Sprint 5.2): arredondar limiares junto com os valores calculados
  // poderia corrompê-los silenciosamente.
  const roundedPortion = roundDeep({ dashboardMetrics, monitoredProfiles, trendAnalysis, alerts, timeline }, config.decimalPlaces);

  return {
    reportId: options.reportId,
    generatedAt: options.generatedAt ?? null,
    modelVersion: config.modelVersion,
    config,
    ...roundedPortion,
    metadata: {
      sourceLearningReportId,
      sourceAdaptiveReportId: adaptiveReport.reportId,
      sourceLearningStatus,
      sourceStrategyStatus: adaptiveReport.strategyStatus,
    },
  };
}
