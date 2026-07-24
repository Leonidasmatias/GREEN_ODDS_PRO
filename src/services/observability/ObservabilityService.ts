// Fase 3.5 - Observabilidade e Validacao em Producao.
// ObservabilityService: fachada unica que orquestra os demais modulos
// desta camada (SyncRunTracker, DataQualityEngine, AlertRuleEngine,
// ProductionReadinessEvaluator, ObservabilityReportBuilder) contra um
// ObservabilityRepository injetado. Nenhum metodo aqui acessa Prisma
// diretamente, altera o Intelligence Engine, ou expoe credenciais da
// BetsAPI. E o unico ponto de entrada recomendado para o restante da
// aplicacao (rotas administrativas futuras devem falar apenas com esta
// classe, nunca com os modulos internos diretamente - ver
// ObservabilityQueryService/documentacao para as regras de exposicao).

import { randomUUID } from "node:crypto";
import type { ObservabilityRepository } from "../../repositories/observability/ObservabilityRepository.ts";
import { loadObservabilityConfig, type ObservabilityConfig } from "./ObservabilityConfig.ts";
import { SyncRunTracker, type TrackedSyncResult } from "./SyncRunTracker.ts";
import { computeDataQualitySnapshot, type DataQualityEngineInput } from "./DataQualityEngine.ts";
import { evaluateAlerts, type AlertEvaluationInput } from "./AlertRuleEngine.ts";
import { evaluateProductionReadiness, type ReadinessEvaluationInput } from "./ProductionReadinessEvaluator.ts";
import {
  buildObservabilityReport,
  reportToJson,
  reportToMarkdown,
  reportToObject,
  type ObservabilityReport,
  type ObservabilityReportInput,
} from "./ObservabilityReportBuilder.ts";
import type { BetsApiSyncMode, BetsApiSyncService } from "../../providers/betsapi/BetsApiSyncService.ts";
import type { DataQualitySnapshot, ObservabilityAlert, ProductionReadinessResult } from "./types.ts";

export type ObservabilityServiceOptions = {
  repository: ObservabilityRepository;
  config?: ObservabilityConfig;
  now?: () => Date;
  idGenerator?: () => string;
};

export class ObservabilityService {
  readonly config: ObservabilityConfig;
  readonly repository: ObservabilityRepository;
  readonly syncRunTracker: SyncRunTracker;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  constructor(options: ObservabilityServiceOptions) {
    this.repository = options.repository;
    this.config = options.config ?? loadObservabilityConfig();
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.syncRunTracker = new SyncRunTracker({ repository: this.repository, now: this.now, idGenerator: this.idGenerator });
  }

  /** Instrumenta uma execucao real do BetsApiSyncService (Fase 3) sem alterar aquele arquivo. */
  async trackSync(
    syncService: Pick<BetsApiSyncService, "run">,
    mode: BetsApiSyncMode,
    params: { day?: string } = {},
  ): Promise<TrackedSyncResult> {
    return this.syncRunTracker.track(syncService, mode, params);
  }

  async computeAndSaveSnapshot(
    input: Omit<DataQualityEngineInput, "weights" | "staleDataMinutes" | "now" | "idGenerator">,
  ): Promise<DataQualitySnapshot> {
    const snapshot = computeDataQualitySnapshot({
      ...input,
      weights: this.config.weights,
      staleDataMinutes: this.config.staleDataMinutes,
      now: this.now,
      idGenerator: this.idGenerator,
    });
    await this.repository.saveSnapshot(snapshot);
    return snapshot;
  }

  async evaluateAndSaveAlerts(input: Omit<AlertEvaluationInput, "now">): Promise<ObservabilityAlert[]> {
    const alerts = evaluateAlerts({ ...input, now: this.now }, this.config);
    for (const alert of alerts) await this.repository.saveAlert(alert);
    return alerts;
  }

  async evaluateReadiness(input: Omit<ReadinessEvaluationInput, "now">): Promise<ProductionReadinessResult> {
    return evaluateProductionReadiness({ ...input, now: this.now }, this.config);
  }

  async buildReport(input: Omit<ObservabilityReportInput, "retentionDays" | "now">): Promise<ObservabilityReport> {
    return buildObservabilityReport({ ...input, retentionDays: this.config.retentionDays, now: this.now });
  }

  reportAsObject = reportToObject;
  reportAsJson = reportToJson;
  reportAsMarkdown = reportToMarkdown;

  /**
   * Remove registros mais antigos que a politica de retencao configurada
   * (OBSERVABILITY_RETENTION_DAYS, default 30 dias). NUNCA e chamado
   * automaticamente na importacao deste modulo ou no construtor - apenas
   * quando um chamador externo invoca explicitamente este metodo (ex.:
   * uma rotina agendada futura), conforme exigido pela missao.
   */
  async pruneExpiredData(): Promise<{ syncRuns: number; snapshots: number; alerts: number }> {
    return this.repository.pruneOlderThan(this.config.retentionDays, this.now());
  }
}
