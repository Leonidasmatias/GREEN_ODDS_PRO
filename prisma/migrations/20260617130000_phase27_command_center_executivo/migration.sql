CREATE TABLE "executive_command_audits" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sourceIntegrity" TEXT NOT NULL,
  "totalKpis" INTEGER NOT NULL DEFAULT 0,
  "insufficientKpis" INTEGER NOT NULL DEFAULT 0,
  "oddsOfDay" INTEGER NOT NULL DEFAULT 0,
  "topOpportunities" INTEGER NOT NULL DEFAULT 0,
  "bankrollStatus" TEXT NOT NULL,
  "riskShieldStatus" TEXT NOT NULL,
  "performanceStatus" TEXT NOT NULL,
  "systemHealthStatus" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "executive_command_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "executive_command_audits_status_createdAt_idx" ON "executive_command_audits"("status", "createdAt");
CREATE INDEX "executive_command_audits_provider_createdAt_idx" ON "executive_command_audits"("provider", "createdAt");
