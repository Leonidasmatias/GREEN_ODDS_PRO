// Fase 3.5 - Observabilidade e Validacao em Producao.
// Adapter OPCIONAL de persistencia via Prisma. Esta fase NAO cria tabelas
// nem migrations novas para observabilidade (proibido pela missao) - o
// schema Prisma existente nao possui modelos de SyncRun/DataQualitySnapshot/
// ObservabilityAlert. Por isso esta classe funciona hoje sempre em modo
// "unavailable": ela existe como contrato/adapter pronto para uma fase
// futura que adicione o schema real, mas nunca finge sucesso silencioso -
// toda chamada de escrita/leitura sem um client Prisma compativel
// injetado lanca ObservabilityStorageUnavailableError de forma
// estruturada, e health() reporta status "unavailable" com o motivo.

import type {
  ObservabilityRepository,
  ObservabilityRepositoryHealth,
} from "./ObservabilityRepository.ts";
import type { DataQualitySnapshot, ObservabilityAlert, SyncRun } from "../../services/observability/types.ts";

/** Forma minima que um client Prisma precisaria expor para esta fase deixar de estar "unavailable". Nao existe hoje no schema. */
export type ObservabilityPrismaClientLike = {
  observabilitySyncRun?: unknown;
  observabilityDataQualitySnapshot?: unknown;
  observabilityAlert?: unknown;
};

export class ObservabilityStorageUnavailableError extends Error {
  readonly code = "OBSERVABILITY_STORAGE_UNAVAILABLE";
  constructor(operation: string) {
    super(
      `PrismaObservabilityRepository indisponivel para "${operation}": nenhum modelo Prisma de observabilidade existe no schema atual (Fase 3.5 nao adiciona migrations). Use InMemoryObservabilityRepository ou aguarde uma fase futura que introduza o schema real.`,
    );
    this.name = "ObservabilityStorageUnavailableError";
  }
}

function isCompatibleClient(client: ObservabilityPrismaClientLike | null | undefined): boolean {
  return (
    !!client &&
    typeof client.observabilitySyncRun !== "undefined" &&
    typeof client.observabilityDataQualitySnapshot !== "undefined" &&
    typeof client.observabilityAlert !== "undefined"
  );
}

export class PrismaObservabilityRepository implements ObservabilityRepository {
  private readonly client: ObservabilityPrismaClientLike | null;
  private readonly available: boolean;

  constructor(client: ObservabilityPrismaClientLike | null = null) {
    this.client = client;
    this.available = isCompatibleClient(client);
  }

  async health(): Promise<ObservabilityRepositoryHealth> {
    return {
      status: this.available ? "available" : "unavailable",
      backend: "prisma",
      detail: this.available
        ? null
        : "Schema Prisma atual nao possui modelos de observabilidade (nenhuma migration foi criada nesta fase).",
    };
  }

  async saveSyncRun(_run: SyncRun): Promise<void> {
    if (!this.available) throw new ObservabilityStorageUnavailableError("saveSyncRun");
  }

  async listSyncRuns(_limit?: number): Promise<SyncRun[]> {
    if (!this.available) throw new ObservabilityStorageUnavailableError("listSyncRuns");
    return [];
  }

  async saveSnapshot(_snapshot: DataQualitySnapshot): Promise<void> {
    if (!this.available) throw new ObservabilityStorageUnavailableError("saveSnapshot");
  }

  async listSnapshots(_limit?: number): Promise<DataQualitySnapshot[]> {
    if (!this.available) throw new ObservabilityStorageUnavailableError("listSnapshots");
    return [];
  }

  async latestSnapshot(): Promise<DataQualitySnapshot | null> {
    if (!this.available) throw new ObservabilityStorageUnavailableError("latestSnapshot");
    return null;
  }

  async saveAlert(_alert: ObservabilityAlert): Promise<void> {
    if (!this.available) throw new ObservabilityStorageUnavailableError("saveAlert");
  }

  async listAlerts(_limit?: number): Promise<ObservabilityAlert[]> {
    if (!this.available) throw new ObservabilityStorageUnavailableError("listAlerts");
    return [];
  }

  async pruneOlderThan(_retentionDays: number, _now?: Date): Promise<{ syncRuns: number; snapshots: number; alerts: number }> {
    if (!this.available) throw new ObservabilityStorageUnavailableError("pruneOlderThan");
    return { syncRuns: 0, snapshots: 0, alerts: 0 };
  }
}
