// Fase 2 — Data Ingestion Pipeline.
// Eventos emitidos pela IngestionPipeline a cada partida processada, mais
// um evento de conclusão de agregação ao final da execução. Um pequeno
// event bus síncrono e sem dependências externas permite observar a
// pipeline (ex.: para logging ou testes) sem acoplar a pipeline a um
// consumidor específico.

import type { ProviderName } from "../types/dto.ts";
import type { InternalMatchDTO } from "../types/dto.ts";
import type { ValidationIssue } from "./MatchValidator.ts";

export type PipelineRunSummary = {
  provider: ProviderName;
  totalRaw: number;
  imported: number;
  updated: number;
  duplicated: number;
  ignored: number;
  rejected: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export type MatchImportedEvent = { type: "MatchImported"; match: InternalMatchDTO };
export type MatchUpdatedEvent = { type: "MatchUpdated"; match: InternalMatchDTO };
export type MatchIgnoredEvent = { type: "MatchIgnored"; match: InternalMatchDTO; reason: string };
export type MatchDuplicatedEvent = { type: "MatchDuplicated"; match: InternalMatchDTO };
export type MatchRejectedEvent = { type: "MatchRejected"; raw: unknown; errors: ValidationIssue[] };
export type AggregationCompletedEvent = { type: "AggregationCompleted"; summary: PipelineRunSummary };

export type PipelineEvent =
  | MatchImportedEvent
  | MatchUpdatedEvent
  | MatchIgnoredEvent
  | MatchDuplicatedEvent
  | MatchRejectedEvent
  | AggregationCompletedEvent;

export type PipelineEventListener = (event: PipelineEvent) => void;

/** Event bus síncrono, em memória, sem bibliotecas externas. */
export class PipelineEventBus {
  private readonly listeners: PipelineEventListener[] = [];

  /** Registra um listener; devolve uma função para removê-lo. */
  on(listener: PipelineEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  emit(event: PipelineEvent): void {
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }

  listenerCount(): number {
    return this.listeners.length;
  }
}
