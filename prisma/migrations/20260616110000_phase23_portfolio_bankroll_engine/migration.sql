CREATE TABLE "bankroll_profiles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "initialBankroll" DOUBLE PRECISION NOT NULL,
  "currentBankroll" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "riskProfile" TEXT NOT NULL DEFAULT 'CONSERVADOR',
  "maxDailyRiskPercent" DOUBLE PRECISION NOT NULL DEFAULT 2,
  "maxStakePercent" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "maxOpenExposurePercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "stopLossDailyPercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "stopWinDailyPercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bankroll_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bankroll_allocations" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "allocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bankroll_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exposure_limits" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "scopeValue" TEXT NOT NULL,
  "maxPercent" DOUBLE PRECISION NOT NULL,
  "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "exposure_limits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stake_recommendations" (
  "id" TEXT NOT NULL,
  "tipId" TEXT,
  "matchId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "selection" TEXT NOT NULL,
  "odd" DOUBLE PRECISION NOT NULL,
  "confidenceScore" DOUBLE PRECISION NOT NULL,
  "modelProbability" DOUBLE PRECISION,
  "edge" DOUBLE PRECISION,
  "expectedValue" DOUBLE PRECISION,
  "risk" TEXT NOT NULL,
  "recommendedStake" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stakePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "strategy" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stake_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bankroll_events" (
  "id" TEXT NOT NULL,
  "profileId" TEXT,
  "eventType" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bankroll_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bankroll_profiles_status_createdAt_idx" ON "bankroll_profiles"("status", "createdAt");
CREATE INDEX "bankroll_allocations_profileId_category_idx" ON "bankroll_allocations"("profileId", "category");
CREATE INDEX "exposure_limits_profileId_scope_scopeValue_idx" ON "exposure_limits"("profileId", "scope", "scopeValue");
CREATE INDEX "stake_recommendations_tipId_idx" ON "stake_recommendations"("tipId");
CREATE INDEX "stake_recommendations_matchId_market_selection_idx" ON "stake_recommendations"("matchId", "market", "selection");
CREATE INDEX "stake_recommendations_status_createdAt_idx" ON "stake_recommendations"("status", "createdAt");
CREATE INDEX "bankroll_events_profileId_createdAt_idx" ON "bankroll_events"("profileId", "createdAt");
CREATE INDEX "bankroll_events_eventType_createdAt_idx" ON "bankroll_events"("eventType", "createdAt");
