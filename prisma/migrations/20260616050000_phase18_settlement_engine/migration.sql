ALTER TABLE "tips" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "tips" ADD COLUMN "bookmaker" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "tips" ADD COLUMN "score" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "tips" ADD COLUMN "stakeSuggested" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "tips" ADD COLUMN "profit" DOUBLE PRECISION;
ALTER TABLE "tips" ADD COLUMN "roi" DOUBLE PRECISION;
ALTER TABLE "tips" ADD COLUMN "rejectionReason" TEXT;

UPDATE "tips" SET "score" = "confidenceScore" WHERE "score" = 0;
UPDATE "tips" SET "stakeSuggested" = "stake" WHERE "stakeSuggested" = 1;
UPDATE "tips" SET "profit" = "profitLoss" WHERE "profit" IS NULL AND "profitLoss" IS NOT NULL;
UPDATE "tips" SET "roi" = CASE WHEN "stake" > 0 AND "profitLoss" IS NOT NULL THEN ("profitLoss" / "stake") * 100 ELSE "roi" END;

CREATE INDEX "tips_provider_bookmaker_idx" ON "tips"("provider", "bookmaker");

CREATE TABLE "tip_results" (
  "id" TEXT NOT NULL,
  "tipId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "selection" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "homeScore" INTEGER,
  "awayScore" INTEGER,
  "profit" DOUBLE PRECISION NOT NULL,
  "roi" DOUBLE PRECISION NOT NULL,
  "provider" TEXT NOT NULL,
  "bookmaker" TEXT NOT NULL,
  "rejectionReason" TEXT,
  "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tip_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tip_results_tipId_key" ON "tip_results"("tipId");
CREATE INDEX "tip_results_status_settledAt_idx" ON "tip_results"("status", "settledAt");
CREATE INDEX "tip_results_market_selection_idx" ON "tip_results"("market", "selection");

ALTER TABLE "tip_results" ADD CONSTRAINT "tip_results_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "tips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "settlement_runs" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "tipsProcessed" INTEGER NOT NULL DEFAULT 0,
  "tipsSettled" INTEGER NOT NULL DEFAULT 0,
  "errors" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "settlement_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "settlement_runs_provider_startedAt_idx" ON "settlement_runs"("provider", "startedAt");
CREATE INDEX "settlement_runs_status_startedAt_idx" ON "settlement_runs"("status", "startedAt");

CREATE TABLE "market_performance" (
  "id" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "selection" TEXT NOT NULL,
  "sport" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "bookmaker" TEXT NOT NULL,
  "oddRange" TEXT NOT NULL,
  "totalEntries" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "voids" INTEGER NOT NULL DEFAULT 0,
  "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "averageOdd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roi" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maxDrawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "market_performance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_performance_market_selection_sport_provider_bookmaker_oddRange_key" ON "market_performance"("market", "selection", "sport", "provider", "bookmaker", "oddRange");
CREATE INDEX "market_performance_market_provider_idx" ON "market_performance"("market", "provider");
CREATE INDEX "market_performance_roi_winRate_idx" ON "market_performance"("roi", "winRate");
