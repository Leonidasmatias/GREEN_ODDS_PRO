import test from "node:test";
import assert from "node:assert/strict";
import { PredictionSource as PrismaPredictionSource } from "@prisma/client";
import { mapDraftToPrismaCreateInput, mapRowToPredictionRecord, mapSourceFromPrisma, mapSourceToPrisma } from "../src/repositories/prediction/PredictionSnapshotMapper.ts";
import { computePredictionSnapshotHash } from "../src/repositories/prediction/PredictionRepository.ts";
import { PredictionSerializationError } from "../src/repositories/prediction/predictionRepositoryErrors.ts";

function snapshot(overrides = {}) {
  return {
    matchId: "match-1",
    homePlayerId: "home-1",
    awayPlayerId: "away-1",
    virtualTeamHome: "Bologna Virtual",
    virtualTeamAway: "Roma Virtual",
    league: "eSoccer Battle - Liga A",
    period: "2026-07",
    sequenceKey: 1,
    result: {
      metadata: {
        generatedAt: "2026-07-28T09:00:00.000Z",
        configurationHash: "config-hash-abc",
        orchestratorModelVersion: "esoccer-prediction-orchestrator-v1.0.0-provisional",
      },
      greenScore: { category: "HIGH" },
      quality: { combinedStatus: "STRONG" },
    },
    ...overrides,
  };
}

function draft(overrides = {}) {
  const { snapshot: snapshotOverrides, ...rest } = overrides;
  const snap = snapshot(snapshotOverrides);
  return {
    snapshotHash: computePredictionSnapshotHash(snap),
    schemaVersion: "1.0",
    modelVersion: snap.result.metadata.orchestratorModelVersion,
    configurationHash: snap.result.metadata.configurationHash,
    source: "fixture",
    snapshot: snap,
    ...rest,
  };
}

function row(overrides = {}) {
  const snap = overrides.snapshotObject ?? snapshot();
  return {
    id: "cuid-1",
    snapshotHash: computePredictionSnapshotHash(snap),
    createdAt: new Date("2026-07-28T09:05:00.000Z"),
    matchId: snap.matchId,
    homePlayerId: snap.homePlayerId,
    awayPlayerId: snap.awayPlayerId,
    virtualTeamHome: snap.virtualTeamHome,
    virtualTeamAway: snap.virtualTeamAway,
    league: snap.league,
    period: snap.period,
    sequenceKey: String(snap.sequenceKey),
    modelVersion: snap.result.metadata.orchestratorModelVersion,
    configurationHash: snap.result.metadata.configurationHash,
    generatedAt: new Date(snap.result.metadata.generatedAt),
    source: "FIXTURE",
    schemaVersion: "1.0",
    greenScoreCategory: snap.result.greenScore.category,
    combinedStatus: snap.result.quality.combinedStatus,
    snapshotPayload: JSON.stringify(snap),
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// mapSourceToPrisma / mapSourceFromPrisma
// ---------------------------------------------------------------------

test("mapSourceToPrisma maps 'fixture' to FIXTURE", () => {
  assert.equal(mapSourceToPrisma("fixture"), PrismaPredictionSource.FIXTURE);
});

test("mapSourceToPrisma maps 'real' to REAL", () => {
  assert.equal(mapSourceToPrisma("real"), PrismaPredictionSource.REAL);
});

test("mapSourceFromPrisma maps FIXTURE to 'fixture'", () => {
  assert.equal(mapSourceFromPrisma(PrismaPredictionSource.FIXTURE), "fixture");
});

test("mapSourceFromPrisma maps REAL to 'real'", () => {
  assert.equal(mapSourceFromPrisma(PrismaPredictionSource.REAL), "real");
});

// ---------------------------------------------------------------------
// mapRowToPredictionRecord (deserialize + full row mapping)
// ---------------------------------------------------------------------

test("mapRowToPredictionRecord deserializes a valid snapshotPayload and maps every field", () => {
  const snap = snapshot();
  const record = mapRowToPredictionRecord(row({ snapshotObject: snap, id: "cuid-x", source: "REAL" }));

  assert.equal(record.id, "cuid-x");
  assert.equal(record.snapshotHash, computePredictionSnapshotHash(snap));
  assert.equal(record.createdAt, "2026-07-28T09:05:00.000Z");
  assert.equal(record.schemaVersion, "1.0");
  assert.equal(record.modelVersion, snap.result.metadata.orchestratorModelVersion);
  assert.equal(record.configurationHash, snap.result.metadata.configurationHash);
  assert.equal(record.source, "real");
  assert.deepEqual(record.snapshot, snap);
});

test("mapRowToPredictionRecord throws PredictionSerializationError for invalid JSON, never returning a partial object", () => {
  assert.throws(() => mapRowToPredictionRecord(row({ snapshotPayload: "{not valid json" })), PredictionSerializationError);
});

// ---------------------------------------------------------------------
// mapDraftToPrismaCreateInput (serialize + full draft mapping)
// ---------------------------------------------------------------------

test("mapDraftToPrismaCreateInput serializes the snapshot and extracts every denormalized column", () => {
  const input = draft();
  const data = mapDraftToPrismaCreateInput(input);

  assert.equal(data.snapshotHash, input.snapshotHash);
  assert.equal(data.matchId, "match-1");
  assert.equal(data.homePlayerId, "home-1");
  assert.equal(data.awayPlayerId, "away-1");
  assert.equal(data.virtualTeamHome, "Bologna Virtual");
  assert.equal(data.virtualTeamAway, "Roma Virtual");
  assert.equal(data.league, "eSoccer Battle - Liga A");
  assert.equal(data.period, "2026-07");
  assert.equal(data.sequenceKey, "1");
  assert.equal(data.modelVersion, input.modelVersion);
  assert.equal(data.configurationHash, input.configurationHash);
  assert.deepEqual(data.generatedAt, new Date(input.snapshot.result.metadata.generatedAt));
  assert.equal(data.source, PrismaPredictionSource.FIXTURE);
  assert.equal(data.schemaVersion, "1.0");
  assert.equal(data.greenScoreCategory, "HIGH");
  assert.equal(data.combinedStatus, "STRONG");
  assert.equal(data.snapshotPayload, JSON.stringify(input.snapshot));
});

test("mapDraftToPrismaCreateInput maps a null sequenceKey to null (never the string 'null')", () => {
  const data = mapDraftToPrismaCreateInput(draft({ snapshot: { sequenceKey: null } }));
  assert.equal(data.sequenceKey, null);
});

test("mapDraftToPrismaCreateInput preserves round-trip fidelity through mapRowToPredictionRecord", () => {
  const input = draft();
  const data = mapDraftToPrismaCreateInput(input);
  const reconstructedRow = row({
    snapshotObject: input.snapshot,
    snapshotHash: data.snapshotHash,
    matchId: data.matchId,
    homePlayerId: data.homePlayerId,
    awayPlayerId: data.awayPlayerId,
    virtualTeamHome: data.virtualTeamHome,
    virtualTeamAway: data.virtualTeamAway,
    league: data.league,
    period: data.period,
    sequenceKey: data.sequenceKey,
    modelVersion: data.modelVersion,
    configurationHash: data.configurationHash,
    generatedAt: data.generatedAt,
    source: data.source,
    schemaVersion: data.schemaVersion,
    greenScoreCategory: data.greenScoreCategory,
    combinedStatus: data.combinedStatus,
    snapshotPayload: data.snapshotPayload,
  });

  const record = mapRowToPredictionRecord(reconstructedRow);
  assert.deepEqual(record.snapshot, input.snapshot);
  assert.equal(record.source, input.source);
  assert.equal(record.modelVersion, input.modelVersion);
  assert.equal(record.configurationHash, input.configurationHash);
  assert.equal(record.schemaVersion, input.schemaVersion);
});
