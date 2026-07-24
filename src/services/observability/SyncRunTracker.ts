// Fase 3.5 - Observabilidade e Validacao em Producao.
// SyncRunTracker: instrumenta uma execucao do BetsApiSyncService (Fase 3)
// SEM alterar uma unica linha daquele arquivo. Em vez de injetar um
// parametro novo dentro de BetsApiSyncServiceOptions, este modulo usa o
// mesmo padrao de composicao ja estabelecido nesta base (LiveBetsApiProvider
// e BetsApiHealthCheck tambem envolvem contratos da Fase 2 sem modifica-los):
// SyncRunTracker.track(...) chama syncService.run(...) por fora, cronometra,
// converte o BetsApiSyncReport resultante em um SyncRun (Fase 3.5) e
// persiste via ObservabilityRepository. E 100% opcional - nada no fluxo
// existente do BetsApiSyncService muda, e nenhum teste da Fase 3 e afetado.

import { randomUUID } from "node:crypto";
import type { ObservabilityRepository } from "../../repositories/observability/ObservabilityRepository.ts";
import type {
  BetsApiSyncMode,
  BetsApiSyncReport,
  BetsApiSyncService,
} from "../../providers/betsapi/BetsApiSyncService.ts";
import type { SyncRun, SyncRunStatus } from "./types.ts";
import { sanitizeObservabilityMessage } from "./ObservabilityRedaction.ts";

export type SyncRunTrackerOptions = {
  repository: ObservabilityRepository;
  idGenerator?: () => string;
  now?: () => Date;
};

export type TrackedSyncResult = {
  report: BetsApiSyncReport;
  syncRun: SyncRun;
};

function statusFromReport(report: BetsApiSyncReport): SyncRunStatus {
  if (report.errors > 0 && report.imported === 0 && report.updated === 0) return "failed";
  if (report.errors > 0) return "partial";
  return "success";
}

function syncRunFromReport(id: string, report: BetsApiSyncReport): SyncRun {
  return {
    id,
    provider: report.provider,
    mode: report.mode,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    durationMs: report.durationMs,
    status: statusFromReport(report),
    pagesFetched: report.pagesProcessed,
    eventsReceived: report.eventsReceived,
    confirmedEsoccer: report.confirmedEsoccer,
    probableEsoccer: report.probableEsoccer,
    rejected: report.rejected,
    duplicated: report.duplicated,
    imported: report.imported,
    updated: report.updated,
    errors: report.errors > 0 ? [`${report.errors} erro(s) reportado(s) pela IngestionPipeline/classificador.`] : [],
    rateLimitRemaining: report.rateLimitRemaining,
  };
}

export class SyncRunTracker {
  private readonly repository: ObservabilityRepository;
  private readonly idGenerator: () => string;
  private readonly now: () => Date;

  constructor(options: SyncRunTrackerOptions) {
    this.repository = options.repository;
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Executa syncService.run(mode, params), registra um SyncRun de
   * sucesso/parcial no repositorio e devolve o report original inalterado.
   * Se syncService.run lancar, registra um SyncRun com status "failed"
   * (mensagem sempre sanitizada) e relanca o erro original para o chamador.
   */
  async track(
    syncService: Pick<BetsApiSyncService, "run">,
    mode: BetsApiSyncMode,
    params: { day?: string } = {},
  ): Promise<TrackedSyncResult> {
    const startedAt = this.now();
    const id = this.idGenerator();

    try {
      const report = await syncService.run(mode, params);
      const syncRun = syncRunFromReport(id, report);
      await this.repository.saveSyncRun(syncRun);
      return { report, syncRun };
    } catch (error) {
      const finishedAt = this.now();
      const message = sanitizeObservabilityMessage(error instanceof Error ? error.message : String(error));
      const failedSyncRun: SyncRun = {
        id,
        provider: "BETSAPI",
        mode,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        status: "failed",
        pagesFetched: 0,
        eventsReceived: 0,
        confirmedEsoccer: 0,
        probableEsoccer: 0,
        rejected: 0,
        duplicated: 0,
        imported: 0,
        updated: 0,
        errors: [message],
        rateLimitRemaining: null,
      };
      await this.repository.saveSyncRun(failedSyncRun);
      throw error;
    }
  }
}
