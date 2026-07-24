// Fase 3.5 - Observabilidade e Validacao em Producao.
// ObservabilityReportBuilder: monta o relatorio final de observabilidade
// a partir dos resultados JA CALCULADOS pelos demais modulos desta
// camada (nao recalcula nada aqui - e um puro composer/serializer).
// Disponivel em 3 formatos de saida: objeto TypeScript, JSON e Markdown
// seguro (nunca HTML, nunca PDF). Todo o conteudo passa por
// ObservabilityRedaction antes de ser serializado.

import { randomUUID } from "node:crypto";
import type {
  DataQualitySnapshot,
  FieldQualityMetric,
  FixtureComparisonResult,
  LatencyPercentiles,
  LeagueQualityMetric,
  ObservabilityAlert,
  ProductionReadinessResult,
  ProviderOperationalMetric,
  SyncRun,
} from "./types.ts";
import type { ClassificationMetricsResult } from "./ClassificationMetrics.ts";
import type { DuplicateMetricsResult } from "./DuplicateMetrics.ts";
import type { RateLimitMetricsResult } from "./RateLimitMetrics.ts";
import { sanitizeObservabilityReport } from "./ObservabilityRedaction.ts";

/** Vocabulario fechado de avisos - repetido em toda saida do relatorio, nunca omitido. */
export const OBSERVABILITY_DISCLAIMERS: string[] = [
  "Este relatorio NAO contem recomendacao de aposta, edge, valor esperado (EV) ou Kelly Criterion.",
  "Este relatorio NAO altera nem substitui o Intelligence Engine (Fase 1.5).",
  "Nenhuma persistencia real em producao e ativada pela simples geracao deste relatorio.",
  "Todos os limiares e pesos usados (DataQualityEngine, AlertRuleEngine, ProductionReadinessEvaluator) sao PROVISORIOS e sujeitos a recalibracao apos operacao real.",
  "Um status de prontidao 'ready' descreve apenas estabilidade tecnica de dados/integracao - nunca uma garantia financeira.",
];

export type ObservabilityReportInput = {
  syncRuns: SyncRun[];
  dataQualitySnapshot: DataQualitySnapshot | null;
  classificationMetrics: ClassificationMetricsResult | null;
  duplicateMetrics: DuplicateMetricsResult | null;
  providerMetrics: ProviderOperationalMetric | null;
  rateLimitMetrics: RateLimitMetricsResult | null;
  latencyMetrics: LatencyPercentiles | null;
  fixtureComparison: FixtureComparisonResult | null;
  alerts: ObservabilityAlert[];
  productionReadiness: ProductionReadinessResult | null;
  retentionDays: number;
  limitations: string[];
  now?: () => Date;
  idGenerator?: () => string;
};

/** Relatorio final em 17 partes (metadata + 16 secoes de conteudo), conforme especificado na missao/documentacao. */
export type ObservabilityReport = {
  metadata: { reportId: string; generatedAt: string; retentionDays: number };
  syncRuns: SyncRun[];
  dataQualitySnapshot: DataQualitySnapshot | null;
  fieldQuality: FieldQualityMetric[];
  leagueQuality: LeagueQualityMetric[];
  classificationMetrics: ClassificationMetricsResult | null;
  duplicateMetrics: DuplicateMetricsResult | null;
  providerMetrics: ProviderOperationalMetric | null;
  rateLimitMetrics: RateLimitMetricsResult | null;
  latencyMetrics: LatencyPercentiles | null;
  fixtureComparison: FixtureComparisonResult | null;
  alerts: ObservabilityAlert[];
  productionReadiness: ProductionReadinessResult | null;
  inconsistencies: string[];
  limitations: string[];
  disclaimers: string[];
};

export function buildObservabilityReport(input: ObservabilityReportInput): ObservabilityReport {
  const now = input.now ?? (() => new Date());
  const idGenerator = input.idGenerator ?? randomUUID;

  return {
    metadata: { reportId: idGenerator(), generatedAt: now().toISOString(), retentionDays: input.retentionDays },
    syncRuns: input.syncRuns,
    dataQualitySnapshot: input.dataQualitySnapshot,
    fieldQuality: input.dataQualitySnapshot?.fieldMetrics ?? [],
    leagueQuality: input.dataQualitySnapshot?.leagueMetrics ?? [],
    classificationMetrics: input.classificationMetrics,
    duplicateMetrics: input.duplicateMetrics,
    providerMetrics: input.providerMetrics,
    rateLimitMetrics: input.rateLimitMetrics,
    latencyMetrics: input.latencyMetrics,
    fixtureComparison: input.fixtureComparison,
    alerts: input.alerts,
    productionReadiness: input.productionReadiness,
    inconsistencies: input.dataQualitySnapshot?.inconsistencies ?? [],
    limitations: input.limitations,
    disclaimers: OBSERVABILITY_DISCLAIMERS,
  };
}

/** Formato 1: objeto TypeScript sanitizado (pronto para uso programatico). */
export function reportToObject(report: ObservabilityReport): ObservabilityReport {
  return sanitizeObservabilityReport(report);
}

/** Formato 2: JSON indentado, sanitizado. */
export function reportToJson(report: ObservabilityReport): string {
  return JSON.stringify(sanitizeObservabilityReport(report), null, 2);
}

/** Formato 3: Markdown seguro (sem HTML, sem PDF), sanitizado antes de qualquer interpolacao de string. */
export function reportToMarkdown(reportInput: ObservabilityReport): string {
  const report = sanitizeObservabilityReport(reportInput);
  const lines: string[] = [];

  lines.push(`# Relatorio de Observabilidade - ${report.metadata.reportId}`);
  lines.push("");
  lines.push(`Gerado em: ${report.metadata.generatedAt} | Retencao configurada: ${report.metadata.retentionDays} dias`);
  lines.push("");

  lines.push("## Producao - Prontidao");
  if (report.productionReadiness) {
    lines.push(`Status: **${report.productionReadiness.status}**`);
    lines.push(`Proxima acao recomendada: ${report.productionReadiness.recommendedNextAction}`);
    lines.push(`Amostra: ${report.productionReadiness.sampleSize} | Alertas criticos: ${report.productionReadiness.criticalAlertCount} | Alertas warning: ${report.productionReadiness.warningAlertCount}`);
  } else {
    lines.push("Sem avaliacao de prontidao disponivel nesta execucao.");
  }
  lines.push("");

  lines.push("## Qualidade de Dados");
  if (report.dataQualitySnapshot) {
    lines.push(`Amostra: ${report.dataQualitySnapshot.sampleSize}`);
    lines.push(`overallScore: ${report.dataQualitySnapshot.overallScore.toFixed(1)}/100`);
    lines.push(`completenessScore: ${report.dataQualitySnapshot.completenessScore.toFixed(1)} | consistencyScore: ${report.dataQualitySnapshot.consistencyScore.toFixed(1)}`);
    lines.push(`classificationScore: ${report.dataQualitySnapshot.classificationScore.toFixed(1)} | duplicationScore: ${report.dataQualitySnapshot.duplicationScore.toFixed(1)}`);
    lines.push(`freshnessScore: ${report.dataQualitySnapshot.freshnessScore.toFixed(1)} | providerReliabilityScore: ${report.dataQualitySnapshot.providerReliabilityScore.toFixed(1)}`);
  } else {
    lines.push("Sem snapshot de qualidade disponivel nesta execucao.");
  }
  lines.push("");

  lines.push("## Inconsistencias Detectadas");
  lines.push(report.inconsistencies.length > 0 ? report.inconsistencies.map((item) => `- ${item}`).join("\n") : "Nenhuma.");
  lines.push("");

  lines.push("## Alertas Ativos");
  lines.push(
    report.alerts.length > 0
      ? report.alerts.map((alert) => `- [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}`).join("\n")
      : "Nenhum alerta ativo.",
  );
  lines.push("");

  lines.push("## Execucoes de Sync Recentes");
  lines.push(
    report.syncRuns.length > 0
      ? report.syncRuns
          .map((run) => `- ${run.id} (${run.mode}, ${run.status}): recebidos=${run.eventsReceived}, importados=${run.imported}, duplicados=${run.duplicated}`)
          .join("\n")
      : "Nenhuma execucao registrada.",
  );
  lines.push("");

  lines.push("## Limitacoes Conhecidas");
  lines.push(report.limitations.length > 0 ? report.limitations.map((item) => `- ${item}`).join("\n") : "Nenhuma limitacao adicional registrada.");
  lines.push("");

  lines.push("## Avisos Obrigatorios");
  lines.push(report.disclaimers.map((item) => `- ${item}`).join("\n"));
  lines.push("");

  return lines.join("\n");
}
