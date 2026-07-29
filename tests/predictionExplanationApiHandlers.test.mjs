// Sprint 9.0 — Prediction Intelligence Framework, Etapa 6/8.
// Testa o handler puro da rota `GET /api/predictions/[id]/explanation`
// contra o composition root real (InMemoryPredictionRepository,
// processo de teste) — mesmo padrão de `predictionApiHandlers.test.mjs`
// (Sprint 8.1): usa `handleGeneratePrediction` para criar um registro
// real, depois consulta a explicação sobre ele.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { handleGetPredictionExplanation } from "../src/services/predictionExplanationApiHandlers.ts";
import { handleGeneratePrediction, mapErrorToResult } from "../src/services/predictionApiHandlers.ts";
import { getPersistedPredictions } from "../src/services/predictionCenterService.ts";
import { PredictionQueryValidationError } from "../src/services/prediction-query/predictionQueryErrors.ts";

function generateBody(overrides = {}) {
  return {
    matchId: "explanation-generate-1",
    homePlayerId: "explanation-home-1",
    awayPlayerId: "explanation-away-1",
    homeRating: 1700,
    awayRating: 1400,
    virtualTeamHome: "Explanation Home",
    virtualTeamAway: "Explanation Away",
    league: "Explanation League",
    period: "2026-08",
    sequenceKey: 1,
    ...overrides,
  };
}

async function createPrediction(overrides = {}) {
  const result = await handleGeneratePrediction(generateBody(overrides));
  assert.equal(result.status, 200, `expected generation to succeed, got ${JSON.stringify(result.body)}`);
  return result.body;
}

// ---------------------------------------------------------------------
// Arquitetura
// ---------------------------------------------------------------------

test("architecture: predictionExplanationApiHandlers.ts never imports next/server, Repository, Prisma, or the mapper directly", () => {
  const source = readFileSync(fileURLToPath(new URL("../src/services/predictionExplanationApiHandlers.ts", import.meta.url)), "utf8");
  const code = source.split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
  const forbidden = ["next/server", "PrismaClient", "@prisma/client", "InMemoryPredictionRepository", "PrismaPredictionRepository", "PredictionSnapshotMapper", "lib/prisma", "predictMatch"];
  for (const term of forbidden) {
    assert.ok(!code.includes(term), `predictionExplanationApiHandlers.ts must not reference "${term}"`);
  }
});

test("architecture: reuses mapErrorToResult from predictionApiHandlers.ts (never duplicates error mapping)", () => {
  const source = readFileSync(fileURLToPath(new URL("../src/services/predictionExplanationApiHandlers.ts", import.meta.url)), "utf8");
  assert.match(source, /import\s*\{[^}]*mapErrorToResult[^}]*\}\s*from\s*"\.\/predictionApiHandlers\.ts"/);
});

test("architecture: never writes (zero-write GET) — total stays unchanged across repeated calls", async () => {
  const before = await getPersistedPredictions({});
  await handleGetPredictionExplanation("does-not-exist");
  await handleGetPredictionExplanation("does-not-exist");
  const after = await getPersistedPredictions({});
  assert.equal(after.total, before.total);
});

// ---------------------------------------------------------------------
// handleGetPredictionExplanation
// ---------------------------------------------------------------------

test("returns 400 when id is empty", async () => {
  const result = await handleGetPredictionExplanation("");
  assert.equal(result.status, 400);
  assert.ok(result.body.error);
});

test("returns 404 when the prediction does not exist", async () => {
  const result = await handleGetPredictionExplanation("does-not-exist-explanation");
  assert.equal(result.status, 404);
  assert.ok(result.body.error);
});

test("returns 200 with the full PredictionExplanationView shape for an existing prediction", async () => {
  const created = await createPrediction({ matchId: "explanation-shape-1" });
  const result = await handleGetPredictionExplanation(created.id, "2026-07-29T12:00:00.000Z");
  assert.equal(result.status, 200);
  assert.equal(result.body.factors.length, 7);
  assert.equal(result.body.confidenceBreakdown.reduce((sum, item) => sum + item.percentage, 0), 100);
  assert.ok(Array.isArray(result.body.reasons));
  assert.ok(Array.isArray(result.body.risks));
  assert.ok(["A_PLUS", "A", "B_PLUS", "B", "C", "D"].includes(result.body.quality.grade));
});

test("never exposes snapshotPayload, stack, or cause in the response body", async () => {
  const created = await createPrediction({ matchId: "explanation-security-1" });
  const result = await handleGetPredictionExplanation(created.id);
  const serialized = JSON.stringify(result.body);
  assert.ok(!serialized.includes("snapshotPayload"));
  assert.ok(!serialized.toLowerCase().includes("stack"));
  assert.ok(!serialized.toLowerCase().includes("database"));
});

test("uses the provided 'now' for staleness evaluation (deterministic, never Date.now() internally)", async () => {
  const created = await createPrediction({ matchId: "explanation-staleness-1" });

  const fresh = await handleGetPredictionExplanation(created.id, created.snapshot?.result?.metadata?.generatedAt ?? new Date().toISOString());
  const staleNow = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
  const stale = await handleGetPredictionExplanation(created.id, staleNow);

  assert.ok(!fresh.body.risks.some((r) => r.code === "STALE_DATA"));
  assert.ok(stale.body.risks.some((r) => r.code === "STALE_DATA"));
});

test("mapErrorToResult from predictionApiHandlers.ts still maps PredictionQueryValidationError correctly (reused, not duplicated)", () => {
  const error = new PredictionQueryValidationError(["id"]);
  const mapped = mapErrorToResult(error);
  assert.equal(mapped.status, 400);
});
