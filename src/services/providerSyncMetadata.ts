// Sprint 9.2.1 — Provider Go Live & Live Data Pipeline.
// Formato compartilhado do metadata estruturado gravado em `AuditLog`
// (categoria "PROVIDER_SYNC") por `syncOddsAndTips()` (Fase 8) — lido
// tanto pelo health endpoint (`providerManager.getProvidersStatus`,
// Fase 6) quanto pelo Dashboard (`dashboardSnapshotService`, Fase 5).
// Nenhuma migration: `AuditLog.metadata` ja existe como coluna de texto
// livre, apenas o formato do JSON dentro dela e novo e agora
// centralizado aqui para nunca ser reimplementado em dois lugares.

export type ProviderSyncMetadata = {
  provider?: string | null;
  sport?: string | null;
  league?: string | null;
  market?: string | null;
  eventsFound?: number | null;
  eventsPersisted?: number | null;
  oddsFound?: number | null;
  oddsPersisted?: number | null;
  duplicatesSkipped?: number | null;
  durationMs?: number | null;
};

export function parseProviderSyncMetadata(raw: string | null | undefined): ProviderSyncMetadata | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProviderSyncMetadata;
  } catch {
    return null;
  }
}
