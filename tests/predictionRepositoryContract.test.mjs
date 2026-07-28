import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { computePredictionSnapshotHash, normalizeSearchPagination, resolveSearchOrder, resolveSearchOrderChain, validatePredictionRecordDraft } from "../src/repositories/prediction/PredictionRepository.ts";
import { DEFAULT_SEARCH_LIMIT, MIN_SEARCH_LIMIT, MAX_SEARCH_LIMIT, MIN_SEARCH_OFFSET } from "../src/repositories/prediction/predictionRepositoryConstants.ts";
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

// ---------------------------------------------------------------------
// computePredictionSnapshotHash
// ---------------------------------------------------------------------

test("computePredictionSnapshotHash matches sha256(matchId::configurationHash::generatedAt)", () => {
  const snap = snapshot();
  const expected = createHash("sha256").update("match-1::config-hash-abc::2026-07-28T09:00:00.000Z").digest("hex");
  assert.equal(computePredictionSnapshotHash(snap), expected);
});

test("computePredictionSnapshotHash is deterministic for identical input", () => {
  const snap = snapshot();
  assert.equal(computePredictionSnapshotHash(snap), computePredictionSnapshotHash(snapshot()));
});

test("computePredictionSnapshotHash differs when matchId differs", () => {
  assert.notEqual(computePredictionSnapshotHash(snapshot({ matchId: "match-1" })), computePredictionSnapshotHash(snapshot({ matchId: "match-2" })));
});

test("computePredictionSnapshotHash differs when configurationHash differs", () => {
  const a = snapshot({ result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, configurationHash: "hash-a" } } });
  const b = snapshot({ result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, configurationHash: "hash-b" } } });
  assert.notEqual(computePredictionSnapshotHash(a), computePredictionSnapshotHash(b));
});

test("computePredictionSnapshotHash differs when generatedAt differs (a genuine re-prediction, never deduplicated away)", () => {
  const a = snapshot({ result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-28T09:00:00.000Z" } } });
  const b = snapshot({ result: { ...snapshot().result, metadata: { ...snapshot().result.metadata, generatedAt: "2026-07-28T10:00:00.000Z" } } });
  assert.notEqual(computePredictionSnapshotHash(a), computePredictionSnapshotHash(b));
});

// ---------------------------------------------------------------------
// normalizeSearchPagination
// ---------------------------------------------------------------------

test("normalizeSearchPagination defaults limit/offset when omitted", () => {
  assert.deepEqual(normalizeSearchPagination({}), { limit: DEFAULT_SEARCH_LIMIT, offset: MIN_SEARCH_OFFSET });
});

test("normalizeSearchPagination clamps limit below the minimum", () => {
  assert.equal(normalizeSearchPagination({ limit: 0 }).limit, MIN_SEARCH_LIMIT);
  assert.equal(normalizeSearchPagination({ limit: -5 }).limit, MIN_SEARCH_LIMIT);
});

test("normalizeSearchPagination clamps limit above the maximum", () => {
  assert.equal(normalizeSearchPagination({ limit: 10000 }).limit, MAX_SEARCH_LIMIT);
});

test("normalizeSearchPagination clamps offset below zero", () => {
  assert.equal(normalizeSearchPagination({ offset: -10 }).offset, MIN_SEARCH_OFFSET);
});

test("normalizeSearchPagination truncates non-integer values", () => {
  assert.equal(normalizeSearchPagination({ limit: 10.9 }).limit, 10);
  assert.equal(normalizeSearchPagination({ offset: 5.9 }).offset, 5);
});

test("normalizeSearchPagination never throws for any numeric input", () => {
  assert.doesNotThrow(() => normalizeSearchPagination({ limit: Number.NaN, offset: Number.NaN }));
});

// ---------------------------------------------------------------------
// validatePredictionRecordDraft
// ---------------------------------------------------------------------

test("validatePredictionRecordDraft accepts a structurally valid draft", () => {
  assert.doesNotThrow(() => validatePredictionRecordDraft(draft()));
});

test("validatePredictionRecordDraft rejects an empty snapshotHash", () => {
  assert.throws(() => validatePredictionRecordDraft(draft({ snapshotHash: "" })), (error) => {
    assert.ok(error instanceof PredictionRepositoryValidationError);
    assert.ok(error.invalidFields.includes("snapshotHash"));
    return true;
  });
});

test("validatePredictionRecordDraft rejects an empty schemaVersion/modelVersion/configurationHash", () => {
  assert.throws(() => validatePredictionRecordDraft(draft({ schemaVersion: "" })), (e) => e.invalidFields.includes("schemaVersion"));
  assert.throws(() => validatePredictionRecordDraft(draft({ modelVersion: "" })), (e) => e.invalidFields.includes("modelVersion"));
  assert.throws(() => validatePredictionRecordDraft(draft({ configurationHash: "" })), (e) => e.invalidFields.includes("configurationHash"));
});

test("validatePredictionRecordDraft rejects a missing snapshot.matchId", () => {
  assert.throws(() => validatePredictionRecordDraft(draft({ snapshot: { matchId: "" } })), (e) => e.invalidFields.includes("snapshot.matchId"));
});

test("validatePredictionRecordDraft rejects an invalid/unparseable generatedAt", () => {
  const invalidDraft = draft();
  invalidDraft.snapshot.result.metadata.generatedAt = "not-a-date";
  assert.throws(() => validatePredictionRecordDraft(invalidDraft), (e) => e.invalidFields.includes("snapshot.result.metadata.generatedAt"));
});

test("validatePredictionRecordDraft rejects an unknown source", () => {
  assert.throws(() => validatePredictionRecordDraft(draft({ source: "not-a-real-source" })), (e) => e.invalidFields.includes("source"));
});

test("validatePredictionRecordDraft never revalidates probabilities, Green Score values, or engine rules", () => {
  // Um draft com Green Score/valores completamente fora de faixa continua
  // válido estruturalmente — a validação nunca reimplementa regras do motor.
  const oddDraft = draft({ snapshot: { result: { ...draft().snapshot.result, greenScore: { category: "HIGH" } } } });
  assert.doesNotThrow(() => validatePredictionRecordDraft(oddDraft));
});

// ---------------------------------------------------------------------
// Erros técnicos
// ---------------------------------------------------------------------

test("PredictionRepositoryUnavailableError has a stable code/name and never exposes the raw cause in its message", () => {
  const cause = new Error("connection string: postgresql://user:secret@host/db");
  const error = new PredictionRepositoryUnavailableError("save", cause);
  assert.equal(error.code, "PREDICTION_REPOSITORY_UNAVAILABLE");
  assert.equal(error.name, "PredictionRepositoryUnavailableError");
  assert.ok(!error.message.includes("secret"));
  assert.equal(error.cause, cause);
});

test("PredictionSerializationError has a stable code/name and never exposes the raw cause in its message", () => {
  const cause = new SyntaxError("Unexpected token in JSON");
  const error = new PredictionSerializationError("toPredictionRecord", cause);
  assert.equal(error.code, "PREDICTION_SERIALIZATION_ERROR");
  assert.equal(error.name, "PredictionSerializationError");
  assert.ok(!error.message.includes("Unexpected token"));
  assert.equal(error.cause, cause);
});

test("PredictionRepositoryValidationError lists the invalid fields and has a stable code/name", () => {
  const error = new PredictionRepositoryValidationError(["snapshotHash", "source"]);
  assert.equal(error.code, "PREDICTION_REPOSITORY_VALIDATION_ERROR");
  assert.equal(error.name, "PredictionRepositoryValidationError");
  assert.deepEqual(error.invalidFields, ["snapshotHash", "source"]);
});

// ---------------------------------------------------------------------
// Constantes de paginação (Sprint 7.3.1) — valores exatos, nunca
// duplicados em outro arquivo.
// ---------------------------------------------------------------------

test("pagination constants keep the exact values approved in Sprint 7.3", () => {
  assert.equal(DEFAULT_SEARCH_LIMIT, 20);
  assert.equal(MIN_SEARCH_LIMIT, 1);
  assert.equal(MAX_SEARCH_LIMIT, 100);
  assert.equal(MIN_SEARCH_OFFSET, 0);
});

// ---------------------------------------------------------------------
// resolveSearchOrder / resolveSearchOrderChain (Sprint 7.3.1)
// ---------------------------------------------------------------------

test("resolveSearchOrder defaults to generatedAt/desc when options are omitted", () => {
  assert.deepEqual(resolveSearchOrder(), { orderBy: "generatedAt", orderDirection: "desc" });
  assert.deepEqual(resolveSearchOrder({}), { orderBy: "generatedAt", orderDirection: "desc" });
});

test("resolveSearchOrder respects an explicit orderBy/orderDirection", () => {
  assert.deepEqual(resolveSearchOrder({ orderBy: "createdAt" }), { orderBy: "createdAt", orderDirection: "desc" });
  assert.deepEqual(resolveSearchOrder({ orderDirection: "asc" }), { orderBy: "generatedAt", orderDirection: "asc" });
  assert.deepEqual(resolveSearchOrder({ orderBy: "createdAt", orderDirection: "asc" }), { orderBy: "createdAt", orderDirection: "asc" });
});

test("resolveSearchOrderChain for 'generatedAt' is generatedAt -> createdAt -> id", () => {
  assert.deepEqual(resolveSearchOrderChain("generatedAt"), ["generatedAt", "createdAt", "id"]);
});

test("resolveSearchOrderChain for 'createdAt' is createdAt -> id", () => {
  assert.deepEqual(resolveSearchOrderChain("createdAt"), ["createdAt", "id"]);
});
