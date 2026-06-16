import { prisma } from "@/lib/prisma";
import { getProviderConfiguration, getProviderLiveFeed } from "@/providers/providerManager";
import { redactSecrets } from "./securityService";

export interface SyncResult { ok: boolean; mode: "REAL"; provider: string; eventsReceived: number; snapshotsCreated: number; tipsCreated: number; warning?: string; databaseConnected: boolean; syncedAt: string; requestsRemaining?: number }

export async function syncOddsAndTips(): Promise<SyncResult> {
  const syncedAt = new Date().toISOString(); let runId: string | null = null; let providerId = "none";
  try {
    const feed = await getProviderLiveFeed(); providerId = feed.provider.id;
    if (!feed.provider.licensed) throw new Error("Provider nao licenciado bloqueado");
    const run = await prisma.syncRun.create({ data: { provider: providerId, mode: "REAL", status: "RUNNING", requestsRemaining: feed.remainingLimit, warning: feed.failoverErrors.length ? feed.failoverErrors.join(" | ") : undefined } }); runId = run.id;
    const matches = await Promise.all(feed.matches.map((match) => prisma.match.upsert({ where: { providerId: match.providerId }, update: { competition: match.competition, homeTeam: match.homeTeam, awayTeam: match.awayTeam, startsAt: match.startsAt, status: match.status, homeScore: match.homeScore, awayScore: match.awayScore }, create: { providerId: match.providerId, competition: match.competition, homeTeam: match.homeTeam, awayTeam: match.awayTeam, startsAt: match.startsAt, status: match.status, homeScore: match.homeScore, awayScore: match.awayScore } })));
    const matchIds = new Map(matches.map((match) => [match.providerId!, match.id]));
    const snapshots = feed.odds.filter((odd) => matchIds.has(odd.providerEventId) && odd.odd > 1).map((odd) => ({ matchId: matchIds.get(odd.providerEventId)!, market: odd.market, selection: odd.selection, odd: odd.odd, provider: odd.bookmaker, capturedAt: odd.capturedAt }));
    const created = snapshots.length ? await prisma.oddsSnapshot.createMany({ data: snapshots }) : { count: 0 };
    const tipsCreated = 0;
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", eventsReceived: matches.length, snapshotsCreated: created.count, tipsCreated, completedAt: new Date() } });
    await prisma.auditLog.create({ data: { category: "PROVIDER_SYNC", status: "SUCCESS", message: `${providerId}: ${matches.length} partidas e ${created.count} odds.`, metadata: JSON.stringify({ provider: providerId, configuration: getProviderConfiguration() }) } });
    return { ok: true, mode: "REAL", provider: providerId, eventsReceived: matches.length, snapshotsCreated: created.count, tipsCreated, warning: feed.failoverErrors.join(" | ") || undefined, databaseConnected: true, syncedAt, requestsRemaining: feed.remainingLimit };
  } catch (error) {
    const warning = redactSecrets(error instanceof Error ? error.message : "Falha desconhecida");
    if (runId) await prisma.syncRun.update({ where: { id: runId }, data: { status: "FAILED", warning, completedAt: new Date() } }).catch(() => undefined);
    return { ok: false, mode: "REAL", provider: providerId, eventsReceived: 0, snapshotsCreated: 0, tipsCreated: 0, warning, databaseConnected: true, syncedAt };
  }
}

export async function getSystemStatus() {
  try { await prisma.$queryRaw`SELECT 1`; const latest = await prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }); return { apiConfigured: getProviderConfiguration().priority.length > 0, databaseConfigured: Boolean(process.env.DATABASE_URL), databaseConnected: true, mode: "REAL", provider: latest?.provider ?? "none", lastSync: latest?.completedAt?.toISOString() ?? null, lastStatus: latest?.status ?? "NOT_RUN", warning: latest?.warning ?? null, requestsRemaining: latest?.requestsRemaining ?? null }; }
  catch { return { apiConfigured: false, databaseConfigured: Boolean(process.env.DATABASE_URL), databaseConnected: false, mode: "REAL", provider: "none", lastSync: null, lastStatus: "DATABASE_OFFLINE", warning: "Banco indisponivel", requestsRemaining: null }; }
}
