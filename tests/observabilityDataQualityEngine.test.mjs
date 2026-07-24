import test from "node:test";
import assert from "node:assert/strict";
import { computeDataQualitySnapshot } from "../src/services/observability/DataQualityEngine.ts";
import { normalizeProviderMatch } from "../src/providers/pipeline/ProviderNormalizer.ts";
import { esoccerFixtureCatalog } from "../src/providers/fixture/esoccerFixtureCatalog.ts";
import { loadObservabilityConfig } from "../src/services/observability/ObservabilityConfig.ts";

const CONFIG = loadObservabilityConfig({});
const WEIGHTS = CONFIG.weights;
const STALE_DATA_MINUTES = CONFIG.staleDataMinutes;
const FIXTURE_MATCHES = esoccerFixtureCatalog.map((raw) => normalizeProviderMatch({ provider: "FIXTURE", raw }));
const ALL_CONFIRMED = FIXTURE_MATCHES.map(() => ({ classification: "confirmed_esoccer", evidence: [] }));

const PERFECT_PROVIDER_METRIC = {
  provider: "BETSAPI", windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-01T00:05:00.000Z",
  totalRequests: 10, successfulRequests: 10, partialRequests: 0, failedRequests: 0,
  retryCount: 0, fallbackCount: 0, rateLimitHits: 0, lastError: null,
};

test("weights sum to exactly 1 and every default matches the mandatory formula", () => {
  const sum =
    WEIGHTS.completeness + WEIGHTS.consistency + WEIGHTS.classification + WEIGHTS.duplicate + WEIGHTS.freshness + WEIGHTS.providerReliability;
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights must sum to 1, got ${sum}`);
  assert.equal(WEIGHTS.completeness, 0.25);
  assert.equal(WEIGHTS.consistency, 0.2);
  assert.equal(WEIGHTS.classification, 0.2);
  assert.equal(WEIGHTS.duplicate, 0.15);
  assert.equal(WEIGHTS.freshness, 0.1);
  assert.equal(WEIGHTS.providerReliability, 0.1);
});

test("a perfect sample (300 fixture matches, all confirmed, no duplicates, fresh sync, perfect provider) yields overallScore of exactly 100", () => {
  const now = () => new Date("2026-01-01T00:00:00.000Z");
  const snapshot = computeDataQualitySnapshot({
    matches: FIXTURE_MATCHES,
    classifications: ALL_CONFIRMED,
    duplicateSummary: { totalRaw: 300, duplicated: 0 },
    providerMetric: PERFECT_PROVIDER_METRIC,
    lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z",
    weights: WEIGHTS,
    staleDataMinutes: STALE_DATA_MINUTES,
    now,
    idGenerator: () => "snapshot-1",
  });
  assert.equal(snapshot.sampleSize, 300);
  assert.equal(snapshot.completenessScore, 100);
  assert.equal(snapshot.consistencyScore, 100);
  assert.equal(snapshot.classificationScore, 100);
  assert.equal(snapshot.duplicationScore, 100);
  assert.equal(snapshot.freshnessScore, 100);
  assert.equal(snapshot.providerReliabilityScore, 100);
  assert.ok(Math.abs(snapshot.overallScore - 100) < 1e-9);
  assert.equal(snapshot.id, "snapshot-1");
  assert.equal(snapshot.generatedAt, "2026-01-01T00:00:00.000Z");
});

test("every sub-score and overallScore stay within the mandatory 0..100 range", () => {
  const now = () => new Date("2026-01-01T00:00:00.000Z");
  const snapshot = computeDataQualitySnapshot({
    matches: FIXTURE_MATCHES,
    classifications: ALL_CONFIRMED,
    duplicateSummary: { totalRaw: 300, duplicated: 0 },
    providerMetric: PERFECT_PROVIDER_METRIC,
    lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z",
    weights: WEIGHTS,
    staleDataMinutes: STALE_DATA_MINUTES,
    now,
  });
  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof value !== "number") continue;
    if (key === "sampleSize") continue;
    assert.ok(value >= 0 && value <= 100, `${key} (${value}) must be within 0..100`);
  }
});

test("all-unknown classifications, heavy duplication, stale sync and no provider data drag overallScore down proportionally to the weights", () => {
  const unknownClassifications = FIXTURE_MATCHES.map(() => ({ classification: "unknown", evidence: [] }));
  const snapshot = computeDataQualitySnapshot({
    matches: FIXTURE_MATCHES,
    classifications: unknownClassifications,
    duplicateSummary: { totalRaw: 300, duplicated: 300 },
    providerMetric: null,
    lastSuccessfulSyncAt: null,
    weights: WEIGHTS,
    staleDataMinutes: STALE_DATA_MINUTES,
  });
  assert.equal(snapshot.classificationScore, 0);
  assert.equal(snapshot.duplicationScore, 0);
  assert.equal(snapshot.freshnessScore, 0);
  assert.equal(snapshot.providerReliabilityScore, 50); // sem dados suficientes -> neutro, nunca maximo
  // completeness/consistency permanecem 100 (as 300 partidas fixture sao integras)
  const expected = 100 * WEIGHTS.completeness + 100 * WEIGHTS.consistency + 50 * WEIGHTS.providerReliability;
  assert.ok(Math.abs(snapshot.overallScore - expected) < 1e-9);
});

test("leagueMetrics groups by league name and reflects per-league confirmed-esoccer ratio", () => {
  const snapshot = computeDataQualitySnapshot({
    matches: FIXTURE_MATCHES,
    classifications: ALL_CONFIRMED,
    duplicateSummary: { totalRaw: 300, duplicated: 0 },
    providerMetric: PERFECT_PROVIDER_METRIC,
    lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z",
    weights: WEIGHTS,
    staleDataMinutes: STALE_DATA_MINUTES,
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  });
  assert.ok(snapshot.leagueMetrics.length > 0);
  for (const league of snapshot.leagueMetrics) {
    assert.equal(league.confirmedEsoccerRatio, 1);
    assert.equal(league.completenessRatio, 1);
  }
});

test("empty sample never throws; freshness/providerReliability still compute from their own inputs even with zero matches", () => {
  const snapshot = computeDataQualitySnapshot({
    matches: [],
    classifications: [],
    duplicateSummary: { totalRaw: 0, duplicated: 0 },
    providerMetric: null,
    lastSuccessfulSyncAt: null,
    weights: WEIGHTS,
    staleDataMinutes: STALE_DATA_MINUTES,
  });
  assert.equal(snapshot.sampleSize, 0);
  assert.equal(snapshot.completenessScore, 0);
  assert.equal(snapshot.consistencyScore, 0);
  assert.equal(snapshot.classificationScore, 0);
  assert.equal(snapshot.duplicationScore, 100); // 0 duplicados de 0 totalRaw -> health score perfeito por convencao (ver DuplicateMetrics.ts)
  assert.equal(snapshot.freshnessScore, 0); // sem lastSuccessfulSyncAt
  assert.equal(snapshot.providerReliabilityScore, 50); // sem dados de provider
  const expected = 100 * WEIGHTS.duplicate + 50 * WEIGHTS.providerReliability;
  assert.ok(Math.abs(snapshot.overallScore - expected) < 1e-9);
});

test("calculation is deterministic - same inputs and injected clock/id always produce the same snapshot", () => {
  const now = () => new Date("2026-01-01T00:00:00.000Z");
  const build = () =>
    computeDataQualitySnapshot({
      matches: FIXTURE_MATCHES.slice(0, 10),
      classifications: ALL_CONFIRMED.slice(0, 10),
      duplicateSummary: { totalRaw: 10, duplicated: 1 },
      providerMetric: PERFECT_PROVIDER_METRIC,
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z",
      weights: WEIGHTS,
      staleDataMinutes: STALE_DATA_MINUTES,
      now,
      idGenerator: () => "fixed-id",
    });
  const first = build();
  const second = build();
  assert.deepEqual(first, second);
});
