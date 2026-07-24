// Fase 3.5 - Observabilidade e Validacao em Producao.
// DuplicateMetrics: le a saida ja existente da DeduplicationService/
// IngestionPipeline (Fase 2, campos totalRaw/duplicated do
// PipelineRunSummary) e converte em uma taxa de duplicidade e um score
// de saude (0..1, 1 = nenhuma duplicidade observada). Nao reimplementa
// nenhuma logica de deduplicacao - apenas mede o resultado ja produzido.

import type { PipelineRunSummary } from "../../providers/pipeline/PipelineEvents.ts";

export type DuplicateMetricsResult = {
  totalRaw: number;
  duplicated: number;
  duplicateRate: number;
  duplicateHealthScore: number;
};

type DuplicateMetricsInput = Pick<PipelineRunSummary, "totalRaw" | "duplicated">;

export function analyzeDuplicateMetrics(summary: DuplicateMetricsInput): DuplicateMetricsResult {
  const totalRaw = summary.totalRaw;
  const duplicateRate = totalRaw === 0 ? 0 : summary.duplicated / totalRaw;
  return {
    totalRaw,
    duplicated: summary.duplicated,
    duplicateRate,
    duplicateHealthScore: Math.max(0, Math.min(1, 1 - duplicateRate)),
  };
}

/** Agrega multiplos PipelineRunSummary (ex.: varias SyncRun de uma janela) em uma unica taxa de duplicidade. */
export function aggregateDuplicateMetrics(summaries: DuplicateMetricsInput[]): DuplicateMetricsResult {
  const totalRaw = summaries.reduce((sum, summary) => sum + summary.totalRaw, 0);
  const duplicated = summaries.reduce((sum, summary) => sum + summary.duplicated, 0);
  return analyzeDuplicateMetrics({ totalRaw, duplicated });
}

/** Adapta um BetsApiSyncReport (Fase 3) para o formato esperado por analyzeDuplicateMetrics, sem alterar BetsApiSyncService. */
export function duplicateMetricsInputFromSyncReport(report: { eventsReceived: number; duplicated: number }): DuplicateMetricsInput {
  return { totalRaw: report.eventsReceived, duplicated: report.duplicated };
}
