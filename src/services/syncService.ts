import { worldCupOpportunities } from "@/lib/worldCupEngine";
import { prisma } from "@/lib/prisma";
import { getProviderConfiguration, getProviderLiveFeed } from "@/providers/providerManager";
import { redactSecrets } from "./securityService";

export interface SyncResult { ok: boolean; mode: "REAL" | "MOCK"; provider: string; eventsReceived: number; snapshotsCreated: number; tipsCreated: number; warning?: string; databaseConnected: boolean; syncedAt: string; requestsRemaining?: number }

export async function syncOddsAndTips(): Promise<SyncResult> {
  const syncedAt = new Date().toISOString(); let runId: string | null = null; let providerId = "none";
  try {
    const feed = await getProviderLiveFeed(); providerId = feed.provider.id;
    if (!feed.provider.licensed && process.env.NODE_ENV === "production") throw new Error("Provider não licenciado bloqueado em produção");
    const run = await prisma.syncRun.create({ data: { provider: providerId, mode: feed.provider.licensed ? "REAL" : "MOCK", status: "RUNNING", requestsRemaining: feed.remainingLimit, warning: feed.failoverErrors.length ? feed.failoverErrors.join(" | ") : undefined } }); runId = run.id;
    const matches = await Promise.all(feed.matches.map((match) => prisma.match.upsert({ where: { providerId: match.providerId }, update: { competition: match.competition, homeTeam: match.homeTeam, awayTeam: match.awayTeam, startsAt: match.startsAt, status: match.status, homeScore: match.homeScore, awayScore: match.awayScore }, create: { providerId: match.providerId, competition: match.competition, homeTeam: match.homeTeam, awayTeam: match.awayTeam, startsAt: match.startsAt, status: match.status, homeScore: match.homeScore, awayScore: match.awayScore } })));
    const matchIds = new Map(matches.map((match) => [match.providerId!, match.id]));
    const snapshots = feed.odds.filter((odd) => matchIds.has(odd.providerEventId) && odd.odd > 1).map((odd) => ({ matchId: matchIds.get(odd.providerEventId)!, market: odd.market, selection: odd.selection, odd: odd.odd, provider: odd.bookmaker, capturedAt: odd.capturedAt }));
    const created = snapshots.length ? await prisma.oddsSnapshot.createMany({ data: snapshots }) : { count: 0 };
    let tipsCreated = 0; let duplicatesAvoided = 0;
    for (const opportunity of worldCupOpportunities.filter((item) => item.expectedValue > 0 && item.signal !== "Evitar")) {
      const match = matches.find((item) => `${item.homeTeam} x ${item.awayTeam}` === opportunity.game); if (!match) continue;
      const existing = await prisma.tip.findFirst({ where: { matchId: match.id, market: opportunity.market, selection: opportunity.pick, status: "PENDING" } }); if (existing) { duplicatesAvoided += 1; continue; }
      await prisma.tip.create({ data: { matchId: match.id, gameLabel: opportunity.game, market: opportunity.market, selection: opportunity.pick, odd: opportunity.odd, impliedProbability: opportunity.impliedProbability, estimatedProbability: opportunity.fairProbability, edge: opportunity.edge, expectedValue: opportunity.expectedValue, confidenceScore: opportunity.score, classification: opportunity.classification, risk: opportunity.risk } }); tipsCreated += 1;
    }
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", eventsReceived: matches.length, snapshotsCreated: created.count, tipsCreated, completedAt: new Date() } });
    await prisma.auditLog.create({ data: { category: "PROVIDER_SYNC", status: "SUCCESS", message: `${providerId}: ${matches.length} partidas e ${created.count} odds.`, metadata: JSON.stringify({ provider: providerId, duplicatesAvoided, configuration: getProviderConfiguration() }) } });
    return { ok: true, mode: feed.provider.licensed ? "REAL" : "MOCK", provider: providerId, eventsReceived: matches.length, snapshotsCreated: created.count, tipsCreated, warning: feed.failoverErrors.join(" | ") || undefined, databaseConnected: true, syncedAt, requestsRemaining: feed.remainingLimit };
  } catch (error) {
    const warning = redactSecrets(error instanceof Error ? error.message : "Falha desconhecida");
    if (runId) await prisma.syncRun.update({ where: { id: runId }, data: { status: "FAILED", warning, completedAt: new Date() } }).catch(() => undefined);
    return { ok: false, mode: "REAL", provider: providerId, eventsReceived: 0, snapshotsCreated: 0, tipsCreated: 0, warning, databaseConnected: true, syncedAt };
  }
}

export async function getSystemStatus() {
  try { await prisma.$queryRaw`SELECT 1`; const latest = await prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }); return { apiConfigured: getProviderConfiguration().priority.length > 0, databaseConfigured: Boolean(process.env.DATABASE_URL), databaseConnected: true, mode: latest?.mode ?? "REAL", provider: latest?.provider ?? "none", lastSync: latest?.completedAt?.toISOString() ?? null, lastStatus: latest?.status ?? "NOT_RUN", warning: latest?.warning ?? null, requestsRemaining: latest?.requestsRemaining ?? null }; }
  catch { return { apiConfigured: false, databaseConfigured: Boolean(process.env.DATABASE_URL), databaseConnected: false, mode: "REAL", provider: "none", lastSync: null, lastStatus: "DATABASE_OFFLINE", warning: "Banco indisponível", requestsRemaining: null }; }
}
