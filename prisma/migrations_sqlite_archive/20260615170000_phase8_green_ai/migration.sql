ALTER TABLE "training_dataset" ADD COLUMN "impliedProbability" REAL NOT NULL DEFAULT 0;
ALTER TABLE "training_dataset" ADD COLUMN "estimatedProbability" REAL NOT NULL DEFAULT 0;
ALTER TABLE "training_dataset" ADD COLUMN "edge" REAL NOT NULL DEFAULT 0;
ALTER TABLE "training_dataset" ADD COLUMN "oddsMovement" REAL NOT NULL DEFAULT 0;
ALTER TABLE "training_dataset" ADD COLUMN "powerRating" REAL NOT NULL DEFAULT 0;
ALTER TABLE "training_dataset" ADD COLUMN "recentForm" REAL NOT NULL DEFAULT 0;
