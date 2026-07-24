// Fase 3.5 - Observabilidade e Validacao em Producao.
// Contrato de persistencia da camada de observabilidade. Nenhum modulo
// de src/services/observability/ pode chamar o Prisma diretamente —
// toda leitura/escrita passa por esta interface, implementada por
// InMemoryObservabilityRepository (padrao, obrigatorio) ou por
// PrismaObservabilityRepository (adapter opcional, Secao "Persistencia"
// da missao). Nenhum metodo aqui expõe token ou payload bruto da
// BetsAPI - apenas os tipos ja sanitizados de types.ts.

import type { DataQualitySnapshot, ObservabilityAlert, SyncRun } from "../../services/observability/types.ts";

export type ObservabilityRepositoryStatus = "available" | "unavailable";

export type ObservabilityRepositoryHealth = {
  status: ObservabilityRepositoryStatus;
  backend: "memory" | "prisma";
  detail: string | null;
};

export interface ObservabilityRepository {
  health(): Promise<ObservabilityRepositoryHealth>;

  saveSyncRun(run: SyncRun): Promise<void>;
  listSyncRuns(limit?: number): Promise<SyncRun[]>;

  saveSnapshot(snapshot: DataQualitySnapshot): Promise<void>;
  listSnapshots(limit?: number): Promise<DataQualitySnapshot[]>;
  latestSnapshot(): Promise<DataQualitySnapshot | null>;

  saveAlert(alert: ObservabilityAlert): Promise<void>;
  listAlerts(limit?: number): Promise<ObservabilityAlert[]>;

  /**
   * Remove registros de SyncRun/DataQualitySnapshot/ObservabilityAlert
   * mais antigos que `retentionDays` dias, medidos a partir de `now`.
   * Retorna a contagem de registros removidos por categoria. NUNCA e
   * chamada automaticamente na importacao do modulo - somente quando
   * explicitamente invocada (ver Secao "Retencao" da missao/documentacao).
   */
  pruneOlderThan(retentionDays: number, now?: Date): Promise<{ syncRuns: number; snapshots: number; alerts: number }>;
}
