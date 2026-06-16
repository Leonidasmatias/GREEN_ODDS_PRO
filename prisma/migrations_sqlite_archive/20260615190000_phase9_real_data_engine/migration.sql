CREATE TABLE "model_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "trainedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordsUsed" INTEGER NOT NULL,
    "winRate" REAL NOT NULL,
    "roi" REAL NOT NULL,
    "yield" REAL NOT NULL,
    "accuracy" REAL NOT NULL,
    "precision" REAL NOT NULL,
    "recall" REAL NOT NULL,
    "notes" TEXT
);

CREATE UNIQUE INDEX "model_versions_version_key" ON "model_versions"("version");
CREATE INDEX "model_versions_trainedAt_idx" ON "model_versions"("trainedAt");

UPDATE "tips" SET "status" = 'WON' WHERE "status" = 'GREEN';
UPDATE "tips" SET "status" = 'LOST' WHERE "status" = 'RED';
UPDATE "training_dataset" SET "result" = 'WON' WHERE "result" = 'GREEN';
UPDATE "training_dataset" SET "result" = 'LOST' WHERE "result" = 'RED';

ALTER TABLE "training_dataset" ADD COLUMN "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "training_dataset" ADD COLUMN "settledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "training_dataset_settledAt_idx" ON "training_dataset"("settledAt");
