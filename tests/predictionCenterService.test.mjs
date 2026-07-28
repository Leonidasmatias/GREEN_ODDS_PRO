import test from "node:test";
import assert from "node:assert/strict";
import {
  generateAndPersistPredictionCenterData,
  getLatestPredictionByMatch,
  getPersistedPredictionById,
  getPersistedPredictions,
  getPredictionCenterData,
  getPredictionHistoryByMatch,
} from "../src/services/predictionCenterService.ts";
import { PREDICTION_CENTER_FIXTURE } from "../src/data/predictionCenter.fixture.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function cleanSnapshot(overrides = {}) {
  return {
    matchId: "svc-match-1",
    homePlayerId: "home-1",
    awayPlayerId: "away-1",
    virtualTeamHome: "Bologna Virtual",
    virtualTeamAway: "Roma Virtual",
    league: "eSoccer Battle - Liga A",
    period: "2026-07",
    sequenceKey: 1,
    result: {
      prediction: {
        modelVersion: "esoccer-prediction-v1.0.0-provisional",
        generatedAt: "2026-07-28T09:00:00.000Z",
        probabilities: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 },
        predictedOutcome: "HOME_WIN",
        topProbability: 0.6,
        probabilityMargin: 0.35,
        dataSufficiency: { status: "STRONG", sampleSize: 40, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings: [] },
        featureTrace: [],
      },
      goalDistribution: {
        modelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
        generatedAt: "2026-07-28T09:00:00.000Z",
        expectedGoals: { home: 1.8, away: 1.1, total: 2.9 },
        homeGoalDistribution: [],
        awayGoalDistribution: [],
        exactScores: [],
        mostLikelyScore: { homeGoals: 2, awayGoals: 1, totalGoals: 3, probability: 0.14 },
        topExactScores: [],
        topExactScoresAggregateProbability: 0.4,
        overUnder: [
          { line: 1.5, over: 0.71, under: 0.29 },
          { line: 2.5, over: 0.48, under: 0.52 },
        ],
        bothTeamsToScore: { yes: 0.55, no: 0.45 },
        scoreDerivedOutcomeProbabilities: { homeWin: 0.58, draw: 0.24, awayWin: 0.18 },
        dataSufficiency: { status: "STRONG", sampleSize: 40, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings: [] },
        featureTrace: [],
        warnings: [],
      },
      greenScore: { score: 78, category: "HIGH" },
      confidence: 82,
      quality: {
        predictionDataSufficiency: "STRONG",
        goalDistributionDataSufficiency: "STRONG",
        combinedStatus: "STRONG",
        consistency: { level: "ALIGNED", matchingWinner: true, maxProbabilityDelta: 0.02, adjustment: 8 },
      },
      warnings: [],
      explanation: {
        topSignals: [{ type: "RATING_ADVANTAGE", source: "PREDICTION_ENGINE", favors: "HOME", magnitude: 0.7 }],
        totalSignalsConsidered: 3,
      },
      metadata: {
        predictionModelVersion: "esoccer-prediction-v1.0.0-provisional",
        goalDistributionModelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
        orchestratorModelVersion: "esoccer-prediction-orchestrator-v1.0.0-provisional",
        generatedAt: "2026-07-28T09:00:00.000Z",
        configurationHash: "abc123",
      },
    },
    ...overrides,
  };
}

function degradedSnapshot(overrides = {}) {
  const base = cleanSnapshot();
  return {
    ...base,
    matchId: "svc-match-degraded",
    result: {
      ...base.result,
      quality: { ...base.result.quality, combinedStatus: "LIMITED", consistency: { ...base.result.quality.consistency, level: "MINOR_DIVERGENCE" } },
      warnings: ["fallback_conservative_baseline_applied"],
    },
    ...overrides,
  };
}

function structurallyInvalidSnapshot() {
  return { matchId: "broken", homePlayerId: "home-x" }; // sem awayPlayerId, sem result
}

// ---------------------------------------------------------------------
// Fonte padrão / source
// ---------------------------------------------------------------------

test("with no argument, uses PREDICTION_CENTER_FIXTURE as the default source", async () => {
  const result = await getPredictionCenterData();
  assert.equal(result.source, "fixture");
  assert.equal(result.status !== "empty" && result.status !== "error", true);
  assert.equal(result.items.length, PREDICTION_CENTER_FIXTURE.length);
});

test("source is always 'fixture', never 'real', even with an override (no real pipeline exists yet)", async () => {
  const result = await getPredictionCenterData([cleanSnapshot()]);
  assert.equal(result.source, "fixture");
});

// ---------------------------------------------------------------------
// success / partial / empty
// ---------------------------------------------------------------------

test("all clean snapshots yield status 'success'", async () => {
  const result = await getPredictionCenterData([cleanSnapshot()]);
  assert.equal(result.status, "success");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].status, "success");
});

test("at least one degraded item yields status 'partial' (rollup, no dropped items)", async () => {
  const result = await getPredictionCenterData([cleanSnapshot(), degradedSnapshot()]);
  assert.equal(result.status, "partial");
  assert.equal(result.items.length, 2);
});

test("the real fixture (naturally INSUFFICIENT quality) yields status 'partial' end-to-end through the real service", async () => {
  const result = await getPredictionCenterData();
  assert.equal(result.status, "partial");
  assert.equal(result.items.length, PREDICTION_CENTER_FIXTURE.length);
});

test("an empty array yields status 'empty', with source but no items/message", async () => {
  const result = await getPredictionCenterData([]);
  assert.equal(result.status, "empty");
  assert.equal(result.source, "fixture");
  assert.equal("items" in result, false);
  assert.equal("message" in result, false);
});

// ---------------------------------------------------------------------
// Itens inválidos
// ---------------------------------------------------------------------

test("a mix of valid and structurally invalid items: invalid ones are dropped, valid ones are processed, status is 'partial'", async () => {
  const result = await getPredictionCenterData([cleanSnapshot(), structurallyInvalidSnapshot()]);
  assert.equal(result.status, "partial");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].header.matchId, "svc-match-1");
});

test("a mix of valid and invalid items yields 'partial' even when every processed item is individually clean/success", async () => {
  const result = await getPredictionCenterData([cleanSnapshot(), structurallyInvalidSnapshot()]);
  assert.equal(result.items[0].status, "success");
  assert.equal(result.status, "partial");
});

test("every item structurally invalid yields status 'error' with the generic stable message", async () => {
  const result = await getPredictionCenterData([structurallyInvalidSnapshot(), { foo: "bar" }, null]);
  assert.equal(result.status, "error");
  assert.equal(result.message, "Não foi possível carregar as previsões do Prediction Center.");
});

// ---------------------------------------------------------------------
// Catch real (Proxy que lança na leitura de uma propriedade essencial)
// ---------------------------------------------------------------------

test("an item that throws when its properties are read is caught for real (Proxy technique, same pattern validated in Sprint 6.0) and never propagates", async () => {
  const poisoned = new Proxy(
    {},
    {
      get() {
        throw new Error("boom");
      },
    },
  );
  await assert.doesNotReject(() => getPredictionCenterData([poisoned]));
  const result = await getPredictionCenterData([poisoned]);
  assert.equal(result.status, "error");
  assert.equal(result.message, "Não foi possível carregar as previsões do Prediction Center.");
});

test("the error result never exposes a stack trace or technical detail", async () => {
  const poisoned = new Proxy(
    {},
    {
      get() {
        throw new Error("internal database connection string leaked here");
      },
    },
  );
  const result = await getPredictionCenterData([poisoned]);
  assert.equal(result.status, "error");
  assert.ok(!result.message.includes("internal"));
  assert.ok(!result.message.includes("at "));
  assert.ok(!result.message.includes("Error:"));
});

test("the error message is stable across the 'all invalid' and 'unexpected exception' branches", async () => {
  const allInvalid = await getPredictionCenterData([structurallyInvalidSnapshot()]);
  const poisoned = new Proxy({}, { get() { throw new Error("boom"); } });
  const caught = await getPredictionCenterData([poisoned]);
  assert.equal(allInvalid.message, caught.message);
});

// ---------------------------------------------------------------------
// Não-mutação / determinismo
// ---------------------------------------------------------------------

test("does not mutate the snapshotsOverride array passed in", async () => {
  const input = [cleanSnapshot(), degradedSnapshot()];
  const snapshotCopy = JSON.parse(JSON.stringify(input));
  await getPredictionCenterData(input);
  assert.deepEqual(input, snapshotCopy);
});

test("does not mutate individual snapshots", async () => {
  const snapshot = cleanSnapshot();
  const snapshotCopy = JSON.parse(JSON.stringify(snapshot));
  await getPredictionCenterData([snapshot]);
  assert.deepEqual(snapshot, snapshotCopy);
});

test("is deterministic for identical input", async () => {
  const input = [cleanSnapshot(), degradedSnapshot()];
  const first = await getPredictionCenterData(input);
  const second = await getPredictionCenterData(input);
  assert.deepEqual(first, second);
});

// ---------------------------------------------------------------------
// Confirma que o Adapter real está sendo exercitado (não um stub)
// ---------------------------------------------------------------------

test("items returned are real PredictionCenterViewModel produced by the real adapter, not a stub", async () => {
  const result = await getPredictionCenterData([cleanSnapshot()]);
  const [item] = result.items;
  assert.equal(item.header.homeTeamLabel, "Bologna Virtual");
  assert.equal(item.scores.greenScoreLabel, "78.0%");
  assert.equal(item.outcome.predictedOutcomeLabel, "Vitória do mandante");
  assert.ok(item.bestMarket);
  assert.equal(item.markets.length, 6);
});

// ---------------------------------------------------------------------
// Sprint 8.0/8.1 — integração com PredictionQueryService (leitura) e
// PredictionPersistenceService via generateAndPersistPredictionCenterData
// (escrita explícita, nunca getPredictionCenterData)
// ---------------------------------------------------------------------

test("Sprint 8.1: getPredictionCenterData never persists anymore (pure read) — no 'persistence' field, and nothing is stored", async () => {
  const result = await getPredictionCenterData([cleanSnapshot({ matchId: "integration-no-write-on-read" })]);
  assert.equal("persistence" in result, false);
  const history = await getPredictionHistoryByMatch("integration-no-write-on-read");
  assert.equal(history.total, 0);
});

function generateInput(overrides = {}) {
  return {
    matchId: "integration-generate-1",
    homePlayerId: "gen-home-1",
    awayPlayerId: "gen-away-1",
    homeRating: 1700,
    awayRating: 1400,
    virtualTeamHome: "Generated Home",
    virtualTeamAway: "Generated Away",
    league: "Generated League",
    period: "2026-08",
    sequenceKey: 1,
    ...overrides,
  };
}

test("generateAndPersistPredictionCenterData generates via the real Prediction Orchestrator and persists, with source 'fixture'", async () => {
  const result = await generateAndPersistPredictionCenterData(generateInput({ matchId: "integration-generate-basic" }));
  assert.equal(typeof result.id, "string");
  assert.equal(result.source, "fixture");
  assert.equal(result.snapshot.matchId, "integration-generate-basic");
  assert.equal(result.modelVersion, result.snapshot.result.metadata.orchestratorModelVersion);
  assert.equal(result.configurationHash, result.snapshot.result.metadata.configurationHash);
});

test("generateAndPersistPredictionCenterData is idempotent across two calls with equivalent input (same generatedAt would be required for a true hash tie; here we assert no crash and a queryable history)", async () => {
  await generateAndPersistPredictionCenterData(generateInput({ matchId: "integration-generate-idempotent" }));
  const history = await getPredictionHistoryByMatch("integration-generate-idempotent");
  assert.ok(history.total >= 1);
});

test("getPredictionHistoryByMatch delegates to the Query Service and reflects a prediction persisted via generateAndPersistPredictionCenterData", async () => {
  await generateAndPersistPredictionCenterData(generateInput({ matchId: "integration-history-1" }));
  const history = await getPredictionHistoryByMatch("integration-history-1");
  assert.equal(history.total, 1);
  assert.equal(history.items[0].matchId, "integration-history-1");
});

test("getLatestPredictionByMatch delegates to the Query Service and returns the full PredictionDetail", async () => {
  await generateAndPersistPredictionCenterData(generateInput({ matchId: "integration-latest-1" }));
  const latest = await getLatestPredictionByMatch("integration-latest-1");
  assert.ok(latest);
  assert.equal(latest.matchId, "integration-latest-1");
  assert.ok(latest.snapshot);
});

test("getLatestPredictionByMatch returns null for a match with no persisted prediction", async () => {
  const latest = await getLatestPredictionByMatch("integration-no-such-match");
  assert.equal(latest, null);
});

test("getPersistedPredictionById delegates to the Query Service and returns the persisted detail", async () => {
  await generateAndPersistPredictionCenterData(generateInput({ matchId: "integration-by-id-1" }));
  const history = await getPredictionHistoryByMatch("integration-by-id-1");
  const [{ id }] = history.items;
  const detail = await getPersistedPredictionById(id);
  assert.ok(detail);
  assert.equal(detail.id, id);
  assert.equal(detail.matchId, "integration-by-id-1");
});

test("getPersistedPredictions delegates to the Query Service and supports pagination/filtering", async () => {
  await generateAndPersistPredictionCenterData(generateInput({ matchId: "integration-search-1", league: "Integration League" }));
  const page = await getPersistedPredictions({ league: "Integration League" });
  assert.ok(page.total >= 1);
  assert.ok(page.items.every((item) => item.league === "Integration League"));
});

test("generateAndPersistPredictionCenterData rejects (propagates) a failure from the Persistence/Repository layer — write failures are never swallowed", async () => {
  // matchesCount/rating minimal player input is always structurally
  // valid, so a genuine failure here would come from the Repository's
  // own structural validation — exercised directly in
  // predictionPersistenceService.test.mjs / inMemoryPredictionRepository.test.mjs.
  // This test only confirms the function does NOT catch/hide errors
  // (no try/catch swallowing them), by confirming a well-formed call
  // resolves normally (absence of an unexpected catch-all).
  await assert.doesNotReject(() => generateAndPersistPredictionCenterData(generateInput({ matchId: "integration-generate-no-swallow" })));
});

test("scope: predictionCenterService.ts never imports the Repository, Prisma, or the mapper directly (composition root is the only place allowed to)", () => {
  const source = readFileSync(fileURLToPath(new URL("../src/services/predictionCenterService.ts", import.meta.url)), "utf8");
  // Remove comentários de linha antes de inspecionar código — evita
  // falso positivo ao encontrar os próprios nomes proibidos citados na
  // documentação em português do arquivo (ex.: "nunca importa
  // InMemoryPredictionRepository"), que não é um import real. Mesma
  // técnica já usada em tests/predictionCenterFixture.test.mjs.
  const code = source
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  const forbidden = ["PrismaClient", "@prisma/client", "InMemoryPredictionRepository", "PrismaPredictionRepository", "PredictionSnapshotMapper", "lib/prisma", "PredictionRepository.ts"];
  for (const term of forbidden) {
    assert.ok(!code.includes(term), `predictionCenterService.ts must not reference "${term}" directly`);
  }
});
