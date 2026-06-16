CREATE TABLE "training_dataset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "odd" REAL NOT NULL,
    "score" REAL NOT NULL,
    "ev" REAL NOT NULL,
    "risk" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "profit" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "training_dataset_tipId_key" ON "training_dataset"("tipId");
CREATE INDEX "training_dataset_market_result_idx" ON "training_dataset"("market", "result");
CREATE INDEX "training_dataset_createdAt_idx" ON "training_dataset"("createdAt");

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "audit_logs_category_createdAt_idx" ON "audit_logs"("category", "createdAt");
CREATE INDEX "audit_logs_status_createdAt_idx" ON "audit_logs"("status", "createdAt");
