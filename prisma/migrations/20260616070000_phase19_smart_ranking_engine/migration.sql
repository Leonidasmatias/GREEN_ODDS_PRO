CREATE TABLE "market_rankings" (
  "id" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "competition" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "bookmaker" TEXT NOT NULL,
  "oddRange" TEXT NOT NULL,
  "totalTips" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "voids" INTEGER NOT NULL DEFAULT 0,
  "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roi" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "drawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'INSUFFICIENT_REAL_DATA',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "market_rankings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_rankings_market_competition_provider_bookmaker_oddRange_key" ON "market_rankings"("market", "competition", "provider", "bookmaker", "oddRange");
CREATE INDEX "market_rankings_roi_winRate_idx" ON "market_rankings"("roi", "winRate");

CREATE TABLE "competition_rankings" (
  "id" TEXT NOT NULL,
  "competition" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "oddRange" TEXT NOT NULL,
  "totalTips" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "voids" INTEGER NOT NULL DEFAULT 0,
  "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roi" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "drawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'INSUFFICIENT_REAL_DATA',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "competition_rankings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competition_rankings_competition_provider_oddRange_key" ON "competition_rankings"("competition", "provider", "oddRange");
CREATE INDEX "competition_rankings_roi_winRate_idx" ON "competition_rankings"("roi", "winRate");

CREATE TABLE "bookmaker_rankings" (
  "id" TEXT NOT NULL,
  "bookmaker" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "oddRange" TEXT NOT NULL,
  "totalTips" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "voids" INTEGER NOT NULL DEFAULT 0,
  "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roi" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "drawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'INSUFFICIENT_REAL_DATA',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bookmaker_rankings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bookmaker_rankings_bookmaker_provider_oddRange_key" ON "bookmaker_rankings"("bookmaker", "provider", "oddRange");
CREATE INDEX "bookmaker_rankings_roi_winRate_idx" ON "bookmaker_rankings"("roi", "winRate");
