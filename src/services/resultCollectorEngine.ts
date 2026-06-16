import { prisma } from "@/lib/prisma";
import { getProviderResults } from "@/providers/providerManager";
import type { ProviderResult } from "@/providers/types";
import { runAdaptiveStrategy } from "./adaptiveStrategyEngine";
import { runAutoDiscovery } from "./autoDiscoveryEngine";
import { runPerformanceAttribution } from "./performanceAttributionEngine";
import { refreshSmartRankings } from "./rankingEngine";
import { refreshSmartConfidence } from "./smartConfidenceEngine";
import { settlePendingTips } from "./settlementEngine";
import { trainBaselineModel } from "./mlEngine";
import { redactSecrets } from "./securityService";

type PrismaWithPhase28 = typeof prisma & {
  matchResult: {
    count: typeof prisma.tip.count;
    findFirst: (args?: unknown) => Promise<unknown>;
    findMany: (args?: unknown) => Promise<Array<{ status: string }>>;
    upsert: (args: unknown) => Promise<unknown>;
  };
  resultSyncRun: {
    create: (args: unknown) => Promise<{ id: string; startedAt: Date }>;
    update: (args: unknown) => Promise<unknown>;
    findFirst: (args?: unknown) => Promise<unknown>;
  };
  settlementAudit: {
    create: (args: unknown) => Promise<{ id: string }>;
    findFirst: (args?: unknown) => Promise<unknown>;
  };
};

const phase28 = prisma as PrismaWithPhase28;

export type ResultCollectorMetrics = {
  provider: string;
  resultsReceived: number;
  resultsPersisted: number;
  matchesUpdated: number;
  pendingResults: number;
  tipsProcessed: number;
  tipsSettled: number;
  won: number;
  lost: number;
  voids: number;
  settlementRate: number;
  lastSync: string | null;
};

function isRealLicensedProvider(provider: { id: string; licensed: boolean; isConfigured(): boolean }) {
  return provider.licensed && provider.id !== "mock" && provider.isConfigured();
}

function toRawPayload(result: ProviderResult) {
  return JSON.stringify({
    providerId: result.providerId,
    competition: result.competition,
    homeTeam: result.homeTeam,
    awayTeam: result.awayTeam,
    startsAt: result.startsAt.toISOString(),
    status: result.status,
    homeScore: result.homeScore ?? null,
    awayScore: result.awayScore ?? null,
  });
}

export async function collectMatchResults() {
  const response = await getProviderResults();
  if (!isRealLicensedProvider(response.provider)) {
    throw new Error(`Provider ${response.provider.id} nao autorizado para coleta real de resultados.`);
  }
  return {
    provider: response.provider.id,
    results: response.data,
    remainingLimit: response.remainingLimit,
    failoverErrors: response.failoverErrors,
  };
}

export async function persistMatchResults(input: { provider: string; results: ProviderResult[] }) {
  const collectedAt = new Date();
  const receivedProviderIds = new Set(input.results.map((result) => result.providerId));
  let resultsPersisted = 0;
  let matchesUpdated = 0;

  for (const result of input.results) {
    const finishedAt = result.status === "FINISHED" || result.status === "CANCELLED" ? collectedAt : null;
    const match = await prisma.match.upsert({
      where: { providerId: result.providerId },
      update: {
        competition: result.competition,
        homeTeam: result.homeTeam,
        awayTeam: result.awayTeam,
        startsAt: result.startsAt,
        status: result.status,
        homeScore: result.homeScore ?? null,
        awayScore: result.awayScore ?? null,
      },
      create: {
        providerId: result.providerId,
        competition: result.competition,
        homeTeam: result.homeTeam,
        awayTeam: result.awayTeam,
        startsAt: result.startsAt,
        status: result.status,
        homeScore: result.homeScore ?? null,
        awayScore: result.awayScore ?? null,
      },
    });

    await phase28.matchResult.upsert({
      where: { provider_providerId: { provider: input.provider, providerId: result.providerId } },
      update: {
        matchId: match.id,
        competition: result.competition,
        homeTeam: result.homeTeam,
        awayTeam: result.awayTeam,
        homeScore: result.homeScore ?? null,
        awayScore: result.awayScore ?? null,
        status: result.status,
        rawPayload: toRawPayload(result),
        collectedAt,
        finishedAt,
      },
      create: {
        matchId: match.id,
        providerId: result.providerId,
        provider: input.provider,
        competition: result.competition,
        homeTeam: result.homeTeam,
        awayTeam: result.awayTeam,
        homeScore: result.homeScore ?? null,
        awayScore: result.awayScore ?? null,
        status: result.status,
        source: "PROVIDER",
        rawPayload: toRawPayload(result),
        collectedAt,
        finishedAt,
      },
    });
    resultsPersisted += 1;
    matchesUpdated += 1;
  }

  const pendingMatches = await prisma.match.findMany({
    where: {
      providerId: { startsWith: `${input.provider}:` },
      status: { notIn: ["FINISHED", "CANCELLED"] },
      startsAt: { lte: collectedAt },
    },
    take: 200,
  });

  let pendingResults = 0;
  for (const match of pendingMatches) {
    if (!match.providerId || receivedProviderIds.has(match.providerId)) continue;
    await phase28.matchResult.upsert({
      where: { provider_providerId: { provider: input.provider, providerId: match.providerId } },
      update: {
        matchId: match.id,
        competition: match.competition,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: null,
        awayScore: null,
        status: "PENDING",
        rawPayload: null,
        collectedAt,
        finishedAt: null,
      },
      create: {
        matchId: match.id,
        providerId: match.providerId,
        provider: input.provider,
        competition: match.competition,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: null,
        awayScore: null,
        status: "PENDING",
        source: "PROVIDER",
        rawPayload: null,
        collectedAt,
        finishedAt: null,
      },
    });
    pendingResults += 1;
  }

  return { resultsPersisted, matchesUpdated, pendingResults };
}

export async function triggerSettlement(provider: string) {
  const settlement = await settlePendingTips(provider);
  const downstream = await Promise.allSettled([
    runPerformanceAttribution(),
    refreshSmartConfidence(),
    trainBaselineModel(),
    runAutoDiscovery(),
    refreshSmartRankings(),
    runAdaptiveStrategy(),
  ]);
  return {
    settlement,
    downstream: downstream.map((result, index) => ({
      step: ["Performance Attribution", "Smart Confidence", "ML Engine", "Discovery Engine", "Ranking Engine", "Adaptive Strategy"][index],
      status: result.status,
      reason: result.status === "rejected" ? redactSecrets(result.reason instanceof Error ? result.reason.message : String(result.reason)) : undefined,
    })),
  };
}

export async function createSettlementAudit(input: {
  provider: string;
  resultSyncRunId?: string;
  settlementRunId?: string;
  resultsSynced: number;
  pendingResults: number;
  settlement: { tipsProcessed?: number; tipsSettled?: number; won?: number; lost?: number; voids?: number };
  downstream?: unknown;
  status?: string;
  reason?: string;
}) {
  const tipsProcessed = input.settlement.tipsProcessed ?? 0;
  const tipsSettled = input.settlement.tipsSettled ?? 0;
  const pending = Math.max(0, tipsProcessed - tipsSettled) + input.pendingResults;
  const settlementRate = tipsProcessed > 0 ? tipsSettled / tipsProcessed * 100 : 0;
  return phase28.settlementAudit.create({
    data: {
      provider: input.provider,
      resultSyncRunId: input.resultSyncRunId,
      settlementRunId: input.settlementRunId,
      resultsSynced: input.resultsSynced,
      tipsProcessed,
      tipsSettled,
      won: input.settlement.won ?? 0,
      lost: input.settlement.lost ?? 0,
      voids: input.settlement.voids ?? 0,
      pending,
      settlementRate,
      status: input.status ?? "SUCCESS",
      reason: input.reason,
      metadata: JSON.stringify({ downstream: input.downstream }),
    },
  });
}

export async function syncFinishedMatches() {
  const startedAt = new Date();
  const run = await phase28.resultSyncRun.create({ data: { provider: "pending-provider", startedAt, status: "RUNNING" } });
  try {
    const feed = await collectMatchResults();
    await phase28.resultSyncRun.update({ where: { id: run.id }, data: { provider: feed.provider, resultsReceived: feed.results.length, remainingLimit: feed.remainingLimit } });
    const persisted = await persistMatchResults({ provider: feed.provider, results: feed.results });
    const settlementFlow = await triggerSettlement(feed.provider);
    const audit = await createSettlementAudit({
      provider: feed.provider,
      resultSyncRunId: run.id,
      settlementRunId: settlementFlow.settlement.runId,
      resultsSynced: persisted.resultsPersisted,
      pendingResults: persisted.pendingResults,
      settlement: settlementFlow.settlement,
      downstream: settlementFlow.downstream,
    });
    const finishedAt = new Date();
    const result = {
      provider: feed.provider,
      resultsReceived: feed.results.length,
      resultsSynced: persisted.resultsPersisted,
      resultsPersisted: persisted.resultsPersisted,
      matchesUpdated: persisted.matchesUpdated,
      pendingResults: persisted.pendingResults,
      settlement: settlementFlow.settlement,
      settlementAuditId: audit.id,
      downstream: settlementFlow.downstream,
      remainingLimit: feed.remainingLimit,
      warning: feed.failoverErrors.join(" | ") || undefined,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };
    await phase28.resultSyncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt,
        resultsReceived: feed.results.length,
        resultsPersisted: persisted.resultsPersisted,
        matchesUpdated: persisted.matchesUpdated,
        pendingResults: persisted.pendingResults,
        remainingLimit: feed.remainingLimit,
        notes: result.warning,
      },
    });
    await prisma.auditLog.create({ data: { category: "RESULT_SYNC", status: "SUCCESS", message: `${persisted.resultsPersisted} resultados reais sincronizados e ${settlementFlow.settlement.tipsSettled} tips liquidadas.`, metadata: JSON.stringify(result) } });
    return result;
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : "Falha desconhecida");
    await phase28.resultSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), errors: message } }).catch(() => undefined);
    await createSettlementAudit({ provider: "unknown", resultSyncRunId: run.id, resultsSynced: 0, pendingResults: 0, settlement: {}, status: "FAILED", reason: message }).catch(() => undefined);
    await prisma.auditLog.create({ data: { category: "RESULT_SYNC", status: "FAILED", message } }).catch(() => undefined);
    throw error;
  }
}

export async function getResultCollectorReport(): Promise<ResultCollectorMetrics & { status: string }> {
  const [latestRun, latestAudit, statusRows] = await Promise.all([
    phase28.resultSyncRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null) as Promise<null | { provider: string; status: string; resultsReceived: number; resultsPersisted: number; matchesUpdated: number; pendingResults: number; finishedAt: Date | null; startedAt: Date }>,
    phase28.settlementAudit.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null) as Promise<null | { tipsProcessed: number; tipsSettled: number; won: number; lost: number; voids: number; settlementRate: number }>,
    phase28.matchResult.findMany({ select: { status: true } }).catch(() => []) as Promise<Array<{ status: string }>>,
  ]);
  const pendingFromResults = statusRows.filter((row) => row.status === "PENDING").length;
  return {
    status: latestRun?.status ?? "PENDING",
    provider: latestRun?.provider ?? "NO_RESULT_SYNC",
    resultsReceived: latestRun?.resultsReceived ?? 0,
    resultsPersisted: latestRun?.resultsPersisted ?? 0,
    matchesUpdated: latestRun?.matchesUpdated ?? 0,
    pendingResults: latestRun?.pendingResults ?? pendingFromResults,
    tipsProcessed: latestAudit?.tipsProcessed ?? 0,
    tipsSettled: latestAudit?.tipsSettled ?? 0,
    won: latestAudit?.won ?? 0,
    lost: latestAudit?.lost ?? 0,
    voids: latestAudit?.voids ?? 0,
    settlementRate: latestAudit?.settlementRate ?? 0,
    lastSync: latestRun?.finishedAt?.toISOString() ?? latestRun?.startedAt?.toISOString() ?? null,
  };
}
