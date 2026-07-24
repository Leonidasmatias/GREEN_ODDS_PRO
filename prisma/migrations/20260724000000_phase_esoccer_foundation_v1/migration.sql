-- Fase 1 (ESOCCER INTELLIGENCE V1) — Fundação do domínio eSoccer.
-- SQL escrito manualmente (não gerado por `prisma migrate dev`/`prisma migrate diff`)
-- porque o ambiente de execução usado para montar esta migration não tem acesso
-- aos binários de engine do Prisma para Linux nem rede para baixá-los
-- (ver seção de riscos/pendências do relatório final). Este arquivo replica
-- fielmente as convenções de DDL já usadas nas migrations anteriores deste
-- projeto (nomes de constraint, tipos de coluna, ON DELETE/ON UPDATE).
-- Antes de aplicar em qualquer banco real, valide localmente com:
--   npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script
-- e compare com o conteúdo abaixo.

-- CreateEnum
CREATE TYPE "ESoccerPlayerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ESoccerLeagueStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNKNOWN');
CREATE TYPE "ESoccerMatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED', 'UNKNOWN');
CREATE TYPE "ESoccerProvider" AS ENUM ('BETSAPI', 'FIXTURE', 'CSV', 'MANUAL');
CREATE TYPE "ESoccerRatingSystem" AS ENUM ('ELO', 'GLICKO', 'CUSTOM');
CREATE TYPE "ESoccerRecommendationStatus" AS ENUM ('APPROVED', 'OBSERVATION', 'NO_BET');
CREATE TYPE "ESoccerMarket" AS ENUM ('MATCH_WINNER', 'DRAW_NO_BET', 'BOTH_TEAMS_TO_SCORE', 'OVER_2_5', 'OVER_3_5', 'OVER_4_5', 'OVER_5_5');

-- CreateTable
CREATE TABLE "esoccer_players" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "normalizedNickname" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "ESoccerPlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esoccer_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esoccer_player_aliases" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "esoccer_player_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esoccer_leagues" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "provider" "ESoccerProvider" NOT NULL DEFAULT 'FIXTURE',
    "gameDurationMinutes" INTEGER,
    "status" "ESoccerLeagueStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esoccer_leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esoccer_virtual_teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esoccer_virtual_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esoccer_matches" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "provider" "ESoccerProvider" NOT NULL DEFAULT 'FIXTURE',
    "leagueId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "status" "ESoccerMatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homePlayerId" TEXT NOT NULL,
    "awayPlayerId" TEXT NOT NULL,
    "homeVirtualTeamId" TEXT,
    "awayVirtualTeamId" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "rawHomeName" TEXT NOT NULL,
    "rawAwayName" TEXT NOT NULL,
    "sourcePayload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esoccer_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esoccer_player_ratings" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "ratingSystem" "ESoccerRatingSystem" NOT NULL DEFAULT 'CUSTOM',
    "matchesCount" INTEGER NOT NULL DEFAULT 0,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "esoccer_player_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esoccer_player_rolling_stats" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "windowSize" INTEGER NOT NULL,
    "matchesCount" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "avgGoalsFor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgGoalsAgainst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bothTeamsScoredRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "over25Rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "over35Rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "over45Rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esoccer_player_rolling_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esoccer_head_to_head_stats" (
    "id" TEXT NOT NULL,
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT NOT NULL,
    "matchesCount" INTEGER NOT NULL DEFAULT 0,
    "playerAWins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "playerBWins" INTEGER NOT NULL DEFAULT 0,
    "playerAGoals" INTEGER NOT NULL DEFAULT 0,
    "playerBGoals" INTEGER NOT NULL DEFAULT 0,
    "over25Rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "over35Rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bothTeamsScoredRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esoccer_head_to_head_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esoccer_predictions" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "homeWinProbability" DOUBLE PRECISION NOT NULL,
    "drawProbability" DOUBLE PRECISION NOT NULL,
    "awayWinProbability" DOUBLE PRECISION NOT NULL,
    "expectedTotalGoals" DOUBLE PRECISION,
    "over25Probability" DOUBLE PRECISION,
    "over35Probability" DOUBLE PRECISION,
    "over45Probability" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "esoccer_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esoccer_recommendations" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "predictionId" TEXT,
    "market" "ESoccerMarket" NOT NULL,
    "selection" TEXT,
    "status" "ESoccerRecommendationStatus" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "estimatedProbability" DOUBLE PRECISION,
    "offeredOdd" DOUBLE PRECISION,
    "impliedProbability" DOUBLE PRECISION,
    "edge" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "riskFlags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esoccer_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "esoccer_players_normalizedNickname_key" ON "esoccer_players"("normalizedNickname");
CREATE INDEX "esoccer_players_status_lastSeenAt_idx" ON "esoccer_players"("status", "lastSeenAt");

CREATE UNIQUE INDEX "esoccer_player_aliases_normalizedAlias_key" ON "esoccer_player_aliases"("normalizedAlias");
CREATE INDEX "esoccer_player_aliases_playerId_idx" ON "esoccer_player_aliases"("playerId");

CREATE UNIQUE INDEX "esoccer_leagues_normalizedName_key" ON "esoccer_leagues"("normalizedName");
CREATE INDEX "esoccer_leagues_externalId_idx" ON "esoccer_leagues"("externalId");
CREATE INDEX "esoccer_leagues_provider_status_idx" ON "esoccer_leagues"("provider", "status");

CREATE UNIQUE INDEX "esoccer_virtual_teams_normalizedName_key" ON "esoccer_virtual_teams"("normalizedName");

CREATE UNIQUE INDEX "esoccer_matches_provider_externalId_key" ON "esoccer_matches"("provider", "externalId");
CREATE INDEX "esoccer_matches_externalId_idx" ON "esoccer_matches"("externalId");
CREATE INDEX "esoccer_matches_provider_idx" ON "esoccer_matches"("provider");
CREATE INDEX "esoccer_matches_leagueId_idx" ON "esoccer_matches"("leagueId");
CREATE INDEX "esoccer_matches_scheduledAt_idx" ON "esoccer_matches"("scheduledAt");
CREATE INDEX "esoccer_matches_status_idx" ON "esoccer_matches"("status");
CREATE INDEX "esoccer_matches_homePlayerId_idx" ON "esoccer_matches"("homePlayerId");
CREATE INDEX "esoccer_matches_awayPlayerId_idx" ON "esoccer_matches"("awayPlayerId");

CREATE INDEX "esoccer_player_ratings_playerId_idx" ON "esoccer_player_ratings"("playerId");
CREATE INDEX "esoccer_player_ratings_recordedAt_idx" ON "esoccer_player_ratings"("recordedAt");

CREATE UNIQUE INDEX "esoccer_player_rolling_stats_playerId_windowSize_key" ON "esoccer_player_rolling_stats"("playerId", "windowSize");

CREATE UNIQUE INDEX "esoccer_head_to_head_stats_playerAId_playerBId_key" ON "esoccer_head_to_head_stats"("playerAId", "playerBId");
CREATE INDEX "esoccer_head_to_head_stats_playerAId_idx" ON "esoccer_head_to_head_stats"("playerAId");
CREATE INDEX "esoccer_head_to_head_stats_playerBId_idx" ON "esoccer_head_to_head_stats"("playerBId");

CREATE INDEX "esoccer_predictions_matchId_idx" ON "esoccer_predictions"("matchId");
CREATE INDEX "esoccer_predictions_createdAt_idx" ON "esoccer_predictions"("createdAt");

CREATE INDEX "esoccer_recommendations_matchId_idx" ON "esoccer_recommendations"("matchId");
CREATE INDEX "esoccer_recommendations_predictionId_idx" ON "esoccer_recommendations"("predictionId");
CREATE INDEX "esoccer_recommendations_status_market_idx" ON "esoccer_recommendations"("status", "market");

-- AddForeignKey
ALTER TABLE "esoccer_player_aliases" ADD CONSTRAINT "esoccer_player_aliases_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "esoccer_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "esoccer_matches" ADD CONSTRAINT "esoccer_matches_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "esoccer_leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "esoccer_matches" ADD CONSTRAINT "esoccer_matches_homePlayerId_fkey" FOREIGN KEY ("homePlayerId") REFERENCES "esoccer_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "esoccer_matches" ADD CONSTRAINT "esoccer_matches_awayPlayerId_fkey" FOREIGN KEY ("awayPlayerId") REFERENCES "esoccer_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "esoccer_matches" ADD CONSTRAINT "esoccer_matches_homeVirtualTeamId_fkey" FOREIGN KEY ("homeVirtualTeamId") REFERENCES "esoccer_virtual_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "esoccer_matches" ADD CONSTRAINT "esoccer_matches_awayVirtualTeamId_fkey" FOREIGN KEY ("awayVirtualTeamId") REFERENCES "esoccer_virtual_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "esoccer_player_ratings" ADD CONSTRAINT "esoccer_player_ratings_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "esoccer_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "esoccer_player_rolling_stats" ADD CONSTRAINT "esoccer_player_rolling_stats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "esoccer_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "esoccer_head_to_head_stats" ADD CONSTRAINT "esoccer_head_to_head_stats_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "esoccer_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "esoccer_head_to_head_stats" ADD CONSTRAINT "esoccer_head_to_head_stats_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "esoccer_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "esoccer_predictions" ADD CONSTRAINT "esoccer_predictions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "esoccer_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "esoccer_recommendations" ADD CONSTRAINT "esoccer_recommendations_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "esoccer_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "esoccer_recommendations" ADD CONSTRAINT "esoccer_recommendations_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "esoccer_predictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
