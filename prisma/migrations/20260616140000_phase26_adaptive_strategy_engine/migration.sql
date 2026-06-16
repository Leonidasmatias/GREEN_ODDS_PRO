CREATE TABLE "adaptive_strategy_runs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "totalTipsAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "segmentsAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "adjustmentsGenerated" INTEGER NOT NULL DEFAULT 0,
    "adjustmentsApplied" INTEGER NOT NULL DEFAULT 0,
    "blockedSegments" INTEGER NOT NULL DEFAULT 0,
    "modelVersion" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "adaptive_strategy_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "adaptive_strategy_rules" (
    "id" TEXT NOT NULL,
    "segmentType" TEXT NOT NULL,
    "segmentKey" TEXT NOT NULL,
    "market" TEXT,
    "competition" TEXT,
    "bookmaker" TEXT,
    "provider" TEXT,
    "oddRange" TEXT,
    "action" TEXT NOT NULL,
    "weightMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "confidenceThresholdDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stakeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "riskSensitivity" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "roi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "drawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adaptive_strategy_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "adaptive_strategy_adjustments" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ruleId" TEXT,
    "segmentType" TEXT NOT NULL,
    "segmentKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "weightMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "confidenceThresholdDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stakeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "riskSensitivity" TEXT NOT NULL DEFAULT 'NORMAL',
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "roi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "drawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adaptive_strategy_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "adaptive_strategy_events" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adaptive_strategy_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "adaptive_strategy_runs_status_startedAt_idx" ON "adaptive_strategy_runs"("status", "startedAt");
CREATE INDEX "adaptive_strategy_runs_modelVersion_idx" ON "adaptive_strategy_runs"("modelVersion");
CREATE UNIQUE INDEX "adaptive_strategy_rules_segmentType_segmentKey_key" ON "adaptive_strategy_rules"("segmentType", "segmentKey");
CREATE INDEX "adaptive_strategy_rules_status_action_idx" ON "adaptive_strategy_rules"("status", "action");
CREATE INDEX "adaptive_strategy_rules_market_provider_bookmaker_oddRange_idx" ON "adaptive_strategy_rules"("market", "provider", "bookmaker", "oddRange");
CREATE INDEX "adaptive_strategy_adjustments_runId_idx" ON "adaptive_strategy_adjustments"("runId");
CREATE INDEX "adaptive_strategy_adjustments_segmentType_action_idx" ON "adaptive_strategy_adjustments"("segmentType", "action");
CREATE INDEX "adaptive_strategy_adjustments_status_createdAt_idx" ON "adaptive_strategy_adjustments"("status", "createdAt");
CREATE INDEX "adaptive_strategy_events_runId_idx" ON "adaptive_strategy_events"("runId");
CREATE INDEX "adaptive_strategy_events_eventType_severity_idx" ON "adaptive_strategy_events"("eventType", "severity");
CREATE INDEX "adaptive_strategy_events_createdAt_idx" ON "adaptive_strategy_events"("createdAt");

ALTER TABLE "adaptive_strategy_adjustments" ADD CONSTRAINT "adaptive_strategy_adjustments_runId_fkey" FOREIGN KEY ("runId") REFERENCES "adaptive_strategy_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "adaptive_strategy_events" ADD CONSTRAINT "adaptive_strategy_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "adaptive_strategy_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
