CREATE TABLE "risk_rules" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ruleType" TEXT NOT NULL,
  "threshold" DOUBLE PRECISION NOT NULL,
  "severity" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "risk_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "risk_events" (
  "id" TEXT NOT NULL,
  "tipId" TEXT,
  "eventType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "risk_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exposure_snapshots" (
  "id" TEXT NOT NULL,
  "bankrollProfileId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "totalExposure" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dailyRiskUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "openTips" INTEGER NOT NULL DEFAULT 0,
  "marketExposure" TEXT NOT NULL,
  "competitionExposure" TEXT NOT NULL,
  "bookmakerExposure" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exposure_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "correlation_blocks" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "competition" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "correlation_blocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "risk_rules_ruleType_enabled_idx" ON "risk_rules"("ruleType", "enabled");
CREATE INDEX "risk_events_tipId_idx" ON "risk_events"("tipId");
CREATE INDEX "risk_events_eventType_createdAt_idx" ON "risk_events"("eventType", "createdAt");
CREATE INDEX "risk_events_action_severity_idx" ON "risk_events"("action", "severity");
CREATE INDEX "exposure_snapshots_bankrollProfileId_date_idx" ON "exposure_snapshots"("bankrollProfileId", "date");
CREATE INDEX "exposure_snapshots_createdAt_idx" ON "exposure_snapshots"("createdAt");
CREATE INDEX "correlation_blocks_matchId_status_idx" ON "correlation_blocks"("matchId", "status");
CREATE INDEX "correlation_blocks_competition_status_idx" ON "correlation_blocks"("competition", "status");
