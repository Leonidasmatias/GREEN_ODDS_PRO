import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProvidersStatus } from "@/providers/providerManager";

export const dynamic = "force-dynamic";

function pendingReason(input: {
  activeProvider: string;
  matchCount: number;
  oddsSnapshotCount: number;
  tipCount: number;
  valueAnalysisCount: number;
  greenScoreAnalysisCount: number;
  discoveryPatternCount: number;
  discoveryRecommendationCount: number;
  mlPredictionCount: number;
  bankrollProfileCount: number;
  bankrollAllocationCount: number;
  latestSyncStatus: string | null;
}) {
  const reasons: string[] = [];

  if (!input.activeProvider || input.activeProvider === "none") reasons.push("NO_ACTIVE_PROVIDER");
  if (input.matchCount === 0) reasons.push("MATCH_EMPTY");
  if (input.oddsSnapshotCount === 0) reasons.push("ODDS_SNAPSHOT_EMPTY");
  if (input.tipCount === 0) reasons.push("TIP_EMPTY");
  if (input.valueAnalysisCount === 0) reasons.push("VALUE_ANALYSIS_EMPTY");
  if (input.greenScoreAnalysisCount === 0) reasons.push("GREEN_SCORE_ANALYSIS_EMPTY");
  if (input.discoveryPatternCount === 0) reasons.push("DISCOVERY_PATTERN_EMPTY");
  if (input.discoveryRecommendationCount === 0) reasons.push("DISCOVERY_RECOMMENDATION_EMPTY");
  if (input.mlPredictionCount === 0) reasons.push("ML_PREDICTION_EMPTY");
  if (input.bankrollProfileCount === 0) reasons.push("BANKROLL_PROFILE_EMPTY");
  if (input.bankrollAllocationCount === 0) reasons.push("BANKROLL_ALLOCATION_EMPTY");
  if (!input.latestSyncStatus) reasons.push("NO_SYNC_RUN");
  if (input.latestSyncStatus && input.latestSyncStatus !== "SUCCESS") reasons.push(`LAST_SYNC_${input.latestSyncStatus}`);

  return reasons;
}

export async function GET() {
  try {
    const [
      matchCount,
      oddsSnapshotCount,
      tipCount,
      valueAnalysisCount,
      greenScoreAnalysisCount,
      discoveryPatternCount,
      discoveryRecommendationCount,
      mlPredictionCount,
      bankrollProfileCount,
      bankrollAllocationCount,
      latestSync,
      latestResultSync,
      latestProviderCache,
      providerStatus,
    ] = await Promise.all([
      prisma.match.count(),
      prisma.oddsSnapshot.count(),
      prisma.tip.count(),
      prisma.valueAnalysis.count(),
      prisma.greenScoreAnalysis.count(),
      prisma.discoveryPattern.count(),
      prisma.discoveryRecommendation.count(),
      prisma.mlPrediction.count(),
      prisma.bankrollProfile.count(),
      prisma.bankrollAllocation.count(),
      prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.resultSyncRun.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.providerCache.findFirst({ orderBy: { updatedAt: "desc" } }),
      getProvidersStatus(),
    ]);

    const latestSyncStatus = latestSync?.status ?? latestResultSync?.status ?? null;
    const reasons = pendingReason({
      activeProvider: providerStatus.activeProvider,
      matchCount,
      oddsSnapshotCount,
      tipCount,
      valueAnalysisCount,
      greenScoreAnalysisCount,
      discoveryPatternCount,
      discoveryRecommendationCount,
      mlPredictionCount,
      bankrollProfileCount,
      bankrollAllocationCount,
      latestSyncStatus,
    });

    const status = reasons.length ? "PENDING_RESULTS" : "READY";

    return NextResponse.json({
      status,
      reason: reasons[0] ?? "COMMAND_CENTER_READY",
      reasons,
      pendingResultsSource: {
        function: "CommandCenterDashboard fallback / operationalService.getOperationalStatus",
        condition:
          "PENDING_RESULTS appears in the UI when the client fetch has not returned or failed; executive KPIs stay insufficient while real provider, odds, tips, scores, ML, discovery, or bankroll tables are empty.",
        uiFallbackFiles: [
          "src/app/command-center/page.tsx",
          "src/components/CommandCenterDashboard.tsx",
        ],
      },
      counts: {
        Match: matchCount,
        OddsSnapshot: oddsSnapshotCount,
        Tip: tipCount,
        ValueAnalysis: valueAnalysisCount,
        GreenScoreAnalysis: greenScoreAnalysisCount,
        DiscoveryPattern: discoveryPatternCount,
        DiscoveryRecommendation: discoveryRecommendationCount,
        MlPrediction: mlPredictionCount,
        BankrollProfile: bankrollProfileCount,
        BankrollAllocation: bankrollAllocationCount,
      },
      lastSynchronization: {
        odds: latestSync
          ? {
              provider: latestSync.provider,
              status: latestSync.status,
              startedAt: latestSync.startedAt.toISOString(),
              completedAt: latestSync.completedAt?.toISOString() ?? null,
              eventsReceived: latestSync.eventsReceived,
              snapshotsCreated: latestSync.snapshotsCreated,
              tipsCreated: latestSync.tipsCreated,
              requestsRemaining: latestSync.requestsRemaining,
              warning: latestSync.warning ?? null,
            }
          : null,
        results: latestResultSync
          ? {
              provider: latestResultSync.provider,
              status: latestResultSync.status,
              startedAt: latestResultSync.startedAt.toISOString(),
              finishedAt: latestResultSync.finishedAt?.toISOString() ?? null,
              resultsReceived: latestResultSync.resultsReceived,
              resultsPersisted: latestResultSync.resultsPersisted,
              matchesUpdated: latestResultSync.matchesUpdated,
              pendingResults: latestResultSync.pendingResults,
              remainingLimit: latestResultSync.remainingLimit,
              errors: latestResultSync.errors ?? null,
            }
          : null,
      },
      provider: {
        activeProvider: providerStatus.activeProvider,
        configuredProviders: providerStatus.configuredProviders,
        priority: providerStatus.priority,
        warnings: providerStatus.providerWarnings,
        economyMode: providerStatus.economyMode,
      },
      cache: {
        active: Boolean(providerStatus.cacheStatus?.fresh || latestProviderCache),
        status: providerStatus.cacheStatus,
        latest:
          latestProviderCache
            ? {
                provider: latestProviderCache.provider,
                cacheKey: latestProviderCache.cacheKey,
                expiresAt: latestProviderCache.expiresAt.toISOString(),
                updatedAt: latestProviderCache.updatedAt.toISOString(),
                fresh: latestProviderCache.expiresAt > new Date(),
              }
            : null,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "AUDIT_FAILED",
        error: error instanceof Error ? error.message : "Command Center audit failed",
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
