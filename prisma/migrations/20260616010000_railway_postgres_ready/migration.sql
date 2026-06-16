CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "competition" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRE_GAME',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "odds_snapshots" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "odd" DOUBLE PRECISION NOT NULL,
    "provider" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "odds_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tips" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "gameLabel" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "odd" DOUBLE PRECISION NOT NULL,
    "impliedProbability" DOUBLE PRECISION NOT NULL,
    "estimatedProbability" DOUBLE PRECISION NOT NULL,
    "edge" DOUBLE PRECISION NOT NULL,
    "expectedValue" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "classification" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stake" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "profitLoss" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    CONSTRAINT "tips_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "eventsReceived" INTEGER NOT NULL DEFAULT 0,
    "snapshotsCreated" INTEGER NOT NULL DEFAULT 0,
    "tipsCreated" INTEGER NOT NULL DEFAULT 0,
    "requestsRemaining" INTEGER,
    "warning" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalEntries" INTEGER NOT NULL,
    "greens" INTEGER NOT NULL,
    "reds" INTEGER NOT NULL,
    "pending" INTEGER NOT NULL,
    "totalStake" DOUBLE PRECISION NOT NULL,
    "accumulatedProfit" DOUBLE PRECISION NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL,
    "hitRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "performance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "model_weights" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "form" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "attack" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "defense" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "momentum" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "ranking" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "statistics" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "model_weights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_dataset" (
    "id" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "odd" DOUBLE PRECISION NOT NULL,
    "impliedProbability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedProbability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL,
    "ev" DOUBLE PRECISION NOT NULL,
    "edge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "risk" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "profit" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oddsMovement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "powerRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recentForm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_dataset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "model_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordsUsed" INTEGER NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL,
    "yield" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "precision" DOUBLE PRECISION NOT NULL,
    "recall" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    CONSTRAINT "model_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "message" TEXT,
    "metadata" TEXT,
    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_quality_alerts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "data_quality_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_calls" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "callsMade" INTEGER NOT NULL DEFAULT 1,
    "remainingLimit" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "provider_calls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scheduler_leases" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scheduler_leases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "matches_providerId_key" ON "matches"("providerId");
CREATE INDEX "matches_startsAt_status_idx" ON "matches"("startsAt", "status");
CREATE INDEX "odds_snapshots_matchId_market_capturedAt_idx" ON "odds_snapshots"("matchId", "market", "capturedAt");
CREATE INDEX "odds_snapshots_provider_capturedAt_idx" ON "odds_snapshots"("provider", "capturedAt");
CREATE INDEX "tips_status_createdAt_idx" ON "tips"("status", "createdAt");
CREATE INDEX "tips_expectedValue_confidenceScore_idx" ON "tips"("expectedValue", "confidenceScore");
CREATE INDEX "sync_runs_startedAt_idx" ON "sync_runs"("startedAt");
CREATE UNIQUE INDEX "performance_periodStart_periodEnd_key" ON "performance"("periodStart", "periodEnd");
CREATE UNIQUE INDEX "training_dataset_tipId_key" ON "training_dataset"("tipId");
CREATE INDEX "training_dataset_market_result_idx" ON "training_dataset"("market", "result");
CREATE INDEX "training_dataset_createdAt_idx" ON "training_dataset"("createdAt");
CREATE INDEX "training_dataset_settledAt_idx" ON "training_dataset"("settledAt");
CREATE INDEX "audit_logs_category_createdAt_idx" ON "audit_logs"("category", "createdAt");
CREATE INDEX "audit_logs_status_createdAt_idx" ON "audit_logs"("status", "createdAt");
CREATE UNIQUE INDEX "model_versions_version_key" ON "model_versions"("version");
CREATE INDEX "model_versions_trainedAt_idx" ON "model_versions"("trainedAt");
CREATE INDEX "job_runs_name_scheduledAt_idx" ON "job_runs"("name", "scheduledAt");
CREATE INDEX "job_runs_status_scheduledAt_idx" ON "job_runs"("status", "scheduledAt");
CREATE INDEX "data_quality_alerts_status_severity_idx" ON "data_quality_alerts"("status", "severity");
CREATE INDEX "data_quality_alerts_type_createdAt_idx" ON "data_quality_alerts"("type", "createdAt");
CREATE INDEX "provider_calls_provider_createdAt_idx" ON "provider_calls"("provider", "createdAt");
CREATE INDEX "provider_calls_status_createdAt_idx" ON "provider_calls"("status", "createdAt");
CREATE INDEX "scheduler_leases_expiresAt_idx" ON "scheduler_leases"("expiresAt");

ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tips" ADD CONSTRAINT "tips_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
