CREATE TABLE "provider_cache" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_cache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_usage_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 1,
    "creditsRemaining" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_cache_provider_cacheKey_key" ON "provider_cache"("provider", "cacheKey");
CREATE INDEX "provider_cache_provider_expiresAt_idx" ON "provider_cache"("provider", "expiresAt");
CREATE INDEX "provider_usage_logs_provider_createdAt_idx" ON "provider_usage_logs"("provider", "createdAt");
CREATE INDEX "provider_usage_logs_status_createdAt_idx" ON "provider_usage_logs"("status", "createdAt");
