import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProvidersStatus } from "@/providers/providerManager";
import { isSchedulerEnabled } from "@/services/schedulerService";
import { redactSecrets } from "@/services/securityService";

export const dynamic = "force-dynamic";

const resultStatuses = ["FINISHED", "CANCELLED"];
const openStatuses = ["OPEN", "PRE_GAME", "SCHEDULED", "NOT_STARTED"];

function intervalMinutes() {
  const value = Number(process.env.RESULTS_SYNC_INTERVAL_MINUTES);
  return Number.isFinite(value) && value >= 1 ? value : 15;
}

function sourceConfiguration() {
  return {
    theOddsApi: Boolean(process.env.ODDS_API_KEY?.trim()),
    apiFootball: Boolean(process.env.FOOTBALL_API_KEY?.trim()),
    sportMonks: Boolean(process.env.SPORTMONKS_API_KEY?.trim()),
    priority: (process.env.ODDS_PROVIDER_PRIORITY || "the-odds-api,sportmonks,api-football")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  };
}

function safeOptional(value: string | null | undefined) {
  return value ? redactSecrets(value) : null;
}

function diagnose(input: {
  latestStatus: string | null;
  lastError: string | null;
  matchesFinished: number;
  matchResultsFinished: number;
  tipsPending: number;
  tipsSettled: number;
  resultSourcesConfigured: boolean;
}) {
  if (!input.resultSourcesConfigured) return "NO_RESULT_SOURCE_CONFIGURED";
  if (input.latestStatus === "FAILED") {
    if (input.lastError?.includes("Nenhum provedor disponivel para getResults")) return "RESULT_PROVIDER_FAILOVER_FAILED";
    if (input.lastError?.includes("OUT_OF_USAGE_CREDITS") || input.lastError?.includes("Creditos")) return "RESULT_PROVIDER_CREDITS_EXHAUSTED";
    return "LAST_RESULT_SYNC_FAILED";
  }
  if (input.matchesFinished === 0 && input.matchResultsFinished === 0) return "NO_FINISHED_MATCHES_FOUND";
  if (input.tipsPending > 0 && input.tipsSettled === 0) return "FINISHED_MATCHES_NOT_MATCHING_PENDING_TIPS";
  return input.latestStatus ?? "NO_RESULT_SYNC_RUN";
}

export async function GET() {
  console.log("[results-sync-audit] request received");
  try {
    const [
      latestRun,
      latestJob,
      latestSchedulerLog,
      latestResultLog,
      providers,
      matchesOpen,
      matchesLive,
      matchesFinished,
      matchResultsFinished,
      tipsPending,
      tipsWon,
      tipsLost,
      tipsVoid,
      latestFinishedMatch,
      latestSettledTip,
    ] = await Promise.all([
      prisma.resultSyncRun.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.jobRun.findFirst({ where: { name: { in: ["RESULT_SYNC", "RESULTS_SYNC"] } }, orderBy: { scheduledAt: "desc" } }),
      prisma.auditLog.findFirst({ where: { category: "SCHEDULER", message: { contains: "RESULT_SYNC" } }, orderBy: { createdAt: "desc" } }),
      prisma.auditLog.findFirst({ where: { category: "RESULT_SYNC" }, orderBy: { createdAt: "desc" } }),
      getProvidersStatus(),
      prisma.match.count({ where: { status: { in: openStatuses } } }),
      prisma.match.count({ where: { status: "LIVE" } }),
      prisma.match.count({ where: { status: { in: resultStatuses } } }),
      prisma.matchResult.count({ where: { status: { in: resultStatuses } } }),
      prisma.tip.count({ where: { status: "PENDING" } }),
      prisma.tip.count({ where: { status: "WON" } }),
      prisma.tip.count({ where: { status: "LOST" } }),
      prisma.tip.count({ where: { status: "VOID" } }),
      prisma.match.findFirst({ where: { status: { in: resultStatuses } }, orderBy: { updatedAt: "desc" } }),
      prisma.tip.findFirst({ where: { status: { in: ["WON", "LOST", "VOID"] } }, orderBy: { settledAt: "desc" } }),
    ]);

    const config = sourceConfiguration();
    const lastError = safeOptional(latestRun?.errors ?? latestResultLog?.message ?? latestJob?.message);
    const tipsSettled = tipsWon + tipsLost + tipsVoid;
    const resultSourcesConfigured = config.theOddsApi || config.apiFootball || config.sportMonks;
    const status = diagnose({
      latestStatus: latestRun?.status ?? null,
      lastError,
      matchesFinished,
      matchResultsFinished,
      tipsPending,
      tipsSettled,
      resultSourcesConfigured,
    });

    console.log(`[results-sync-audit] returning 200 status=${status} latest=${latestRun?.status ?? "NO_RUN"}`);

    return NextResponse.json({
      schedulerEnabled: isSchedulerEnabled(),
      resultsSyncIntervalMinutes: intervalMinutes(),
      lastExecution: latestRun
        ? {
            id: latestRun.id,
            provider: latestRun.provider,
            status: latestRun.status,
            startedAt: latestRun.startedAt.toISOString(),
            finishedAt: latestRun.finishedAt?.toISOString() ?? null,
            resultsReceived: latestRun.resultsReceived,
            resultsPersisted: latestRun.resultsPersisted,
            matchesUpdated: latestRun.matchesUpdated,
            pendingResults: latestRun.pendingResults,
            remainingLimit: latestRun.remainingLimit,
            notes: latestRun.notes ?? null,
          }
        : null,
      provider: latestRun?.provider ?? providers.activeProvider,
      resultProvider: providers.resultProvider,
      resultSources: {
        apiFootballConfigured: config.apiFootball,
        sportMonksConfigured: config.sportMonks,
        theOddsApiConfigured: config.theOddsApi,
        priority: config.priority,
        activeProvider: providers.activeProvider,
        oddsProviders: providers.oddsProviders,
        resultProviders: providers.resultProviders,
        configuredProviders: providers.configuredProviders,
      },
      matchesOpen,
      matchesLive,
      matchesFinished,
      tipsPending,
      tipsWon,
      tipsLost,
      tipsVoid,
      lastError,
      status,
      diagnostics: {
        latestJob: latestJob
          ? {
              id: latestJob.id,
              name: latestJob.name,
              status: latestJob.status,
              scheduledAt: latestJob.scheduledAt.toISOString(),
              startedAt: latestJob.startedAt?.toISOString() ?? null,
              completedAt: latestJob.completedAt?.toISOString() ?? null,
              message: safeOptional(latestJob.message),
            }
          : null,
        latestSchedulerLog: latestSchedulerLog
          ? {
              status: latestSchedulerLog.status,
              message: safeOptional(latestSchedulerLog.message),
              createdAt: latestSchedulerLog.createdAt.toISOString(),
            }
          : null,
        latestResultLog: latestResultLog
          ? {
              status: latestResultLog.status,
              message: safeOptional(latestResultLog.message),
              createdAt: latestResultLog.createdAt.toISOString(),
            }
          : null,
        matchResultsFinished,
        finishedMatchesFound: matchesFinished > 0 || matchResultsFinished > 0,
        finishedMatchesLiquidated: tipsSettled > 0,
        latestFinishedMatch: latestFinishedMatch
          ? {
              id: latestFinishedMatch.id,
              providerId: latestFinishedMatch.providerId,
              status: latestFinishedMatch.status,
              homeTeam: latestFinishedMatch.homeTeam,
              awayTeam: latestFinishedMatch.awayTeam,
              updatedAt: latestFinishedMatch.updatedAt.toISOString(),
            }
          : null,
        latestSettledTip: latestSettledTip
          ? {
              id: latestSettledTip.id,
              status: latestSettledTip.status,
              provider: latestSettledTip.provider,
              settledAt: latestSettledTip.settledAt?.toISOString() ?? null,
            }
          : null,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : "Results sync audit failed");
    console.log(`[results-sync-audit] failed error=${message}`);
    return NextResponse.json({ status: "AUDIT_FAILED", lastError: message, checkedAt: new Date().toISOString() }, { status: 503 });
  }
}
