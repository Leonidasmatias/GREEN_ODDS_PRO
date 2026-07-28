// Sprint 7.3.1 — Refinamento Arquitetural do Prediction Repository.
// Concentra exclusivamente a tradução entre a forma de aplicação
// (`PredictionRecord`/`PredictionRecordDraft`, com `PredictionSnapshot`
// já real do Prediction Orchestrator) e a forma de persistência Prisma
// (`PredictionSnapshotRecord`, com `source` como enum e o snapshot
// serializado em `snapshotPayload`). Funções puras: nenhum acesso a
// banco, nenhuma instância de Prisma Client, nenhuma regra do motor,
// nenhum estado global. Movido de `PrismaPredictionRepository.ts`
// (Sprint 7.3) sem nenhuma alteração de comportamento.

// Import relativo (não `@/`) — mesma justificativa de
// `PredictionRepository.ts`.
import { PredictionSource as PrismaPredictionSource } from "@prisma/client";
import type { PredictionSnapshotRecord as PredictionSnapshotRecordRow } from "@prisma/client";
import type { PredictionRecord, PredictionRecordDraft, PredictionRecordSource } from "./PredictionRepository.ts";
import { PredictionSerializationError } from "./predictionRepositoryErrors.ts";

export function mapSourceToPrisma(source: PredictionRecordSource): PrismaPredictionSource {
  return source === "fixture" ? PrismaPredictionSource.FIXTURE : PrismaPredictionSource.REAL;
}

export function mapSourceFromPrisma(source: PrismaPredictionSource): PredictionRecordSource {
  if (source === PrismaPredictionSource.FIXTURE) return "fixture";
  if (source === PrismaPredictionSource.REAL) return "real";
  throw new PredictionSerializationError("mapSourceFromPrisma");
}

/** Desserializa `snapshotPayload` e monta o `PredictionRecord` completo
 * — erro explícito (nunca objeto parcial) para JSON inválido/corrompido. */
export function mapRowToPredictionRecord(row: PredictionSnapshotRecordRow): PredictionRecord {
  let snapshot: PredictionRecord["snapshot"];
  try {
    snapshot = JSON.parse(row.snapshotPayload);
  } catch (error) {
    throw new PredictionSerializationError("mapRowToPredictionRecord", error);
  }

  return {
    id: row.id,
    snapshotHash: row.snapshotHash,
    createdAt: row.createdAt.toISOString(),
    schemaVersion: row.schemaVersion,
    modelVersion: row.modelVersion,
    configurationHash: row.configurationHash,
    source: mapSourceFromPrisma(row.source),
    snapshot,
  };
}

/** Serializa `draft.snapshot` e monta os dados necessários para
 * `predictionSnapshotRecord.create(...)` — as colunas denormalizadas são
 * extraídas do próprio snapshot (leitura direta, nunca um cálculo novo). */
export function mapDraftToPrismaCreateInput(draft: PredictionRecordDraft): Record<string, unknown> {
  let snapshotPayload: string;
  try {
    snapshotPayload = JSON.stringify(draft.snapshot);
  } catch (error) {
    throw new PredictionSerializationError("mapDraftToPrismaCreateInput", error);
  }

  return {
    snapshotHash: draft.snapshotHash,
    matchId: draft.snapshot.matchId,
    homePlayerId: draft.snapshot.homePlayerId,
    awayPlayerId: draft.snapshot.awayPlayerId,
    virtualTeamHome: draft.snapshot.virtualTeamHome,
    virtualTeamAway: draft.snapshot.virtualTeamAway,
    league: draft.snapshot.league,
    period: draft.snapshot.period,
    sequenceKey: draft.snapshot.sequenceKey === null ? null : String(draft.snapshot.sequenceKey),
    modelVersion: draft.modelVersion,
    configurationHash: draft.configurationHash,
    generatedAt: new Date(draft.snapshot.result.metadata.generatedAt),
    source: mapSourceToPrisma(draft.source),
    schemaVersion: draft.schemaVersion,
    greenScoreCategory: draft.snapshot.result.greenScore.category,
    combinedStatus: draft.snapshot.result.quality.combinedStatus,
    snapshotPayload,
  };
}
