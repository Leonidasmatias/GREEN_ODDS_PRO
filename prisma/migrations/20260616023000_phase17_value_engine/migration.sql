CREATE TABLE "value_analyses" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "oddsSnapshotId" TEXT,
  "provider" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "selection" TEXT NOT NULL,
  "odd" DOUBLE PRECISION NOT NULL,
  "impliedProbability" DOUBLE PRECISION NOT NULL,
  "bookmakerMargin" DOUBLE PRECISION NOT NULL,
  "fairOdd" DOUBLE PRECISION NOT NULL,
  "estimatedProbability" DOUBLE PRECISION,
  "edge" DOUBLE PRECISION,
  "expectedValue" DOUBLE PRECISION,
  "risk" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "rejectionReasons" TEXT,
  "historicalSample" INTEGER NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "value_analyses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "value_analyses_provider_analyzedAt_idx" ON "value_analyses"("provider", "analyzedAt");
CREATE INDEX "value_analyses_status_classification_idx" ON "value_analyses"("status", "classification");
