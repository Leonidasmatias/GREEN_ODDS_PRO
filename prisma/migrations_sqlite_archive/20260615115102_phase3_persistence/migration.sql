-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT,
    "competition" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRE_GAME',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "odds_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "odd" REAL NOT NULL,
    "provider" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "odds_snapshots_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tips" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "gameLabel" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "odd" REAL NOT NULL,
    "impliedProbability" REAL NOT NULL,
    "estimatedProbability" REAL NOT NULL,
    "edge" REAL NOT NULL,
    "expectedValue" REAL NOT NULL,
    "confidenceScore" REAL NOT NULL,
    "classification" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stake" REAL NOT NULL DEFAULT 1,
    "profitLoss" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" DATETIME,
    CONSTRAINT "tips_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "eventsReceived" INTEGER NOT NULL DEFAULT 0,
    "snapshotsCreated" INTEGER NOT NULL DEFAULT 0,
    "tipsCreated" INTEGER NOT NULL DEFAULT 0,
    "requestsRemaining" INTEGER,
    "warning" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "performance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "totalEntries" INTEGER NOT NULL,
    "greens" INTEGER NOT NULL,
    "reds" INTEGER NOT NULL,
    "pending" INTEGER NOT NULL,
    "totalStake" REAL NOT NULL,
    "accumulatedProfit" REAL NOT NULL,
    "roi" REAL NOT NULL,
    "hitRate" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "matches_providerId_key" ON "matches"("providerId");

-- CreateIndex
CREATE INDEX "matches_startsAt_status_idx" ON "matches"("startsAt", "status");

-- CreateIndex
CREATE INDEX "odds_snapshots_matchId_market_capturedAt_idx" ON "odds_snapshots"("matchId", "market", "capturedAt");

-- CreateIndex
CREATE INDEX "odds_snapshots_provider_capturedAt_idx" ON "odds_snapshots"("provider", "capturedAt");

-- CreateIndex
CREATE INDEX "tips_status_createdAt_idx" ON "tips"("status", "createdAt");

-- CreateIndex
CREATE INDEX "tips_expectedValue_confidenceScore_idx" ON "tips"("expectedValue", "confidenceScore");

-- CreateIndex
CREATE INDEX "sync_runs_startedAt_idx" ON "sync_runs"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "performance_periodStart_periodEnd_key" ON "performance"("periodStart", "periodEnd");
