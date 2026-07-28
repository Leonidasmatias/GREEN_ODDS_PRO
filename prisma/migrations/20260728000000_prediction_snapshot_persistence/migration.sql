-- Sprint 8.3 — Production Persistence.
-- Cria exclusivamente `PredictionSnapshotRecord`/`PredictionSource`
-- (Sprint 7.2), o modelo de persistência do Prediction Center. Nenhuma
-- tabela existente é alterada, renomeada ou tem dados apagados. SQL
-- escrito manualmente seguindo exatamente as mesmas convenções de DDL
-- já usadas em `20260724000000_phase_esoccer_foundation_v1` (nomes de
-- constraint `<tabela>_pkey`/`<tabela>_<coluna>_key`/`<tabela>_<coluna>_idx`,
-- TEXT para String, TIMESTAMP(3) para DateTime). Deliberadamente sem
-- `ON DELETE`/`ON UPDATE`/`FOREIGN KEY`: o modelo é denormalizado por
-- design (ver comentário em `schema.prisma`), então esta migration não
-- contém nenhuma seção `-- AddForeignKey`.

-- CreateEnum
CREATE TYPE "PredictionSource" AS ENUM ('FIXTURE', 'REAL');

-- CreateTable
CREATE TABLE "prediction_snapshot_records" (
    "id" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "matchId" TEXT NOT NULL,
    "homePlayerId" TEXT NOT NULL,
    "awayPlayerId" TEXT NOT NULL,
    "virtualTeamHome" TEXT,
    "virtualTeamAway" TEXT,
    "league" TEXT,
    "period" TEXT,
    "sequenceKey" TEXT,

    "modelVersion" TEXT NOT NULL,
    "configurationHash" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "source" "PredictionSource" NOT NULL,
    "schemaVersion" TEXT NOT NULL,

    "greenScoreCategory" TEXT NOT NULL,
    "combinedStatus" TEXT NOT NULL,

    "snapshotPayload" TEXT NOT NULL,

    CONSTRAINT "prediction_snapshot_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prediction_snapshot_records_snapshotHash_key" ON "prediction_snapshot_records"("snapshotHash");

-- CreateIndex
CREATE INDEX "prediction_snapshot_records_matchId_idx" ON "prediction_snapshot_records"("matchId");

-- CreateIndex
CREATE INDEX "prediction_snapshot_records_homePlayerId_idx" ON "prediction_snapshot_records"("homePlayerId");

-- CreateIndex
CREATE INDEX "prediction_snapshot_records_awayPlayerId_idx" ON "prediction_snapshot_records"("awayPlayerId");

-- CreateIndex
CREATE INDEX "prediction_snapshot_records_league_idx" ON "prediction_snapshot_records"("league");

-- CreateIndex
CREATE INDEX "prediction_snapshot_records_period_idx" ON "prediction_snapshot_records"("period");

-- CreateIndex
CREATE INDEX "prediction_snapshot_records_generatedAt_idx" ON "prediction_snapshot_records"("generatedAt");
