// Sprint 8.2 — Prediction Dashboard and Timeline.
// Testa exclusivamente a fronteira HTTP client-side (`predictionApiClient.ts`)
// via mock de `global.fetch` — nunca uma chamada de rede real, nunca
// importa Repository/Query Service/Prisma (essa camada não deve
// depender deles; ver também `predictionHistoryScope.test.mjs`).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PredictionApiError,
  getLatestPredictionByMatch,
  getPredictionById,
  getPredictionHistoryByMatch,
  listPredictions,
} from "../src/lib/predictionApiClient.ts";

function mockFetch(status, body) {
  return async (url) => {
    mockFetch.lastUrl = url;
    return {
      status,
      json: async () => body,
    };
  };
}

function jsonPage(overrides = {}) {
  return { items: [], total: 0, limit: 20, offset: 0, hasNextPage: false, hasPreviousPage: false, ...overrides };
}

let originalFetch;
test.beforeEach(() => {
  originalFetch = globalThis.fetch;
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------
// Arquitetura
// ---------------------------------------------------------------------

test("architecture: predictionApiClient.ts never imports Repository, Query Service, Persistence Service, Prisma, or the composition root", () => {
  const source = readFileSync(fileURLToPath(new URL("../src/lib/predictionApiClient.ts", import.meta.url)), "utf8");
  const code = source.split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
  const forbidden = [
    "PrismaPredictionRepository",
    "InMemoryPredictionRepository",
    "PredictionQueryService",
    "PredictionPersistenceService",
    "predictionCenterComposition",
    "PrismaClient",
    "@prisma/client",
    "lib/prisma",
    "PredictionSnapshotMapper",
  ];
  for (const term of forbidden) {
    assert.ok(!code.includes(term), `predictionApiClient.ts must not reference "${term}"`);
  }
  // A única referência permitida a `PredictionRepository.ts` é o import
  // de tipos (`PredictionRecordSource`) — nunca do valor/implementação.
  const repositoryLines = code.split("\n").filter((line) => line.includes("PredictionRepository.ts"));
  assert.ok(repositoryLines.length > 0, "expected a reference to PredictionRepository.ts for the PredictionRecordSource type");
  for (const line of repositoryLines) {
    assert.ok(line.trim().startsWith("import type"), `expected type-only import, got: ${line}`);
  }
});

test("architecture: never issues a POST request (generation stays out of this sprint's scope)", () => {
  const source = readFileSync(fileURLToPath(new URL("../src/lib/predictionApiClient.ts", import.meta.url)), "utf8");
  assert.ok(!source.includes('"POST"') && !source.includes("'POST'"), "predictionApiClient.ts must never issue POST");
});

// ---------------------------------------------------------------------
// listPredictions — construção de URL
// ---------------------------------------------------------------------

test("listPredictions: no filters -> plain URL, no query string", async () => {
  globalThis.fetch = mockFetch(200, jsonPage());
  await listPredictions();
  assert.equal(mockFetch.lastUrl, "/api/predictions");
});

test("listPredictions: each filter is serialized individually", async () => {
  const cases = [
    [{ matchId: "m1" }, "matchId=m1"],
    [{ playerId: "p1" }, "playerId=p1"],
    [{ league: "esoccer-bl" }, "league=esoccer-bl"],
    [{ period: "H1" }, "period=H1"],
    [{ limit: 50 }, "limit=50"],
    [{ offset: 40 }, "offset=40"],
    [{ orderBy: "createdAt" }, "orderBy=createdAt"],
    [{ orderDirection: "asc" }, "orderDirection=asc"],
  ];
  for (const [query, expectedFragment] of cases) {
    globalThis.fetch = mockFetch(200, jsonPage());
    await listPredictions(query);
    assert.ok(mockFetch.lastUrl.includes(expectedFragment), `expected "${expectedFragment}" in ${mockFetch.lastUrl}`);
  }
});

test("listPredictions: combined filters all present together", async () => {
  globalThis.fetch = mockFetch(200, jsonPage());
  await listPredictions({ matchId: "m1", league: "L", limit: 10, offset: 20, orderBy: "generatedAt", orderDirection: "desc" });
  const url = new URL(mockFetch.lastUrl, "http://localhost");
  assert.equal(url.searchParams.get("matchId"), "m1");
  assert.equal(url.searchParams.get("league"), "L");
  assert.equal(url.searchParams.get("limit"), "10");
  assert.equal(url.searchParams.get("offset"), "20");
  assert.equal(url.searchParams.get("orderBy"), "generatedAt");
  assert.equal(url.searchParams.get("orderDirection"), "desc");
});

test("listPredictions: special characters are encoded via URLSearchParams", async () => {
  globalThis.fetch = mockFetch(200, jsonPage());
  await listPredictions({ league: "Liga A & B" });
  const url = new URL(mockFetch.lastUrl, "http://localhost");
  assert.equal(url.searchParams.get("league"), "Liga A & B");
});

test("listPredictions: returns the parsed page on success", async () => {
  const page = jsonPage({ items: [{ id: "x" }], total: 1 });
  globalThis.fetch = mockFetch(200, page);
  const result = await listPredictions();
  assert.deepEqual(result, page);
});

// ---------------------------------------------------------------------
// getPredictionById
// ---------------------------------------------------------------------

test("getPredictionById: builds the correct URL and encodes the id", async () => {
  globalThis.fetch = mockFetch(200, { id: "abc" });
  await getPredictionById("some id/with slash");
  assert.equal(mockFetch.lastUrl, `/api/predictions/${encodeURIComponent("some id/with slash")}`);
});

test("getPredictionById: 404 resolves to null (never throws)", async () => {
  globalThis.fetch = mockFetch(404, { error: "Previsão não encontrada." });
  const result = await getPredictionById("missing");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------
// getPredictionHistoryByMatch / getLatestPredictionByMatch
// ---------------------------------------------------------------------

test("getPredictionHistoryByMatch: builds the correct URL with query", async () => {
  globalThis.fetch = mockFetch(200, jsonPage());
  await getPredictionHistoryByMatch("match-1", { orderBy: "generatedAt", orderDirection: "desc", limit: 10, offset: 0 });
  const url = new URL(mockFetch.lastUrl, "http://localhost");
  assert.ok(mockFetch.lastUrl.startsWith("/api/predictions/match/match-1"));
  assert.equal(url.searchParams.get("orderBy"), "generatedAt");
  assert.equal(url.searchParams.get("limit"), "10");
});

test("getLatestPredictionByMatch: builds the correct URL", async () => {
  globalThis.fetch = mockFetch(200, { id: "x" });
  await getLatestPredictionByMatch("match-1");
  assert.equal(mockFetch.lastUrl, "/api/predictions/match/match-1/latest");
});

test("getLatestPredictionByMatch: 404 resolves to null", async () => {
  globalThis.fetch = mockFetch(404, { error: "Nenhuma previsão encontrada para esta partida." });
  const result = await getLatestPredictionByMatch("match-1");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------

test("throws PredictionApiError with status/message/fields for a 400 response", async () => {
  globalThis.fetch = mockFetch(400, { error: "Parâmetros de consulta inválidos.", fields: ["limit"] });
  await assert.rejects(() => listPredictions(), (error) => {
    assert.ok(error instanceof PredictionApiError);
    assert.equal(error.status, 400);
    assert.equal(error.message, "Parâmetros de consulta inválidos.");
    assert.deepEqual(error.fields, ["limit"]);
    return true;
  });
});

for (const status of [401, 403, 500, 503]) {
  test(`throws PredictionApiError for a ${status} response`, async () => {
    globalThis.fetch = mockFetch(status, { error: "erro" });
    await assert.rejects(() => listPredictions(), (error) => {
      assert.ok(error instanceof PredictionApiError);
      assert.equal(error.status, status);
      return true;
    });
  });
}

test("getPredictionById: non-404 error status still throws", async () => {
  globalThis.fetch = mockFetch(500, { error: "Falha interna." });
  await assert.rejects(() => getPredictionById("x"), PredictionApiError);
});

test("network failure (non-abort) surfaces as PredictionApiError with status 0", async () => {
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  await assert.rejects(() => listPredictions(), (error) => {
    assert.ok(error instanceof PredictionApiError);
    assert.equal(error.status, 0);
    return true;
  });
});

test("invalid JSON response surfaces as PredictionApiError", async () => {
  globalThis.fetch = async () => ({
    status: 200,
    json: async () => {
      throw new Error("invalid json");
    },
  });
  await assert.rejects(() => listPredictions(), PredictionApiError);
});

test("an aborted request rethrows the original AbortError (never wrapped)", async () => {
  const abortError = new DOMException("aborted", "AbortError");
  globalThis.fetch = async () => {
    throw abortError;
  };
  await assert.rejects(() => listPredictions(), (error) => {
    assert.equal(error, abortError);
    return true;
  });
});

test("error body missing 'error' field falls back to a generic message", async () => {
  globalThis.fetch = mockFetch(500, {});
  await assert.rejects(() => listPredictions(), (error) => {
    assert.ok(error instanceof PredictionApiError);
    assert.equal(error.message, "Erro inesperado ao consultar previsões.");
    return true;
  });
});
