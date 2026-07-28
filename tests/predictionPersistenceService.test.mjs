import test from "node:test";
import assert from "node:assert/strict";
import { PredictionPersistenceService } from "../src/services/prediction-persistence/PredictionPersistenceService.ts";
import { PredictionPersistenceValidationError, PredictionSnapshotHashMismatchError } from "../src/services/prediction-persistence/predictionPersistenceErrors.ts";
import { InMemoryPredictionRepository } from "../src/repositories/prediction/InMemoryPredictionRepository.ts";
import { computePredictionSnapshotHash } from "../src/repositories/prediction/PredictionRepository.ts";
import { PredictionRepositoryUnavailableError, PredictionRepositoryValidationError, PredictionSerializationError } from "../src/repositories/prediction/predictionRepositoryErrors.ts";

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

function persistenceInput(overrides = {}) {
  const { snapshot: snapshotOverrides, ...rest } = overrides;
  return {
    snapshot: snapshot(snapshotOverrides),
    schemaVersion: "1.0",
    modelVersion: "esoccer-prediction-orchestrator-v1.0.0-provisional",
    configurationHash: "config-hash-abc",
    source: "fixture",
    ...rest,
  };
}

function fakeRepository(overrides = {}) {
  return {
    health: async () => ({ status: "available", backend: "memory", detail: null }),
    save: async (draft) => ({ ...draft, id: "fake-id", createdAt: "2026-07-28T09:05:00.000Z" }),
    getById: async () => null,
    search: async () => ({ items: [], total: 0 }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// Auditoria do contrato: construtor, chamadas ao Repository
// ---------------------------------------------------------------------

test("the service receives PredictionRepository via constructor", () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  assert.ok(service instanceof PredictionPersistenceService);
});

test("persist() calls repository.save() exactly once", async () => {
  let saveCalls = 0;
  const repository = fakeRepository({
    save: async (draft) => {
      saveCalls += 1;
      return { ...draft, id: "fake-id", createdAt: "2026-07-28T09:05:00.000Z" };
    },
  });
  const service = new PredictionPersistenceService(repository);
  await service.persist(persistenceInput());
  assert.equal(saveCalls, 1);
});

test("health() calls repository.health() exactly once and touches nothing else", async () => {
  let healthCalls = 0;
  let otherCalls = 0;
  const repository = fakeRepository({
    health: async () => {
      healthCalls += 1;
      return { status: "available", backend: "memory", detail: null };
    },
    getById: async () => {
      otherCalls += 1;
      return null;
    },
    search: async () => {
      otherCalls += 1;
      return { items: [], total: 0 };
    },
  });
  const service = new PredictionPersistenceService(repository);
  await service.health();
  assert.equal(healthCalls, 1);
  assert.equal(otherCalls, 0);
});

// ---------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------

test("persist() accepts a fully valid input", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  await assert.doesNotReject(() => service.persist(persistenceInput()));
});

test("persist() rejects a missing snapshot", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  const input = persistenceInput();
  delete input.snapshot;
  await assert.rejects(() => service.persist(input), (e) => e instanceof PredictionPersistenceValidationError && e.invalidFields.includes("snapshot"));
});

test("persist() rejects a null snapshot", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  const input = persistenceInput();
  input.snapshot = null;
  await assert.rejects(() => service.persist(input), (e) => e.invalidFields.includes("snapshot"));
});

test("persist() rejects an empty schemaVersion", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.persist(persistenceInput({ schemaVersion: "" })), (e) => e.invalidFields.includes("schemaVersion"));
});

test("persist() rejects an empty modelVersion", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.persist(persistenceInput({ modelVersion: "" })), (e) => e.invalidFields.includes("modelVersion"));
});

test("persist() rejects an empty configurationHash", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.persist(persistenceInput({ configurationHash: "" })), (e) => e.invalidFields.includes("configurationHash"));
});

test("persist() rejects an invalid source", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.persist(persistenceInput({ source: "made-up" })), (e) => e.invalidFields.includes("source"));
});

test("persist() rejects a malformed snapshotHash (not 64-char hex)", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.persist(persistenceInput({ snapshotHash: "not-a-real-hash" })), (e) => e.invalidFields.includes("snapshotHash"));
});

test("persist() accepts a correctly-formatted and correctly-matching snapshotHash", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  const input = persistenceInput();
  const correctHash = computePredictionSnapshotHash(input.snapshot);
  await assert.doesNotReject(() => service.persist({ ...input, snapshotHash: correctHash }));
});

test("persist() rejects a well-formatted but divergent snapshotHash", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  const input = persistenceInput();
  const wrongButValidFormatHash = "a".repeat(64);
  await assert.rejects(() => service.persist({ ...input, snapshotHash: wrongButValidFormatHash }), PredictionSnapshotHashMismatchError);
});

test("PredictionPersistenceValidationError.invalidFields lists every invalid field at once", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  await assert.rejects(() => service.persist(persistenceInput({ schemaVersion: "", modelVersion: "", source: "bogus" })), (error) => {
    assert.deepEqual(error.invalidFields, ["schemaVersion", "modelVersion", "source"]);
    return true;
  });
});

// ---------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------

test("persist() trims external whitespace from schemaVersion/modelVersion/configurationHash", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionPersistenceService(repository);
  const result = await service.persist(persistenceInput({ schemaVersion: "  1.0  ", modelVersion: "  model-v1  ", configurationHash: "  config-hash-abc  " }));
  assert.equal(result.schemaVersion, "1.0");
  assert.equal(result.modelVersion, "model-v1");
  assert.equal(result.configurationHash, "config-hash-abc");
});

test("persist() never alters capitalization of metadata strings", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  const result = await service.persist(persistenceInput({ modelVersion: "  Model-V1-MixedCase  " }));
  assert.equal(result.modelVersion, "Model-V1-MixedCase");
});

// ---------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------

test("persist() computes the hash via computePredictionSnapshotHash when snapshotHash is omitted", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  const input = persistenceInput();
  const result = await service.persist(input);
  assert.equal(result.snapshotHash, computePredictionSnapshotHash(input.snapshot));
});

test("persist() is deterministic: the same input always produces the same hash", async () => {
  const inputA = persistenceInput();
  const inputB = persistenceInput();
  assert.equal(computePredictionSnapshotHash(inputA.snapshot), computePredictionSnapshotHash(inputB.snapshot));
});

test("persist() produces different hashes for different snapshot content", async () => {
  const hashA = computePredictionSnapshotHash(persistenceInput({ snapshot: { matchId: "match-a" } }).snapshot);
  const hashB = computePredictionSnapshotHash(persistenceInput({ snapshot: { matchId: "match-b" } }).snapshot);
  assert.notEqual(hashA, hashB);
});

// ---------------------------------------------------------------------
// Persistência: draft correto, save() único, mapping do resultado
// ---------------------------------------------------------------------

test("persist() builds a draft without id/createdAt/snapshotPayload and calls save() with it", async () => {
  let capturedDraft = null;
  const repository = fakeRepository({
    save: async (draft) => {
      capturedDraft = draft;
      return { ...draft, id: "fake-id", createdAt: "2026-07-28T09:05:00.000Z" };
    },
  });
  const service = new PredictionPersistenceService(repository);
  const input = persistenceInput();
  await service.persist(input);

  assert.equal("id" in capturedDraft, false);
  assert.equal("createdAt" in capturedDraft, false);
  assert.equal("snapshotPayload" in capturedDraft, false);
  assert.equal(capturedDraft.schemaVersion, "1.0");
  assert.equal(capturedDraft.modelVersion, input.modelVersion);
  assert.equal(capturedDraft.configurationHash, input.configurationHash);
  assert.equal(capturedDraft.source, "fixture");
  assert.equal(capturedDraft.snapshotHash, computePredictionSnapshotHash(input.snapshot));
  assert.deepEqual(capturedDraft.snapshot, input.snapshot);
});

test("persist() returns id, createdAt, metadata, source, and the full snapshot, never recalculating any field", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  const input = persistenceInput();
  const result = await service.persist(input);

  assert.equal(typeof result.id, "string");
  assert.ok(result.id.length > 0);
  assert.equal(typeof result.createdAt, "string");
  assert.equal(result.schemaVersion, "1.0");
  assert.equal(result.modelVersion, input.modelVersion);
  assert.equal(result.configurationHash, input.configurationHash);
  assert.equal(result.source, "fixture");
  assert.deepEqual(result.snapshot, input.snapshot);
});

// ---------------------------------------------------------------------
// Idempotência
// ---------------------------------------------------------------------

test("persist() called twice with the same input (no snapshotHash) returns the same id and never duplicates", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionPersistenceService(repository);
  const input = persistenceInput();
  const first = await service.persist(input);
  const second = await service.persist(persistenceInput());
  assert.equal(first.id, second.id);
  assert.equal((await repository.search({})).total, 1);
});

test("persist() with the correct explicit snapshotHash preserves idempotency", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionPersistenceService(repository);
  const input = persistenceInput();
  const hash = computePredictionSnapshotHash(input.snapshot);
  const first = await service.persist(input);
  const second = await service.persist({ ...persistenceInput(), snapshotHash: hash });
  assert.equal(first.id, second.id);
  assert.equal((await repository.search({})).total, 1);
});

test("persist() with genuinely different snapshot content creates a distinct record", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionPersistenceService(repository);
  const a = await service.persist(persistenceInput({ snapshot: { matchId: "match-a" } }));
  const b = await service.persist(persistenceInput({ snapshot: { matchId: "match-b" } }));
  assert.notEqual(a.id, b.id);
  assert.equal((await repository.search({})).total, 2);
});

// ---------------------------------------------------------------------
// Imutabilidade / cópias defensivas
// ---------------------------------------------------------------------

test("persist() never mutates the input it receives", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  const input = persistenceInput();
  const snapshotCopy = JSON.parse(JSON.stringify(input.snapshot));
  await service.persist(input);
  assert.deepEqual(input.snapshot, snapshotCopy);
});

test("mutating the input snapshot after persist() never affects the stored record", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionPersistenceService(repository);
  const input = persistenceInput();
  const result = await service.persist(input);
  input.snapshot.matchId = "mutated-after-persist";
  const stored = await repository.getById(result.id);
  assert.equal(stored.snapshot.matchId, "match-1");
});

test("mutating the returned result's snapshot never affects a later read from the repository", async () => {
  const repository = new InMemoryPredictionRepository();
  const service = new PredictionPersistenceService(repository);
  const result = await service.persist(persistenceInput());
  result.snapshot.matchId = "mutated-result";
  const stored = await repository.getById(result.id);
  assert.equal(stored.snapshot.matchId, "match-1");
});

test("the returned snapshot is a defensive copy, never the same reference as the input", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  const input = persistenceInput();
  const result = await service.persist(input);
  assert.notEqual(result.snapshot, input.snapshot);
});

// ---------------------------------------------------------------------
// Erros — nunca engolidos/convertidos
// ---------------------------------------------------------------------

test("PredictionRepositoryUnavailableError from the repository propagates intact", async () => {
  const repository = fakeRepository({
    save: async () => {
      throw new PredictionRepositoryUnavailableError("save");
    },
  });
  const service = new PredictionPersistenceService(repository);
  await assert.rejects(() => service.persist(persistenceInput()), PredictionRepositoryUnavailableError);
});

test("PredictionSerializationError from the repository propagates intact", async () => {
  const repository = fakeRepository({
    save: async () => {
      throw new PredictionSerializationError("save");
    },
  });
  const service = new PredictionPersistenceService(repository);
  await assert.rejects(() => service.persist(persistenceInput()), PredictionSerializationError);
});

test("PredictionRepositoryValidationError from the real InMemoryPredictionRepository propagates intact (structural check the service doesn't itself perform)", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  // O serviço só checa que `snapshot` é um objeto não nulo — nunca
  // `snapshot.matchId` — então um matchId vazio passa pela validação do
  // serviço e é pego pela segunda linha de defesa do Repository.
  await assert.rejects(() => service.persist(persistenceInput({ snapshot: { matchId: "" } })), PredictionRepositoryValidationError);
});

// ---------------------------------------------------------------------
// health()
// ---------------------------------------------------------------------

test("health() reports available/memory via a real InMemoryPredictionRepository", async () => {
  const service = new PredictionPersistenceService(new InMemoryPredictionRepository());
  assert.deepEqual(await service.health(), { status: "available", backend: "memory", detail: null });
});

test("health() propagates an unavailable status without throwing", async () => {
  const repository = fakeRepository({ health: async () => ({ status: "unavailable", backend: "prisma", detail: "db down" }) });
  const service = new PredictionPersistenceService(repository);
  assert.deepEqual(await service.health(), { status: "unavailable", backend: "prisma", detail: "db down" });
});
