// Fase 3.5 - Observabilidade e Validacao em Producao.
// Implementacao padrao (obrigatoria) do ObservabilityRepository, guardando
// tudo em memoria do processo. Usada por default sempre que
// ObservabilityConfig.storageMode === "memory" (o default de fabrica).
// Nenhum dado sobrevive ao reinicio do processo - isso e esperado e
// documentado: esta fase nao ativa persistencia real por padrao.

import type {
  ObservabilityRepository,
  ObservabilityRepositoryHealth,
} from "./ObservabilityRepository.ts";
import type { DataQualitySnapshot, ObservabilityAlert, SyncRun } from "../../services/observability/types.ts";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class InMemoryObservabilityRepository implements ObservabilityRepository {
  private readonly syncRuns: SyncRun[] = [];
  private readonly snapshots: DataQualitySnapshot[] = [];
  private readonly alerts: ObservabilityAlert[] = [];

  async health(): Promise<ObservabilityRepositoryHealth> {
    return { status: "available", backend: "memory", detail: null };
  }

  async saveSyncRun(run: SyncRun): Promise<void> {
    this.syncRuns.push(run);
  }

  async listSyncRuns(limit?: number): Promise<SyncRun[]> {
    const ordered = [...this.syncRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return limit === undefined ? ordered : ordered.slice(0, limit);
  }

  async saveSnapshot(snapshot: DataQualitySnapshot): Promise<void> {
    this.snapshots.push(snapshot);
  }

  async listSnapshots(limit?: number): Promise<DataQualitySnapshot[]> {
    const ordered = [...this.snapshots].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    return limit === undefined ? ordered : ordered.slice(0, limit);
  }

  async latestSnapshot(): Promise<DataQualitySnapshot | null> {
    const ordered = await this.listSnapshots(1);
    return ordered[0] ?? null;
  }

  async saveAlert(alert: ObservabilityAlert): Promise<void> {
    this.alerts.push(alert);
  }

  async listAlerts(limit?: number): Promise<ObservabilityAlert[]> {
    const ordered = [...this.alerts].sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));
    return limit === undefined ? ordered : ordered.slice(0, limit);
  }

  async pruneOlderThan(retentionDays: number, now: Date = new Date()): Promise<{ syncRuns: number; snapshots: number; alerts: number }> {
    const cutoff = now.getTime() - retentionDays * MS_PER_DAY;

    const keepSyncRuns = this.syncRuns.filter((run) => new Date(run.startedAt).getTime() >= cutoff);
    const removedSyncRuns = this.syncRuns.length - keepSyncRuns.length;
    this.syncRuns.length = 0;
    this.syncRuns.push(...keepSyncRuns);

    const keepSnapshots = this.snapshots.filter((snapshot) => new Date(snapshot.generatedAt).getTime() >= cutoff);
    const removedSnapshots = this.snapshots.length - keepSnapshots.length;
    this.snapshots.length = 0;
    this.snapshots.push(...keepSnapshots);

    const keepAlerts = this.alerts.filter((alert) => new Date(alert.triggeredAt).getTime() >= cutoff);
    const removedAlerts = this.alerts.length - keepAlerts.length;
    this.alerts.length = 0;
    this.alerts.push(...keepAlerts);

    return { syncRuns: removedSyncRuns, snapshots: removedSnapshots, alerts: removedAlerts };
  }
}
