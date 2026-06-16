CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "message" TEXT,
    "metadata" TEXT
);
CREATE INDEX "job_runs_name_scheduledAt_idx" ON "job_runs"("name", "scheduledAt");
CREATE INDEX "job_runs_status_scheduledAt_idx" ON "job_runs"("status", "scheduledAt");

CREATE TABLE "data_quality_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME
);
CREATE INDEX "data_quality_alerts_status_severity_idx" ON "data_quality_alerts"("status", "severity");
CREATE INDEX "data_quality_alerts_type_createdAt_idx" ON "data_quality_alerts"("type", "createdAt");
