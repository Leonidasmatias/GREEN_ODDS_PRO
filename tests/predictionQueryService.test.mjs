import test from "node:test";
import assert from "node:assert/strict";
import { PredictionQueryService } from "../src/services/prediction-query/PredictionQueryService.ts";
import { PredictionQueryValidationError } from "../src/services/prediction-query/predictionQueryErrors.ts";
import { InMemoryPredictionRepository } from "../src/repositories/prediction/InMemoryPredictionRepository.ts";
import { computePredictionSnapshotHash } from "../src/repositories/prediction/PredictionRepository.ts";
import { PredictionRepositoryUnavailableError, PredictionSerializationError } from "../src/repositories/prediction/predictionRepositoryErrors.ts";

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

function fakeRepository(overrides = {}) {
  return {
    health: async () => ({ status: "available", backend: "memory", detail: null }),
    save: async () => {
      throw new Error("save() should never be called by the Query Service");
    },
    getById: async () => null,
    search: async () => ({ items: [], total: 0 }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// health()
// ---------------------------------------------------------------------

test("health() delegates to the repository and reports available/memory", async () => {
  const service = new PredictionQueryService(new InMemoryPredictionRepository());
  assert.deepEqual(await service.health(), { status: "available", backend: "memory", detail: null });
});

test("health() propagates an unavailable status from the repository without extra queries", async () => {
  const repository = fakeRepository({ health: async () => ({ status: "unavailable", backend: "prisma", detail: "db down" }) });
  const service = new PredictionQueryService(repository);
  assert.deepEqual(await service.health(), { status: "unavailable", backend: "prisma", detail: "db down" });
});

// ---------------------------------------------------------------------
// getById()
// ---------------------------------------------------------------------

test("getById() returns a PredictionDetail for an existing id", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  const saved = await repository.save(draft());

  const detail = await service.getById(saved.id);
  assert.equal(detail.id, saved.id);
  assert.deepEqual(detail.snapshot, saved.snapshot);
});

test("getById() returns null for a non-existent id, never throwing", async () => {
  const service = new PredictionQueryService(new InMemoryPredictionRepository());
  assert.equal(await service.getById("does-not-exist"), null);
});

test("getById() throws PredictionQueryValidationError for an empty id", async () => {
  const service = new PredictionQueryService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.getById(""), PredictionQueryValidationError);
});

test("getById() result never exposes snapshotPayload or any Prisma-shaped field", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  const saved = await repository.save(draft());
  const detail = await service.getById(saved.id);
  assert.equal("snapshotPayload" in detail, false);
});

test("mutating the snapshot on a PredictionDetail returned by getById() never affects a future query", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  const saved = await repository.save(draft());

  const first = await service.getById(saved.id);
  first.snapshot.matchId = "mutated";

  const second = await service.getById(saved.id);
  assert.equal(second.snapshot.matchId, "match-1");
});

// ---------------------------------------------------------------------
// search()
// ---------------------------------------------------------------------

test("search() with no arguments returns every record", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "m1" } }));
  await repository.save(draft({ snapshot: { matchId: "m2" } }));
  const page = await service.search();
  assert.equal(page.total, 2);
});

test("search() filters by matchId", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "match-a" } }));
  await repository.save(draft({ snapshot: { matchId: "match-b" } }));
  const page = await service.search({ matchId: "match-a" });
  assert.equal(page.total, 1);
  assert.equal(page.items[0].matchId, "match-a");
});

test("search() filters by playerId", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "m1", homePlayerId: "alice" } }));
  await repository.save(draft({ snapshot: { matchId: "m2", homePlayerId: "bob" } }));
  const page = await service.search({ playerId: "alice" });
  assert.equal(page.total, 1);
  assert.equal(page.items[0].homePlayerId, "alice");
});

test("search() filters by league", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "m1", league: "Liga A" } }));
  await repository.save(draft({ snapshot: { matchId: "m2", league: "Liga B" } }));
  const page = await service.search({ league: "Liga A" });
  assert.equal(page.total, 1);
});

test("search() filters by period", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "m1", period: "2026-06" } }));
  await repository.save(draft({ snapshot: { matchId: "m2", period: "2026-07" } }));
  const page = await service.search({ period: "2026-06" });
  assert.equal(page.total, 1);
});

test("search() combines multiple filters", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "m1", league: "Liga A", period: "2026-06" } }));
  await repository.save(draft({ snapshot: { matchId: "m2", league: "Liga A", period: "2026-07" } }));
  const page = await service.search({ league: "Liga A", period: "2026-06" });
  assert.equal(page.total, 1);
  assert.equal(page.items[0].matchId, "m1");
});

test("search() correctly separates filter fields from option fields before calling the repository", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  for (let i = 0; i < 3; i += 1) {
    await repository.save(draft({ snapshot: { matchId: `m${i}`, league: "Liga A" } }));
  }
  const page = await service.search({ league: "Liga A", limit: 2, offset: 1 });
  assert.equal(page.total, 3);
  assert.equal(page.items.length, 2);
  assert.equal(page.offset, 1);
  assert.equal(page.limit, 2);
});

test("search() returns effective limit/offset and hasNextPage/hasPreviousPage metadata", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  for (let i = 0; i < 5; i += 1) {
    await repository.save(
      draft({ snapshot: { matchId: `m${i}`, result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: `2026-07-2${i}T09:00:00.000Z` } } } }),
    );
  }
  const firstPage = await service.search({ limit: 2, offset: 0 });
  assert.equal(firstPage.hasPreviousPage, false);
  assert.equal(firstPage.hasNextPage, true);

  const lastPage = await service.search({ limit: 2, offset: 4 });
  assert.equal(lastPage.hasPreviousPage, true);
  assert.equal(lastPage.hasNextPage, false);
});

test("search() default order is generatedAt descending", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "older", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-01T09:00:00.000Z" } } } }));
  await repository.save(draft({ snapshot: { matchId: "newer", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-27T09:00:00.000Z" } } } }));
  const page = await service.search();
  assert.deepEqual(page.items.map((item) => item.matchId), ["newer", "older"]);
});

test("search() with orderDirection 'asc' reverses the default order", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "older", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-01T09:00:00.000Z" } } } }));
  await repository.save(draft({ snapshot: { matchId: "newer", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-27T09:00:00.000Z" } } } }));
  const page = await service.search({ orderDirection: "asc" });
  assert.deepEqual(page.items.map((item) => item.matchId), ["older", "newer"]);
});

test("search() with orderBy 'createdAt' is accepted and passed through to the repository", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft());
  await assert.doesNotReject(() => service.search({ orderBy: "createdAt" }));
});

test("search() rejects an unknown orderBy/orderDirection with PredictionQueryValidationError", async () => {
  const service = new PredictionQueryService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.search({ orderBy: "notARealField" }), (error) => {
    assert.ok(error instanceof PredictionQueryValidationError);
    assert.ok(error.invalidFields.includes("orderBy"));
    return true;
  });
  await assert.rejects(() => service.search({ orderDirection: "sideways" }), (error) => {
    assert.ok(error instanceof PredictionQueryValidationError);
    assert.ok(error.invalidFields.includes("orderDirection"));
    return true;
  });
});

test("search() rejects empty string filters (matchId/playerId/league/period)", async () => {
  const service = new PredictionQueryService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.search({ matchId: "" }), (e) => e.invalidFields.includes("matchId"));
  await assert.rejects(() => service.search({ playerId: "" }), (e) => e.invalidFields.includes("playerId"));
  await assert.rejects(() => service.search({ league: "" }), (e) => e.invalidFields.includes("league"));
  await assert.rejects(() => service.search({ period: "" }), (e) => e.invalidFields.includes("period"));
});

// ---------------------------------------------------------------------
// getByMatch()
// ---------------------------------------------------------------------

test("getByMatch() returns only the requested match", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "match-a" } }));
  await repository.save(draft({ snapshot: { matchId: "match-b" } }));
  const page = await service.getByMatch("match-a");
  assert.equal(page.total, 1);
  assert.equal(page.items[0].matchId, "match-a");
});

test("getByMatch() respects pagination options", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  for (let i = 0; i < 3; i += 1) {
    await repository.save(
      draft({ snapshot: { matchId: "match-a", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: `2026-07-2${i}T09:00:00.000Z` } } } }),
    );
  }
  const page = await service.getByMatch("match-a", { limit: 2 });
  assert.equal(page.total, 3);
  assert.equal(page.items.length, 2);
});

test("getByMatch() rejects an empty matchId", async () => {
  const service = new PredictionQueryService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.getByMatch(""), PredictionQueryValidationError);
});

// ---------------------------------------------------------------------
// getByPlayer()
// ---------------------------------------------------------------------

test("getByPlayer() finds the player as the home player", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "m1", homePlayerId: "alice" } }));
  const page = await service.getByPlayer("alice");
  assert.equal(page.total, 1);
});

test("getByPlayer() finds the player as the away player", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "m1", awayPlayerId: "carol" } }));
  const page = await service.getByPlayer("carol");
  assert.equal(page.total, 1);
});

test("getByPlayer() rejects an empty playerId", async () => {
  const service = new PredictionQueryService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.getByPlayer(""), PredictionQueryValidationError);
});

// ---------------------------------------------------------------------
// getLatestByMatch()
// ---------------------------------------------------------------------

test("getLatestByMatch() returns the prediction with the highest generatedAt, never the highest id", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  const olderButHigherId = await repository.save(
    draft({ snapshot: { matchId: "m1", homePlayerId: "zzz-higher-id-source", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-01T09:00:00.000Z" } } } }),
  );
  const newerButLowerId = await repository.save(
    draft({ snapshot: { matchId: "m1", homePlayerId: "aaa-lower-id-source", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-27T09:00:00.000Z" } } } }),
  );

  const latest = await service.getLatestByMatch("m1");
  assert.equal(latest.id, newerButLowerId.id);
  assert.notEqual(latest.id, olderButHigherId.id);
});

test("getLatestByMatch() returns null when no prediction exists for the match", async () => {
  const service = new PredictionQueryService(new InMemoryPredictionRepository());
  assert.equal(await service.getLatestByMatch("no-such-match"), null);
});

test("getLatestByMatch() returns a full PredictionDetail (with snapshot)", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft({ snapshot: { matchId: "m1" } }));
  const latest = await service.getLatestByMatch("m1");
  assert.ok(latest.snapshot);
  assert.equal(latest.snapshot.matchId, "m1");
});

test("getLatestByMatch() rejects an empty matchId", async () => {
  const service = new PredictionQueryService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.getLatestByMatch(""), PredictionQueryValidationError);
});

// ---------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------

test("PredictionSummary (inside search() results) never includes the full snapshot object", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  await repository.save(draft());
  const page = await service.search();
  assert.equal("snapshot" in page.items[0], false);
});

test("mapping preserves every scalar field correctly (source, generatedAt, greenScoreCategory, combinedStatus, and all identity fields)", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionQueryService(repository);
  const saved = await repository.save(draft({ source: "real" }));
  const detail = await service.getById(saved.id);

  assert.equal(detail.id, saved.id);
  assert.equal(detail.snapshotHash, saved.snapshotHash);
  assert.equal(detail.createdAt, saved.createdAt);
  assert.equal(detail.matchId, "match-1");
  assert.equal(detail.homePlayerId, "home-1");
  assert.equal(detail.awayPlayerId, "away-1");
  assert.equal(detail.virtualTeamHome, "Bologna Virtual");
  assert.equal(detail.virtualTeamAway, "Roma Virtual");
  assert.equal(detail.league, "eSoccer Battle - Liga A");
  assert.equal(detail.period, "2026-07");
  assert.equal(detail.sequenceKey, 1);
  assert.equal(detail.modelVersion, saved.modelVersion);
  assert.equal(detail.configurationHash, saved.configurationHash);
  assert.equal(detail.schemaVersion, "1.0");
  assert.equal(detail.source, "real");
  assert.equal(detail.generatedAt, "2026-07-28T09:00:00.000Z");
  assert.equal(detail.greenScoreCategory, "HIGH");
  assert.equal(detail.combinedStatus, "STRONG");
});

// ---------------------------------------------------------------------
// Erros — nunca engolidos/convertidos silenciosamente
// ---------------------------------------------------------------------

test("PredictionRepositoryUnavailableError from the repository is never swallowed by getById()", async () => {
  const repository = fakeRepository({
    getById: async () => {
      throw new PredictionRepositoryUnavailableError("getById");
    },
  });
  const service = new PredictionQueryService(repository);
  await assert.rejects(() => service.getById("some-id"), PredictionRepositoryUnavailableError);
});

test("PredictionRepositoryUnavailableError from the repository is never swallowed by search()", async () => {
  const repository = fakeRepository({
    search: async () => {
      throw new PredictionRepositoryUnavailableError("search");
    },
  });
  const service = new PredictionQueryService(repository);
  await assert.rejects(() => service.search(), PredictionRepositoryUnavailableError);
});

test("PredictionSerializationError from the repository is never converted into a generic error", async () => {
  const repository = fakeRepository({
    getById: async () => {
      throw new PredictionSerializationError("getById");
    },
  });
  const service = new PredictionQueryService(repository);
  await assert.rejects(() => service.getById("some-id"), PredictionSerializationError);
});

test("PredictionQueryValidationError carries invalidFields for every validation failure", async () => {
  const service = new PredictionQueryService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.getById(""), (error) => {
    assert.ok(Array.isArray(error.invalidFields));
    assert.deepEqual(error.invalidFields, ["id"]);
    return true;
  });
});
