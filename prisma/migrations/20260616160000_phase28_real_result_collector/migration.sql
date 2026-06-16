CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'PROVIDER',
    "rawPayload" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "result_sync_runs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "resultsReceived" INTEGER NOT NULL DEFAULT 0,
    "resultsPersisted" INTEGER NOT NULL DEFAULT 0,
    "matchesUpdated" INTEGER NOT NULL DEFAULT 0,
    "pendingResults" INTEGER NOT NULL DEFAULT 0,
    "remainingLimit" INTEGER,
    "errors" TEXT,
    "notes" TEXT,

    CONSTRAINT "result_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settlement_audits" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "resultSyncRunId" TEXT,
    "settlementRunId" TEXT,
    "resultsSynced" INTEGER NOT NULL DEFAULT 0,
    "tipsProcessed" INTEGER NOT NULL DEFAULT 0,
    "tipsSettled" INTEGER NOT NULL DEFAULT 0,
    "won" INTEGER NOT NULL DEFAULT 0,
    "lost" INTEGER NOT NULL DEFAULT 0,
    "voids" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "settlementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "match_results_provider_providerId_key" ON "match_results"("provider", "providerId");
CREATE INDEX "match_results_matchId_status_idx" ON "match_results"("matchId", "status");
CREATE INDEX "match_results_provider_collectedAt_idx" ON "match_results"("provider", "collectedAt");
CREATE INDEX "result_sync_runs_provider_startedAt_idx" ON "result_sync_runs"("provider", "startedAt");
CREATE INDEX "result_sync_runs_status_startedAt_idx" ON "result_sync_runs"("status", "startedAt");
CREATE INDEX "settlement_audits_provider_createdAt_idx" ON "settlement_audits"("provider", "createdAt");
CREATE INDEX "settlement_audits_status_createdAt_idx" ON "settlement_audits"("status", "createdAt");
CREATE INDEX "settlement_audits_resultSyncRunId_idx" ON "settlement_audits"("resultSyncRunId");

ALTER TABLE "match_results" ADD CONSTRAINT "match_results_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
