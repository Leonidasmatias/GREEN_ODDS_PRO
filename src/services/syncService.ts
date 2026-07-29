import { prisma } from "@/lib/prisma";
import { getProviderConfiguration, getProviderLiveFeed } from "@/providers/providerManager";
import { redactSecrets } from "./securityService";

export interface SyncResult {
  ok: boolean;
  mode: "REAL";
  provider: string;
  eventsReceived: number;
  snapshotsCreated: number;
  tipsCreated: number;
  warning?: string;
  databaseConnected: boolean;
  syncedAt: string;
  requestsRemaining?: number;
  /** Sprint 9.2.1 — esporte/liga efetivamente usados nesta sincronizacao (quando o provider suporta selecao dinamica). */
  sport?: string | null;
  league?: string | null;
  /** Sprint 9.2.1 — odds identicas a um snapshot ja persistido (mesmo matchId/market/selection/provider/capturedAt), descartadas para nunca duplicar dado. */
  duplicatesSkipped?: number;
}

/** Sprint 9.2.1, Fase 7 — janela em que um OddsSnapshot existente e
 * considerado para deduplicacao. Nao ha unique constraint no banco (fora
 * do escopo desta sprint: nenhuma migration), entao a idempotencia e
 * garantida na aplicacao: antes de inserir, consulta-se o que ja existe
 * para os mesmos matches nesta janela e descarta-se qualquer combinacao
 * (matchId, market, selection, provider, capturedAt) repetida. */
const RECENT_SNAPSHOT_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

function snapshotDedupKey(snapshot: { matchId: string; market: string; selection: string; provider: string; capturedAt: Date }): string {
  return `${snapshot.matchId}|${snapshot.market}|${snapshot.selection}|${snapshot.provider}|${snapshot.capturedAt.getTime()}`;
}

export async function syncOddsAndTips(): Promise<SyncResult> {
  const syncStartedAt = Date.now();
  const syncedAt = new Date(syncStartedAt).toISOString();
  let runId: string | null = null;
  let providerId = "none";

  try {
    const feed = await getProviderLiveFeed();
    providerId = feed.provider.id;
    if (!feed.provider.licensed) throw new Error("Provider nao licenciado bloqueado");

    const syncContext = feed.provider.getLastSyncContext?.() ?? null;

    const run = await prisma.syncRun.create({
      data: {
        provider: providerId,
        mode: "REAL",
        status: "RUNNING",
        requestsRemaining: feed.remainingLimit,
        warning: feed.failoverErrors.length ? feed.failoverErrors.join(" | ") : undefined,
      },
    });
    runId = run.id;

    // Fase 7 — UPSERT de matches (ja idempotente via unique providerId) +
    // dedup de odds, tudo dentro de uma unica transacao Prisma: se
    // qualquer etapa falhar, nada e persistido (rollback automatico).
    const persistence = await prisma.$transaction(async (tx) => {
      const matches = await Promise.all(
        feed.matches.map((match) =>
          tx.match.upsert({
            where: { providerId: match.providerId },
            update: { competition: match.competition, homeTeam: match.homeTeam, awayTeam: match.awayTeam, startsAt: match.startsAt, status: match.status, homeScore: match.homeScore, awayScore: match.awayScore },
            create: { providerId: match.providerId, competition: match.competition, homeTeam: match.homeTeam, awayTeam: match.awayTeam, startsAt: match.startsAt, status: match.status, homeScore: match.homeScore, awayScore: match.awayScore },
          }),
        ),
      );
      const matchIds = new Map(matches.map((match) => [match.providerId!, match.id]));

      const candidateSnapshots = feed.odds
        .filter((odd) => matchIds.has(odd.providerEventId) && odd.odd > 1)
        .map((odd) => ({ matchId: matchIds.get(odd.providerEventId)!, market: odd.market, selection: odd.selection, odd: odd.odd, provider: odd.bookmaker, capturedAt: odd.capturedAt }));

      const relevantMatchIds = [...new Set(candidateSnapshots.map((snapshot) => snapshot.matchId))];
      const existing = relevantMatchIds.length
        ? await tx.oddsSnapshot.findMany({
            where: { matchId: { in: relevantMatchIds }, capturedAt: { gte: new Date(syncStartedAt - RECENT_SNAPSHOT_DEDUP_WINDOW_MS) } },
            select: { matchId: true, market: true, selection: true, provider: true, capturedAt: true },
          })
        : [];
      const existingKeys = new Set(existing.map(snapshotDedupKey));
      const newSnapshots = candidateSnapshots.filter((snapshot) => !existingKeys.has(snapshotDedupKey(snapshot)));
      const duplicatesSkipped = candidateSnapshots.length - newSnapshots.length;
      const created = newSnapshots.length ? await tx.oddsSnapshot.createMany({ data: newSnapshots }) : { count: 0 };

      return { matchesPersisted: matches.length, oddsCandidates: candidateSnapshots.length, oddsPersisted: created.count, duplicatesSkipped };
    });

    const tipsCreated = 0;
    const durationMs = Date.now() - syncStartedAt;

    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", eventsReceived: feed.matches.length, snapshotsCreated: persistence.oddsPersisted, tipsCreated, completedAt: new Date() },
    });

    // Fase 8 — observabilidade: metadados estruturados da execucao
    // (esporte/liga/mercado/contagens/duracao), reaproveitando o campo
    // AuditLog.metadata ja existente (nenhuma migration necessaria).
    await prisma.auditLog.create({
      data: {
        category: "PROVIDER_SYNC",
        status: "SUCCESS",
        message: `${providerId}: ${feed.matches.length} partidas e ${persistence.oddsPersisted} odds.`,
        metadata: JSON.stringify({
          provider: providerId,
          sport: syncContext?.sport ?? null,
          league: syncContext?.league ?? null,
          market: "h2h,totals,spreads",
          eventsFound: feed.matches.length,
          eventsPersisted: persistence.matchesPersisted,
          oddsFound: feed.odds.length,
          oddsCandidates: persistence.oddsCandidates,
          oddsPersisted: persistence.oddsPersisted,
          duplicatesSkipped: persistence.duplicatesSkipped,
          durationMs,
          configuration: getProviderConfiguration(),
        }),
      },
    }).catch(() => undefined);

    return {
      ok: true,
      mode: "REAL",
      provider: providerId,
      eventsReceived: feed.matches.length,
      snapshotsCreated: persistence.oddsPersisted,
      tipsCreated,
      warning: feed.empty ? "Nenhum evento encontrado nas ligas monitoradas no momento (provider saudavel)." : feed.failoverErrors.join(" | ") || undefined,
      databaseConnected: true,
      syncedAt,
      requestsRemaining: feed.remainingLimit,
      sport: syncContext?.sport ?? null,
      league: syncContext?.league ?? null,
      duplicatesSkipped: persistence.duplicatesSkipped,
    };
  } catch (error) {
    const warning = redactSecrets(error instanceof Error ? error.message : "Falha desconhecida");
    if (runId) await prisma.syncRun.update({ where: { id: runId }, data: { status: "FAILED", warning, completedAt: new Date() } }).catch(() => undefined);
    await prisma.auditLog.create({
      data: { category: "PROVIDER_SYNC", status: "FAILED", message: `${providerId}: ${warning}`, metadata: JSON.stringify({ provider: providerId, durationMs: Date.now() - syncStartedAt }) },
    }).catch(() => undefined);
    return { ok: false, mode: "REAL", provider: providerId, eventsReceived: 0, snapshotsCreated: 0, tipsCreated: 0, warning, databaseConnected: true, syncedAt };
  }
}

export async function getSystemStatus() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latest = await prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } });
    return {
      apiConfigured: getProviderConfiguration().priority.length > 0,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      databaseConnected: true,
      mode: "REAL",
      provider: latest?.provider ?? "none",
      lastSync: latest?.completedAt?.toISOString() ?? null,
      lastStatus: latest?.status ?? "NOT_RUN",
      warning: latest?.warning ?? null,
      requestsRemaining: latest?.requestsRemaining ?? null,
    };
  } catch {
    return { apiConfigured: false, databaseConfigured: Boolean(process.env.DATABASE_URL), databaseConnected: false, mode: "REAL", provider: "none", lastSync: null, lastStatus: "DATABASE_OFFLINE", warning: "Banco indisponivel", requestsRemaining: null };
  }
}
