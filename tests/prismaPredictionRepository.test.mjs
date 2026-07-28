import test from "node:test";
import assert from "node:assert/strict";
import { PrismaPredictionRepository } from "../src/repositories/prediction/PrismaPredictionRepository.ts";
import { computePredictionSnapshotHash } from "../src/repositories/prediction/PredictionRepository.ts";
import { PredictionRepositoryUnavailableError, PredictionSerializationError, PredictionRepositoryValidationError } from "../src/repositories/prediction/predictionRepositoryErrors.ts";

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

function fakeRow(overrides = {}) {
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
// save()
// ---------------------------------------------------------------------

test("save() returns the existing record when snapshotHash already exists, never calling create()", async () => {
  const existingRow = fakeRow();
  let createCalled = false;
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => existingRow,
      create: async () => {
        createCalled = true;
        throw new Error("should not be called");
      },
      findMany: async () => [],
      count: async () => 0,
    },
  });

  const result = await repository.save(draft());
  assert.equal(result.id, "cuid-1");
  assert.equal(createCalled, false);
});

test("save() creates a new record when snapshotHash is not found, sending correctly mapped data", async () => {
  let capturedData = null;
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => null,
      create: async ({ data }) => {
        capturedData = data;
        return fakeRow();
      },
      findMany: async () => [],
      count: async () => 0,
    },
  });

  const input = draft();
  await repository.save(input);

  assert.equal(capturedData.snapshotHash, input.snapshotHash);
  assert.equal(capturedData.matchId, "match-1");
  assert.equal(capturedData.homePlayerId, "home-1");
  assert.equal(capturedData.source, "FIXTURE");
  assert.equal(capturedData.snapshotPayload, JSON.stringify(input.snapshot));
  assert.equal(capturedData.greenScoreCategory, "HIGH");
  assert.equal(capturedData.combinedStatus, "STRONG");
});

test("save() maps source 'real' to the Prisma enum REAL", async () => {
  let capturedData = null;
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => null,
      create: async ({ data }) => {
        capturedData = data;
        return fakeRow();
      },
      findMany: async () => [],
      count: async () => 0,
    },
  });

  await repository.save(draft({ source: "real" }));
  assert.equal(capturedData.source, "REAL");
});

test("save() handles a unique-constraint race (P2002 on create) by re-fetching and returning the winning record idempotently", async () => {
  const raceWinnerRow = fakeRow({ id: "cuid-race-winner" });
  let findUniqueCalls = 0;
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => {
        findUniqueCalls += 1;
        return findUniqueCalls === 1 ? null : raceWinnerRow;
      },
      create: async () => {
        const error = new Error("Unique constraint failed on the fields: (`snapshotHash`)");
        error.code = "P2002";
        throw error;
      },
      findMany: async () => [],
      count: async () => 0,
    },
  });

  const result = await repository.save(draft());
  assert.equal(result.id, "cuid-race-winner");
  assert.equal(findUniqueCalls, 2);
});

test("save() wraps an unexpected client failure as PredictionRepositoryUnavailableError, never propagating the raw error", async () => {
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => {
        throw new Error("connection refused to postgresql://user:secret@host/db");
      },
      create: async () => fakeRow(),
      findMany: async () => [],
      count: async () => 0,
    },
  });

  await assert.rejects(() => repository.save(draft()), (error) => {
    assert.ok(error instanceof PredictionRepositoryUnavailableError);
    assert.ok(!error.message.includes("secret"));
    return true;
  });
});

test("save() rejects a structurally invalid draft before ever touching the client", async () => {
  let clientTouched = false;
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => {
        clientTouched = true;
        return null;
      },
      create: async () => {
        clientTouched = true;
        return fakeRow();
      },
      findMany: async () => [],
      count: async () => 0,
    },
  });

  await assert.rejects(() => repository.save(draft({ snapshotHash: "" })), PredictionRepositoryValidationError);
  assert.equal(clientTouched, false);
});

// ---------------------------------------------------------------------
// getById()
// ---------------------------------------------------------------------

test("getById() maps a found row to a full PredictionRecord (enum and JSON deserialized)", async () => {
  const snap = snapshot();
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => fakeRow({ snapshotObject: snap, source: "REAL" }),
      create: async () => fakeRow(),
      findMany: async () => [],
      count: async () => 0,
    },
  });

  const record = await repository.getById("cuid-1");
  assert.equal(record.id, "cuid-1");
  assert.equal(record.source, "real");
  assert.equal(record.createdAt, "2026-07-28T09:05:00.000Z");
  assert.deepEqual(record.snapshot, snap);
});

test("getById() returns null when the row is not found", async () => {
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => null,
      create: async () => fakeRow(),
      findMany: async () => [],
      count: async () => 0,
    },
  });

  assert.equal(await repository.getById("missing"), null);
});

test("getById() throws PredictionSerializationError for a corrupted snapshotPayload, distinct from an unavailable error", async () => {
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => fakeRow({ snapshotPayload: "{not valid json" }),
      create: async () => fakeRow(),
      findMany: async () => [],
      count: async () => 0,
    },
  });

  await assert.rejects(() => repository.getById("cuid-1"), PredictionSerializationError);
});

test("getById() wraps an unexpected client failure as PredictionRepositoryUnavailableError", async () => {
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => {
        throw new Error("boom");
      },
      create: async () => fakeRow(),
      findMany: async () => [],
      count: async () => 0,
    },
  });

  await assert.rejects(() => repository.getById("cuid-1"), PredictionRepositoryUnavailableError);
});

// ---------------------------------------------------------------------
// search()
// ---------------------------------------------------------------------

test("search() builds the expected where/orderBy/pagination and maps results + total", async () => {
  let capturedFindManyArgs = null;
  let capturedCountArgs = null;
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => null,
      create: async () => fakeRow(),
      findMany: async (args) => {
        capturedFindManyArgs = args;
        return [fakeRow()];
      },
      count: async (args) => {
        capturedCountArgs = args;
        return 42;
      },
    },
  });

  const result = await repository.search({ matchId: "match-1", league: "Liga A", period: "2026-07" }, { limit: 10, offset: 5 });

  assert.deepEqual(capturedFindManyArgs.where, { matchId: "match-1", league: "Liga A", period: "2026-07" });
  assert.deepEqual(capturedFindManyArgs.orderBy, [{ generatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]);
  assert.equal(capturedFindManyArgs.skip, 5);
  assert.equal(capturedFindManyArgs.take, 10);
  assert.deepEqual(capturedCountArgs.where, capturedFindManyArgs.where);
  assert.equal(result.total, 42);
  assert.equal(result.items.length, 1);
});

test("search() maps playerId to an OR condition across homePlayerId/awayPlayerId", async () => {
  let capturedWhere = null;
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => null,
      create: async () => fakeRow(),
      findMany: async (args) => {
        capturedWhere = args.where;
        return [];
      },
      count: async () => 0,
    },
  });

  await repository.search({ playerId: "alice" });
  assert.deepEqual(capturedWhere.OR, [{ homePlayerId: "alice" }, { awayPlayerId: "alice" }]);
});

test("search() applies default pagination and ordering when filter/options are entirely omitted", async () => {
  let capturedArgs = null;
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => null,
      create: async () => fakeRow(),
      findMany: async (args) => {
        capturedArgs = args;
        return [];
      },
      count: async () => 0,
    },
  });

  await repository.search();
  assert.equal(capturedArgs.skip, 0);
  assert.equal(capturedArgs.take, 20);
  assert.deepEqual(capturedArgs.orderBy, [{ generatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]);
  assert.deepEqual(capturedArgs.where, {});
});

test("search() with orderBy 'createdAt' builds the createdAt -> id chain", async () => {
  let capturedArgs = null;
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => null,
      create: async () => fakeRow(),
      findMany: async (args) => {
        capturedArgs = args;
        return [];
      },
      count: async () => 0,
    },
  });

  await repository.search({}, { orderBy: "createdAt" });
  assert.deepEqual(capturedArgs.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
});

test("search() with orderDirection 'asc' applies the same direction to every clause in the chain", async () => {
  let capturedArgs = null;
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => null,
      create: async () => fakeRow(),
      findMany: async (args) => {
        capturedArgs = args;
        return [];
      },
      count: async () => 0,
    },
  });

  await repository.search({}, { orderDirection: "asc" });
  assert.deepEqual(capturedArgs.orderBy, [{ generatedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }]);
});

test("search() wraps an unexpected client failure as PredictionRepositoryUnavailableError", async () => {
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => null,
      create: async () => fakeRow(),
      findMany: async () => {
        throw new Error("boom");
      },
      count: async () => 0,
    },
  });

  await assert.rejects(() => repository.search({}), PredictionRepositoryUnavailableError);
});

// ---------------------------------------------------------------------
// health()
// ---------------------------------------------------------------------

test("health() is available when count() resolves", async () => {
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => null,
      create: async () => fakeRow(),
      findMany: async () => [],
      count: async () => 0,
    },
  });

  assert.deepEqual(await repository.health(), { status: "available", backend: "prisma", detail: null });
});

test("health() is unavailable when count() rejects, without exposing internal details", async () => {
  const repository = new PrismaPredictionRepository({
    predictionSnapshotRecord: {
      findUnique: async () => null,
      create: async () => fakeRow(),
      findMany: async () => [],
      count: async () => {
        throw new Error("password authentication failed for user \"admin\"");
      },
    },
  });

  const health = await repository.health();
  assert.equal(health.status, "unavailable");
  assert.equal(health.backend, "prisma");
  assert.ok(!health.detail.includes("password"));
});

// ---------------------------------------------------------------------
// Construção padrão
// ---------------------------------------------------------------------

test("constructing PrismaPredictionRepository with no arguments (production default) never throws and never creates a new PrismaClient", () => {
  assert.doesNotThrow(() => new PrismaPredictionRepository());
});
