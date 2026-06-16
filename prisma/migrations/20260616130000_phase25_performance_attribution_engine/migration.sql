CREATE TABLE "performance_attribution_runs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "totalTipsAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "segmentsAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "insightsGenerated" INTEGER NOT NULL DEFAULT 0,
    "modelVersion" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "performance_attribution_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_attribution_segments" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "segmentType" TEXT NOT NULL,
    "segmentKey" TEXT NOT NULL,
    "market" TEXT,
    "competition" TEXT,
    "bookmaker" TEXT,
    "provider" TEXT,
    "oddRange" TEXT,
    "classification" TEXT,
    "risk" TEXT,
    "confidenceRange" TEXT,
    "mlStatus" TEXT,
    "discoveryStatus" TEXT,
    "riskShieldAction" TEXT,
    "bankrollStrategy" TEXT,
    "totalTips" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "voids" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageOdd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageStake" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "drawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hitRateByOddRange" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "edgeRealizado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evRealizado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sharpeLikeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxLosingStreak" INTEGER NOT NULL DEFAULT 0,
    "maxWinningStreak" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'INSUFFICIENT_REAL_DATA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_attribution_segments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_attribution_insights" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "segmentType" TEXT,
    "segmentKey" TEXT,
    "metricValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_attribution_insights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "performance_attribution_runs_status_startedAt_idx" ON "performance_attribution_runs"("status", "startedAt");
CREATE INDEX "performance_attribution_runs_modelVersion_idx" ON "performance_attribution_runs"("modelVersion");
CREATE INDEX "performance_attribution_segments_runId_idx" ON "performance_attribution_segments"("runId");
CREATE INDEX "performance_attribution_segments_segmentType_status_idx" ON "performance_attribution_segments"("segmentType", "status");
CREATE INDEX "performance_attribution_segments_market_provider_bookmaker_oddRange_idx" ON "performance_attribution_segments"("market", "provider", "bookmaker", "oddRange");
CREATE INDEX "performance_attribution_insights_runId_idx" ON "performance_attribution_insights"("runId");
CREATE INDEX "performance_attribution_insights_insightType_status_idx" ON "performance_attribution_insights"("insightType", "status");

ALTER TABLE "performance_attribution_segments" ADD CONSTRAINT "performance_attribution_segments_runId_fkey" FOREIGN KEY ("runId") REFERENCES "performance_attribution_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_attribution_insights" ADD CONSTRAINT "performance_attribution_insights_runId_fkey" FOREIGN KEY ("runId") REFERENCES "performance_attribution_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
