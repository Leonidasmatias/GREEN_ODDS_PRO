// Fase 2 — Data Ingestion Pipeline.
// PipelineLogger: registra, em memória, um resumo de cada execução da
// pipeline (provider, tempo, partidas importadas, duplicadas, erros,
// tempo total). Sem nenhuma biblioteca externa. Um `sink` opcional pode
// ser injetado para encaminhar cada entrada a um destino real (ex.:
// console.log em produção); por padrão não escreve em lugar nenhum, para
// manter a saída dos testes limpa.

import type { PipelineRunSummary } from "./PipelineEvents.ts";

export type PipelineLogEntry = {
  provider: PipelineRunSummary["provider"];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalRaw: number;
  imported: number;
  duplicated: number;
  errors: number;
};

export type PipelineLogSink = (entry: PipelineLogEntry) => void;

export class PipelineLogger {
  private readonly entries: PipelineLogEntry[] = [];
  private readonly sink: PipelineLogSink;

  constructor(sink: PipelineLogSink = () => {}) {
    this.sink = sink;
  }

  recordRun(summary: PipelineRunSummary): PipelineLogEntry {
    const entry: PipelineLogEntry = {
      provider: summary.provider,
      startedAt: summary.startedAt,
      finishedAt: summary.finishedAt,
      durationMs: summary.durationMs,
      totalRaw: summary.totalRaw,
      imported: summary.imported,
      duplicated: summary.duplicated,
      errors: summary.rejected,
    };
    this.entries.push(entry);
    this.sink(entry);
    return entry;
  }

  getHistory(): PipelineLogEntry[] {
    return [...this.entries];
  }

  lastRun(): PipelineLogEntry | null {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1] : null;
  }
}
