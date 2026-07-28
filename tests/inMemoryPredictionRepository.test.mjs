import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryPredictionRepository } from "../src/repositories/prediction/InMemoryPredictionRepository.ts";
import { computePredictionSnapshotHash } from "../src/repositories/prediction/PredictionRepository.ts";
import { PredictionRepositoryValidationError } from "../src/repositories/prediction/predictionRepositoryErrors.ts";

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

test("health() reports available/memory", async () => {
  const repository = new InMemoryPredictionRepository();
  assert.deepEqual(await repository.health(), { status: "available", backend: "memory", detail: null });
});

test("save() returns a full PredictionRecord with id and createdAt populated", async () => {
  const repository = new InMemoryPredictionRepository();
  const record = await repository.save(draft());
  assert.equal(typeof record.id, "string");
  assert.ok(record.id.length > 0);
  assert.equal(typeof record.createdAt, "string");
  assert.ok(!Number.isNaN(Date.parse(record.createdAt)));
});

test("save() is idempotent: saving the same draft twice never duplicates and keeps the same id", async () => {
  const repository = new InMemoryPredictionRepository();
  const input = draft();
  const first = await repository.save(input);
  const second = await repository.save(input);
  assert.equal(first.id, second.id);
  const all = await repository.search({});
  assert.equal(all.total, 1);
});

test("the same snapshotHash always maps to the same id, even across separate save() calls", async () => {
  const repository = new InMemoryPredictionRepository();
  const input = draft();
  const first = await repository.save(input);
  const second = await repository.save({ ...input });
  assert.equal(first.id, second.id);
});

test("different snapshotHash values produce distinct records", async () => {
  const repository = new InMemoryPredictionRepository();
  const a = await repository.save(draft({ snapshot: { matchId: "match-a" } }));
  const b = await repository.save(draft({ snapshot: { matchId: "match-b" } }));
  assert.notEqual(a.id, b.id);
  const all = await repository.search({});
  assert.equal(all.total, 2);
});

test("getById() returns the saved record", async () => {
  const repository = new InMemoryPredictionRepository();
  const saved = await repository.save(draft());
  const found = await repository.getById(saved.id);
  assert.deepEqual(found, saved);
});

test("getById() returns null for a non-existent id", async () => {
  const repository = new InMemoryPredictionRepository();
  assert.equal(await repository.getById("does-not-exist"), null);
});

test("search() filters by matchId", async () => {
  const repository = new InMemoryPredictionRepository();
  await repository.save(draft({ snapshot: { matchId: "match-a" } }));
  await repository.save(draft({ snapshot: { matchId: "match-b" } }));
  const result = await repository.search({ matchId: "match-a" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].snapshot.matchId, "match-a");
});

test("search() filters by playerId matching the home player", async () => {
  const repository = new InMemoryPredictionRepository();
  await repository.save(draft({ snapshot: { matchId: "m1", homePlayerId: "alice" } }));
  await repository.save(draft({ snapshot: { matchId: "m2", homePlayerId: "bob" } }));
  const result = await repository.search({ playerId: "alice" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].snapshot.homePlayerId, "alice");
});

test("search() filters by playerId matching the away player", async () => {
  const repository = new InMemoryPredictionRepository();
  await repository.save(draft({ snapshot: { matchId: "m1", awayPlayerId: "carol" } }));
  await repository.save(draft({ snapshot: { matchId: "m2", awayPlayerId: "dave" } }));
  const result = await repository.search({ playerId: "carol" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].snapshot.awayPlayerId, "carol");
});

test("search() filters by league", async () => {
  const repository = new InMemoryPredictionRepository();
  await repository.save(draft({ snapshot: { matchId: "m1", league: "Liga A" } }));
  await repository.save(draft({ snapshot: { matchId: "m2", league: "Liga B" } }));
  const result = await repository.search({ league: "Liga A" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].snapshot.league, "Liga A");
});

test("search() filters by period", async () => {
  const repository = new InMemoryPredictionRepository();
  await repository.save(draft({ snapshot: { matchId: "m1", period: "2026-06" } }));
  await repository.save(draft({ snapshot: { matchId: "m2", period: "2026-07" } }));
  const result = await repository.search({ period: "2026-06" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].snapshot.period, "2026-06");
});

test("search() combines multiple filters with AND semantics", async () => {
  const repository = new InMemoryPredictionRepository();
  await repository.save(draft({ snapshot: { matchId: "m1", league: "Liga A", period: "2026-06" } }));
  await repository.save(draft({ snapshot: { matchId: "m2", league: "Liga A", period: "2026-07" } }));
  await repository.save(draft({ snapshot: { matchId: "m3", league: "Liga B", period: "2026-06" } }));
  const result = await repository.search({ league: "Liga A", period: "2026-06" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].snapshot.matchId, "m1");
});

test("search() paginates with limit/offset while total reflects every matching record before pagination", async () => {
  const repository = new InMemoryPredictionRepository();
  for (let i = 0; i < 5; i += 1) {
    await repository.save(
      draft({
        snapshot: {
          matchId: `m${i}`,
          result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: `2026-07-2${i}T09:00:00.000Z` } },
        },
      }),
    );
  }
  const page1 = await repository.search({}, { limit: 2, offset: 0 });
  const page2 = await repository.search({}, { limit: 2, offset: 2 });
  assert.equal(page1.total, 5);
  assert.equal(page2.total, 5);
  assert.equal(page1.items.length, 2);
  assert.equal(page2.items.length, 2);
});

test("search() orders by generatedAt descending by default", async () => {
  const repository = new InMemoryPredictionRepository();
  await repository.save(draft({ snapshot: { matchId: "older", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-01T09:00:00.000Z" } } } }));
  await repository.save(draft({ snapshot: { matchId: "newer", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-27T09:00:00.000Z" } } } }));
  const result = await repository.search({});
  assert.deepEqual(result.items.map((item) => item.snapshot.matchId), ["newer", "older"]);
});

test("search() with orderDirection 'asc' reverses the default generatedAt order", async () => {
  const repository = new InMemoryPredictionRepository();
  await repository.save(draft({ snapshot: { matchId: "older", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-01T09:00:00.000Z" } } } }));
  await repository.save(draft({ snapshot: { matchId: "newer", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-27T09:00:00.000Z" } } } }));
  const result = await repository.search({}, { orderDirection: "asc" });
  assert.deepEqual(result.items.map((item) => item.snapshot.matchId), ["older", "newer"]);
});

test("search() with orderBy 'createdAt': records saved later sort first in the default 'desc' direction (real save-order tie-break, generatedAt tied on purpose)", async () => {
  const repository = new InMemoryPredictionRepository();
  const tiedGeneratedAt = { generatedAt: "2026-07-28T09:00:00.000Z" };
  const first = await repository.save(draft({ snapshot: { matchId: "saved-first", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, ...tiedGeneratedAt } } } }));
  // Pequeno atraso real para garantir createdAt estritamente maior no
  // segundo save — o InMemoryPredictionRepository não aceita um relógio
  // injetável (fora do escopo estrutural desta sprint), então este único
  // teste depende de tempo real, deliberadamente isolado dos demais.
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await repository.save(draft({ snapshot: { matchId: "saved-second", result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, ...tiedGeneratedAt } } } }));

  assert.ok(second.createdAt > first.createdAt);
  const result = await repository.search({}, { orderBy: "createdAt" });
  assert.deepEqual(result.items.map((item) => item.snapshot.matchId), ["saved-second", "saved-first"]);
});

test("search() id is the final deterministic tie-break in both orderBy chains (unit-level: resolveSearchOrderChain always ends in 'id')", async () => {
  // A cobertura de integração de um empate genuíno em generatedAt E
  // createdAt exigiria um relógio injetável no InMemoryPredictionRepository
  // (fora do escopo estrutural desta sprint - ver relatório). A garantia
  // de que "id" está sempre presente como último critério de desempate,
  // para os dois valores de orderBy, já está coberta em
  // tests/predictionRepositoryContract.test.mjs (resolveSearchOrderChain).
  const repository = new InMemoryPredictionRepository();
  const record = await repository.save(draft());
  const result = await repository.search({});
  assert.equal(result.items[0].id, record.id);
});

test("save() rejects a structurally invalid draft with PredictionRepositoryValidationError", async () => {
  const repository = new InMemoryPredictionRepository();
  await assert.rejects(() => repository.save(draft({ snapshotHash: "" })), PredictionRepositoryValidationError);
});

test("two separate instances never share state", async () => {
  const repositoryA = new InMemoryPredictionRepository();
  const repositoryB = new InMemoryPredictionRepository();
  await repositoryA.save(draft());
  assert.equal((await repositoryA.search({})).total, 1);
  assert.equal((await repositoryB.search({})).total, 0);
});

test("mutating the record returned by save() never affects the internal storage", async () => {
  const repository = new InMemoryPredictionRepository();
  const record = await repository.save(draft());
  record.snapshot.matchId = "mutated";
  const found = await repository.getById(record.id);
  assert.equal(found.snapshot.matchId, "match-1");
});

test("mutating the draft after save() never affects the persisted record", async () => {
  const repository = new InMemoryPredictionRepository();
  const input = draft();
  const saved = await repository.save(input);
  input.snapshot.matchId = "mutated-after-save";
  const found = await repository.getById(saved.id);
  assert.equal(found.snapshot.matchId, "match-1");
});
