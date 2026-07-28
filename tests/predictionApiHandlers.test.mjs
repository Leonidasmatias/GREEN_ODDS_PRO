import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  handleGeneratePrediction,
  handleGetLatestPredictionByMatch,
  handleGetPredictionById,
  handleGetPredictionHistoryByMatch,
  handleListPredictions,
  mapErrorToResult,
} from "../src/services/predictionApiHandlers.ts";
import { getPersistedPredictions } from "../src/services/predictionCenterService.ts";
import { PredictionQueryValidationError } from "../src/services/prediction-query/predictionQueryErrors.ts";
import { PredictionPersistenceValidationError, PredictionSnapshotHashMismatchError } from "../src/services/prediction-persistence/predictionPersistenceErrors.ts";
import { PredictionRepositoryUnavailableError, PredictionRepositoryValidationError, PredictionSerializationError } from "../src/repositories/prediction/predictionRepositoryErrors.ts";

function generateBody(overrides = {}) {
  return {
    matchId: "api-generate-1",
    homePlayerId: "api-home-1",
    awayPlayerId: "api-away-1",
    homeRating: 1700,
    awayRating: 1400,
    virtualTeamHome: "API Home",
    virtualTeamAway: "API Away",
    league: "API League",
    period: "2026-08",
    sequenceKey: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// Arquitetura
// ---------------------------------------------------------------------

test("architecture: predictionApiHandlers.ts never imports next/server, Repository, Prisma, or the mapper directly", () => {
  const source = readFileSync(fileURLToPath(new URL("../src/services/predictionApiHandlers.ts", import.meta.url)), "utf8");
  const code = source.split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
  const forbidden = ["next/server", "PrismaClient", "@prisma/client", "InMemoryPredictionRepository", "PrismaPredictionRepository", "PredictionSnapshotMapper", "lib/prisma"];
  for (const term of forbidden) {
    assert.ok(!code.includes(term), `predictionApiHandlers.ts must not reference "${term}"`);
  }
});

test("architecture: none of the GET handlers ever change the stored total (zero write)", async () => {
  const before = await getPersistedPredictions({});
  await handleListPredictions(new URLSearchParams());
  await handleGetPredictionById("does-not-exist");
  await handleGetPredictionHistoryByMatch("no-such-match", new URLSearchParams());
  await handleGetLatestPredictionByMatch("no-such-match");
  const after = await getPersistedPredictions({});
  assert.equal(after.total, before.total);
});

// ---------------------------------------------------------------------
// GET lista (handleListPredictions)
// ---------------------------------------------------------------------

test("handleListPredictions with no filters returns 200 and a PredictionQueryPage shape", async () => {
  const result = await handleListPredictions(new URLSearchParams());
  assert.equal(result.status, 200);
  assert.ok("items" in result.body);
  assert.ok("total" in result.body);
  assert.ok("limit" in result.body);
  assert.ok("offset" in result.body);
  assert.ok("hasNextPage" in result.body);
  assert.ok("hasPreviousPage" in result.body);
});

test("handleListPredictions filters by matchId/playerId/league/period and combinations", async () => {
  await handleGeneratePrediction(generateBody({ matchId: "api-filter-1", league: "API Filter League", period: "2026-09" }));

  const byMatch = await handleListPredictions(new URLSearchParams({ matchId: "api-filter-1" }));
  assert.ok(byMatch.body.items.some((item) => item.matchId === "api-filter-1"));

  const byPlayer = await handleListPredictions(new URLSearchParams({ playerId: "api-home-1" }));
  assert.ok(byPlayer.body.total >= 1);

  const byLeague = await handleListPredictions(new URLSearchParams({ league: "API Filter League" }));
  assert.ok(byLeague.body.items.every((item) => item.league === "API Filter League"));

  const byPeriod = await handleListPredictions(new URLSearchParams({ period: "2026-09" }));
  assert.ok(byPeriod.body.items.every((item) => item.period === "2026-09"));

  const combined = await handleListPredictions(new URLSearchParams({ league: "API Filter League", period: "2026-09" }));
  assert.ok(combined.body.items.some((item) => item.matchId === "api-filter-1"));
});

test("handleListPredictions respects limit/offset and preserves ordering options", async () => {
  const page = await handleListPredictions(new URLSearchParams({ limit: "2", offset: "0" }));
  assert.equal(page.body.limit, 2);
  assert.equal(page.body.offset, 0);

  const ascending = await handleListPredictions(new URLSearchParams({ orderBy: "createdAt", orderDirection: "asc" }));
  assert.equal(ascending.status, 200);
});

test("handleListPredictions rejects an unparseable limit/offset with 400", async () => {
  const badLimit = await handleListPredictions(new URLSearchParams({ limit: "not-a-number" }));
  assert.equal(badLimit.status, 400);
  assert.ok(badLimit.body.fields.includes("limit"));

  const badOffset = await handleListPredictions(new URLSearchParams({ offset: "not-a-number" }));
  assert.equal(badOffset.status, 400);
  assert.ok(badOffset.body.fields.includes("offset"));
});

test("handleListPredictions rejects an unknown orderBy/orderDirection with 400", async () => {
  const badOrderBy = await handleListPredictions(new URLSearchParams({ orderBy: "bogus" }));
  assert.equal(badOrderBy.status, 400);
  assert.ok(badOrderBy.body.fields.includes("orderBy"));

  const badOrderDirection = await handleListPredictions(new URLSearchParams({ orderDirection: "sideways" }));
  assert.equal(badOrderDirection.status, 400);
  assert.ok(badOrderDirection.body.fields.includes("orderDirection"));
});

test("handleListPredictions propagates a real Query Service validation error (empty matchId) as 400 — HTTP layer never duplicates this check", async () => {
  const result = await handleListPredictions(new URLSearchParams({ matchId: "" }));
  assert.equal(result.status, 400);
  assert.ok(result.body.fields.includes("matchId"));
});

// ---------------------------------------------------------------------
// GET detalhe (handleGetPredictionById)
// ---------------------------------------------------------------------

test("handleGetPredictionById returns 200 with the full detail for an existing id", async () => {
  const generated = await handleGeneratePrediction(generateBody({ matchId: "api-detail-1" }));
  const result = await handleGetPredictionById(generated.body.id);
  assert.equal(result.status, 200);
  assert.equal(result.body.id, generated.body.id);
  assert.ok(result.body.snapshot);
});

test("handleGetPredictionById returns 404 for a non-existent id", async () => {
  const result = await handleGetPredictionById("does-not-exist-at-all");
  assert.equal(result.status, 404);
});

test("handleGetPredictionById returns 400 for an empty id", async () => {
  const result = await handleGetPredictionById("");
  assert.equal(result.status, 400);
});

test("handleGetPredictionById returns 404 (not a crash) for a well-formed but meaningless id", async () => {
  const result = await handleGetPredictionById("   ");
  assert.equal(result.status, 404);
});

// ---------------------------------------------------------------------
// GET histórico (handleGetPredictionHistoryByMatch)
// ---------------------------------------------------------------------

test("handleGetPredictionHistoryByMatch returns results for a match with persisted predictions", async () => {
  await handleGeneratePrediction(generateBody({ matchId: "api-history-1" }));
  const result = await handleGetPredictionHistoryByMatch("api-history-1", new URLSearchParams());
  assert.equal(result.status, 200);
  assert.ok(result.body.total >= 1);
});

test("handleGetPredictionHistoryByMatch returns an empty page for a match with no predictions", async () => {
  const result = await handleGetPredictionHistoryByMatch("api-history-empty", new URLSearchParams());
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 0);
  assert.deepEqual(result.body.items, []);
});

test("handleGetPredictionHistoryByMatch respects pagination/ordering options", async () => {
  const result = await handleGetPredictionHistoryByMatch("api-history-1", new URLSearchParams({ limit: "1", orderBy: "generatedAt", orderDirection: "desc" }));
  assert.equal(result.status, 200);
  assert.equal(result.body.limit, 1);
});

test("handleGetPredictionHistoryByMatch returns 400 for an empty matchId", async () => {
  const result = await handleGetPredictionHistoryByMatch("", new URLSearchParams());
  assert.equal(result.status, 400);
});

// ---------------------------------------------------------------------
// GET latest (handleGetLatestPredictionByMatch)
// ---------------------------------------------------------------------

test("handleGetLatestPredictionByMatch returns 200 with the detail for an existing match", async () => {
  await handleGeneratePrediction(generateBody({ matchId: "api-latest-1" }));
  const result = await handleGetLatestPredictionByMatch("api-latest-1");
  assert.equal(result.status, 200);
  assert.equal(result.body.matchId, "api-latest-1");
});

test("handleGetLatestPredictionByMatch returns 404 for a match with no predictions", async () => {
  const result = await handleGetLatestPredictionByMatch("api-latest-none");
  assert.equal(result.status, 404);
});

test("handleGetLatestPredictionByMatch returns 400 for an empty matchId", async () => {
  const result = await handleGetLatestPredictionByMatch("");
  assert.equal(result.status, 400);
});

// ---------------------------------------------------------------------
// POST (handleGeneratePrediction)
// ---------------------------------------------------------------------

test("handleGeneratePrediction with valid input generates via the real engine, persists, and returns 200", async () => {
  const result = await handleGeneratePrediction(generateBody({ matchId: "api-post-valid" }));
  assert.equal(result.status, 200);
  assert.equal(result.body.snapshot.matchId, "api-post-valid");
  assert.equal(result.body.source, "fixture");
  assert.ok(result.body.snapshot.result.metadata.orchestratorModelVersion);
});

test("handleGeneratePrediction rejects a missing/non-object body with 400", async () => {
  assert.equal((await handleGeneratePrediction(undefined)).status, 400);
  assert.equal((await handleGeneratePrediction(null)).status, 400);
  assert.equal((await handleGeneratePrediction("just a string")).status, 400);
});

test("handleGeneratePrediction rejects a body missing required fields with 400 and lists them", async () => {
  const result = await handleGeneratePrediction({ matchId: "api-post-incomplete" });
  assert.equal(result.status, 400);
  assert.ok(result.body.fields.includes("homePlayerId"));
  assert.ok(result.body.fields.includes("awayPlayerId"));
  assert.ok(result.body.fields.includes("homeRating"));
  assert.ok(result.body.fields.includes("awayRating"));
});

test("handleGeneratePrediction rejects wrong-typed fields (e.g. homeRating as a string) with 400", async () => {
  const result = await handleGeneratePrediction(generateBody({ homeRating: "1700" }));
  assert.equal(result.status, 400);
  assert.ok(result.body.fields.includes("homeRating"));
});

for (const forbiddenField of ["snapshot", "snapshotHash", "snapshotPayload", "schemaVersion", "modelVersion", "configurationHash", "source"]) {
  test(`handleGeneratePrediction rejects a body containing the internal field "${forbiddenField}" with 400`, async () => {
    const result = await handleGeneratePrediction(generateBody({ [forbiddenField]: "client-supplied-value" }));
    assert.equal(result.status, 400);
    assert.ok(result.body.fields.includes(forbiddenField));
  });
}

test("handleGeneratePrediction persists exactly once per call (verified via history growth) and returns HTTP 200, never 201", async () => {
  const before = await handleGetPredictionHistoryByMatch("api-post-single-write", new URLSearchParams());
  assert.equal(before.body.total, 0);
  const result = await handleGeneratePrediction(generateBody({ matchId: "api-post-single-write" }));
  assert.equal(result.status, 200);
  const after = await handleGetPredictionHistoryByMatch("api-post-single-write", new URLSearchParams());
  assert.equal(after.body.total, 1);
});

test("handleGeneratePrediction never performs an extra query (search/getById) to distinguish creation from reuse — persist() alone decides the response", async () => {
  // Estrutural: `generateAndPersistPredictionCenterData` (chamada por
  // este handler) nunca invoca `getPersistedPredictions`/
  // `getPersistedPredictionById` — já confirmado por leitura de
  // `predictionCenterService.ts` e coberto por testes dedicados de
  // `PredictionPersistenceService` (Sprint 7.5).
  const source = readFileSync(fileURLToPath(new URL("../src/services/predictionCenterService.ts", import.meta.url)), "utf8");
  const generateFunctionBody = source.slice(source.indexOf("export async function generateAndPersistPredictionCenterData"));
  assert.ok(!generateFunctionBody.includes(".search("));
  assert.ok(!generateFunctionBody.includes(".getById("));
});

// ---------------------------------------------------------------------
// Separação leitura/escrita
// ---------------------------------------------------------------------

test("a valid POST increases the stored total, while repeated GETs never do", async () => {
  const before = await getPersistedPredictions({});
  await handleListPredictions(new URLSearchParams());
  await handleListPredictions(new URLSearchParams());
  const afterReads = await getPersistedPredictions({});
  assert.equal(afterReads.total, before.total);

  await handleGeneratePrediction(generateBody({ matchId: "api-separation-write" }));
  const afterWrite = await getPersistedPredictions({});
  assert.equal(afterWrite.total, before.total + 1);
});

// ---------------------------------------------------------------------
// Erros — mapErrorToResult (formato estável, status HTTP, sem dados sensíveis)
// ---------------------------------------------------------------------

test("mapErrorToResult maps PredictionQueryValidationError to 400 with fields", () => {
  const result = mapErrorToResult(new PredictionQueryValidationError(["matchId"]));
  assert.equal(result.status, 400);
  assert.deepEqual(result.body.fields, ["matchId"]);
});

test("mapErrorToResult maps PredictionPersistenceValidationError to 400 with fields", () => {
  const result = mapErrorToResult(new PredictionPersistenceValidationError(["schemaVersion"]));
  assert.equal(result.status, 400);
  assert.deepEqual(result.body.fields, ["schemaVersion"]);
});

test("mapErrorToResult maps PredictionRepositoryValidationError to 400 with fields", () => {
  const result = mapErrorToResult(new PredictionRepositoryValidationError(["snapshot.matchId"]));
  assert.equal(result.status, 400);
  assert.deepEqual(result.body.fields, ["snapshot.matchId"]);
});

test("mapErrorToResult maps PredictionSnapshotHashMismatchError to 409", () => {
  const result = mapErrorToResult(new PredictionSnapshotHashMismatchError());
  assert.equal(result.status, 409);
});

test("mapErrorToResult maps PredictionRepositoryUnavailableError to 503 with a generic message (never the raw cause)", () => {
  const cause = new Error("connection string: postgresql://user:secret@host/db");
  const result = mapErrorToResult(new PredictionRepositoryUnavailableError("search", cause));
  assert.equal(result.status, 503);
  assert.ok(!result.body.error.includes("secret"));
});

test("mapErrorToResult maps PredictionSerializationError to 500 with a generic message", () => {
  const result = mapErrorToResult(new PredictionSerializationError("mapRowToPredictionRecord"));
  assert.equal(result.status, 500);
});

test("mapErrorToResult maps an unrecognized error to 500 with a generic message, never exposing the raw error", () => {
  const result = mapErrorToResult(new Error("some internal detail that must never leak"));
  assert.equal(result.status, 500);
  assert.ok(!result.body.error.includes("internal detail"));
});

test("no mapErrorToResult response ever contains a stack trace, cause, or snapshotPayload field", () => {
  const allErrors = [
    new PredictionQueryValidationError(["x"]),
    new PredictionPersistenceValidationError(["x"]),
    new PredictionRepositoryValidationError(["x"]),
    new PredictionSnapshotHashMismatchError(),
    new PredictionRepositoryUnavailableError("op", new Error("secret cause")),
    new PredictionSerializationError("op", new Error("secret cause")),
    new Error("unexpected"),
  ];
  for (const error of allErrors) {
    const result = mapErrorToResult(error);
    const serialized = JSON.stringify(result.body);
    assert.ok(!serialized.includes("stack"));
    assert.ok(!serialized.includes("secret cause"));
    assert.ok(!serialized.includes("snapshotPayload"));
  }
});
