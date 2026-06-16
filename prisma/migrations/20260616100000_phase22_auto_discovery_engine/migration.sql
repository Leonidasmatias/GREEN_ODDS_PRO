CREATE TABLE "discovery_runs" (
  "id" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "totalTipsAnalyzed" INTEGER NOT NULL DEFAULT 0,
  "patternsFound" INTEGER NOT NULL DEFAULT 0,
  "recommendationsGenerated" INTEGER NOT NULL DEFAULT 0,
  "modelVersion" TEXT NOT NULL,
  "notes" TEXT,

  CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "discovery_patterns" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "patternType" TEXT NOT NULL,
  "market" TEXT,
  "competition" TEXT,
  "bookmaker" TEXT,
  "provider" TEXT,
  "oddRange" TEXT,
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
  "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roi" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "drawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mlScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'INSUFFICIENT_REAL_DATA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "discovery_patterns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "discovery_recommendations" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "patternId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "recommendationType" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "discovery_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "discovery_runs_status_startedAt_idx" ON "discovery_runs"("status", "startedAt");
CREATE INDEX "discovery_runs_modelVersion_idx" ON "discovery_runs"("modelVersion");
CREATE INDEX "discovery_patterns_runId_idx" ON "discovery_patterns"("runId");
CREATE INDEX "discovery_patterns_patternType_status_idx" ON "discovery_patterns"("patternType", "status");
CREATE INDEX "discovery_patterns_market_provider_bookmaker_oddRange_idx" ON "discovery_patterns"("market", "provider", "bookmaker", "oddRange");
CREATE INDEX "discovery_recommendations_runId_idx" ON "discovery_recommendations"("runId");
CREATE INDEX "discovery_recommendations_patternId_idx" ON "discovery_recommendations"("patternId");
CREATE INDEX "discovery_recommendations_recommendationType_status_idx" ON "discovery_recommendations"("recommendationType", "status");

ALTER TABLE "discovery_patterns" ADD CONSTRAINT "discovery_patterns_runId_fkey" FOREIGN KEY ("runId") REFERENCES "discovery_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "discovery_recommendations" ADD CONSTRAINT "discovery_recommendations_runId_fkey" FOREIGN KEY ("runId") REFERENCES "discovery_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "discovery_recommendations" ADD CONSTRAINT "discovery_recommendations_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "discovery_patterns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
