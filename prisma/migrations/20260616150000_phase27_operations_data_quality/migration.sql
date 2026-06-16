CREATE TABLE "data_quality_runs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "score" INTEGER NOT NULL DEFAULT 100,
    "classification" TEXT NOT NULL DEFAULT 'EXCELLENT',
    "checksRun" INTEGER NOT NULL DEFAULT 0,
    "alertsFound" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "data_quality_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_quality_events" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_quality_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "data_quality_alerts" ADD COLUMN "runId" TEXT;
ALTER TABLE "data_quality_alerts" ADD COLUMN "entity" TEXT;
ALTER TABLE "data_quality_alerts" ADD COLUMN "scoreImpact" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "data_quality_runs_status_startedAt_idx" ON "data_quality_runs"("status", "startedAt");
CREATE INDEX "data_quality_runs_classification_score_idx" ON "data_quality_runs"("classification", "score");
CREATE INDEX "data_quality_events_runId_idx" ON "data_quality_events"("runId");
CREATE INDEX "data_quality_events_eventType_severity_idx" ON "data_quality_events"("eventType", "severity");
CREATE INDEX "data_quality_events_createdAt_idx" ON "data_quality_events"("createdAt");
CREATE INDEX "data_quality_alerts_runId_idx" ON "data_quality_alerts"("runId");

ALTER TABLE "data_quality_events" ADD CONSTRAINT "data_quality_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "data_quality_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_quality_alerts" ADD CONSTRAINT "data_quality_alerts_runId_fkey" FOREIGN KEY ("runId") REFERENCES "data_quality_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
