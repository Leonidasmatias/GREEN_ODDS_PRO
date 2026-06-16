CREATE TABLE "provider_calls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "callsMade" INTEGER NOT NULL DEFAULT 1,
    "remainingLimit" INTEGER,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "provider_calls_provider_createdAt_idx" ON "provider_calls"("provider", "createdAt");
CREATE INDEX "provider_calls_status_createdAt_idx" ON "provider_calls"("status", "createdAt");
