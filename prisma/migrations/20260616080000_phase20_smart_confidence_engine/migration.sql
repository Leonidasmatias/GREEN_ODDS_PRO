CREATE TABLE "market_confidence" (
  "id" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "bookmaker" TEXT NOT NULL,
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
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

  CONSTRAINT "market_confidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_confidence_market_provider_bookmaker_key" ON "market_confidence"("market", "provider", "bookmaker");
CREATE INDEX "market_confidence_confidenceScore_roi_idx" ON "market_confidence"("confidenceScore", "roi");

CREATE TABLE "competition_confidence" (
  "id" TEXT NOT NULL,
  "competition" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
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

  CONSTRAINT "competition_confidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competition_confidence_competition_provider_key" ON "competition_confidence"("competition", "provider");
CREATE INDEX "competition_confidence_confidenceScore_roi_idx" ON "competition_confidence"("confidenceScore", "roi");

CREATE TABLE "bookmaker_confidence" (
  "id" TEXT NOT NULL,
  "bookmaker" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
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

  CONSTRAINT "bookmaker_confidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bookmaker_confidence_bookmaker_provider_key" ON "bookmaker_confidence"("bookmaker", "provider");
CREATE INDEX "bookmaker_confidence_confidenceScore_roi_idx" ON "bookmaker_confidence"("confidenceScore", "roi");

CREATE TABLE "odd_range_confidence" (
  "id" TEXT NOT NULL,
  "oddRange" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
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

  CONSTRAINT "odd_range_confidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "odd_range_confidence_oddRange_provider_key" ON "odd_range_confidence"("oddRange", "provider");
CREATE INDEX "odd_range_confidence_confidenceScore_roi_idx" ON "odd_range_confidence"("confidenceScore", "roi");
