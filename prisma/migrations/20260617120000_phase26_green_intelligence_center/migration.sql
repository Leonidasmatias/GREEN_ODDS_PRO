CREATE TABLE "green_score_analyses" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "oddsSnapshotId" TEXT,
  "provider" TEXT NOT NULL,
  "bookmaker" TEXT NOT NULL,
  "competition" TEXT NOT NULL,
  "gameLabel" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "selection" TEXT NOT NULL,
  "odd" DOUBLE PRECISION NOT NULL,
  "greenScore" INTEGER NOT NULL,
  "confidence" INTEGER NOT NULL,
  "risk" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "qualifiesOddsOfDay" BOOLEAN NOT NULL DEFAULT false,
  "valueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "valueStatus" TEXT NOT NULL,
  "mlStatus" TEXT NOT NULL,
  "mlConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discoveryStatus" TEXT,
  "riskShieldStatus" TEXT NOT NULL,
  "rejectionReasons" TEXT,
  "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "green_score_analyses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "green_score_analyses_greenScore_confidence_risk_idx" ON "green_score_analyses"("greenScore", "confidence", "risk");
CREATE INDEX "green_score_analyses_classification_analyzedAt_idx" ON "green_score_analyses"("classification", "analyzedAt");
CREATE INDEX "green_score_analyses_qualifiesOddsOfDay_analyzedAt_idx" ON "green_score_analyses"("qualifiesOddsOfDay", "analyzedAt");
