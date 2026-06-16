CREATE TABLE "ml_training_runs" (
  "id" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "totalSamples" INTEGER NOT NULL DEFAULT 0,
  "wonSamples" INTEGER NOT NULL DEFAULT 0,
  "lostSamples" INTEGER NOT NULL DEFAULT 0,
  "voidSamples" INTEGER NOT NULL DEFAULT 0,
  "marketsCovered" INTEGER NOT NULL DEFAULT 0,
  "competitionsCovered" INTEGER NOT NULL DEFAULT 0,
  "bookmakersCovered" INTEGER NOT NULL DEFAULT 0,
  "modelVersion" TEXT NOT NULL,
  "notes" TEXT,

  CONSTRAINT "ml_training_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ml_model_metrics" (
  "id" TEXT NOT NULL,
  "trainingRunId" TEXT NOT NULL,
  "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "precision" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "recall" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roiBacktest" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "winRateBacktest" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ml_model_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ml_predictions" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "selection" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "bookmaker" TEXT NOT NULL,
  "odd" DOUBLE PRECISION NOT NULL,
  "impliedProbability" DOUBLE PRECISION NOT NULL,
  "modelProbability" DOUBLE PRECISION NOT NULL,
  "edge" DOUBLE PRECISION NOT NULL,
  "confidenceScore" DOUBLE PRECISION NOT NULL,
  "classification" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ml_predictions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ml_training_runs_status_startedAt_idx" ON "ml_training_runs"("status", "startedAt");
CREATE INDEX "ml_training_runs_modelVersion_idx" ON "ml_training_runs"("modelVersion");
CREATE INDEX "ml_model_metrics_trainingRunId_idx" ON "ml_model_metrics"("trainingRunId");
CREATE INDEX "ml_model_metrics_createdAt_idx" ON "ml_model_metrics"("createdAt");
CREATE INDEX "ml_predictions_matchId_market_selection_idx" ON "ml_predictions"("matchId", "market", "selection");
CREATE INDEX "ml_predictions_provider_createdAt_idx" ON "ml_predictions"("provider", "createdAt");
CREATE INDEX "ml_predictions_status_classification_idx" ON "ml_predictions"("status", "classification");

ALTER TABLE "ml_model_metrics" ADD CONSTRAINT "ml_model_metrics_trainingRunId_fkey" FOREIGN KEY ("trainingRunId") REFERENCES "ml_training_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
