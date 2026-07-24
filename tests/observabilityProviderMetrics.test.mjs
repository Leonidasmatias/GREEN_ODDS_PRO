import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeProviderMetrics,
  computeProviderReliabilityScore,
  PROVIDER_RELIABILITY_NEUTRAL_SCORE,
} from "../src/services/observability/ProviderMetrics.ts";

function syncRun(overrides) {
  return {
    id: "run-1", provider: "BETSAPI", mode: "sandbox",
    startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:05.000Z", durationMs: 5000,
    status: "success", pagesFetched: 1, eventsReceived: 10, confirmedEsoccer: 5, probableEsoccer: 2,
    rejected: 0, duplicated: 0, imported: 5, updated: 0, errors: [], rateLimitRemaining: 80,
    ...overrides,
  };
}

function metric(overrides) {
  return {
    provider: "BETSAPI", windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-01T00:05:00.000Z",
    totalRequests: 10, successfulRequests: 10, partialRequests: 0, failedRequests: 0,
    retryCount: 0, fallbackCount: 0, rateLimitHits: 0, lastError: null,
    ...overrides,
  };
}

test("no windows yields an all-zero metric with a stable timestamp", () => {
  const result = analyzeProviderMetrics("BETSAPI", []);
  assert.equal(result.totalRequests, 0);
  assert.equal(result.successfulRequests, 0);
  assert.equal(result.partialRequests, 0);
  assert.equal(result.lastError, null);
});

test("success/partial/failed sync runs are now counted into 3 separate buckets (partialRequests no longer folded into successfulRequests)", () => {
  const windows = [
    { syncRun: syncRun({ id: "a", status: "success" }), hostMetrics: null },
    { syncRun: syncRun({ id: "b", status: "failed", errors: ["network down"] }), hostMetrics: null },
    { syncRun: syncRun({ id: "c", status: "partial" }), hostMetrics: null },
  ];
  const result = analyzeProviderMetrics("BETSAPI", windows);
  assert.equal(result.totalRequests, 3);
  assert.equal(result.successfulRequests, 1);
  assert.equal(result.partialRequests, 1);
  assert.equal(result.failedRequests, 1);
});

test("lastError picks up the sanitized hostMetrics error from the most recent window", () => {
  const windows = [
    { syncRun: syncRun({ id: "a", startedAt: "2026-01-01T00:00:00.000Z" }), hostMetrics: null },
    {
      syncRun: syncRun({ id: "b", startedAt: "2026-01-02T00:00:00.000Z" }),
      hostMetrics: { host: "api.b365api.com", lastLatencyMs: 120, lastSuccessAt: null, lastFailureAt: "2026-01-02T00:00:01.000Z", lastError: "timeout after 10000ms" },
    },
  ];
  const result = analyzeProviderMetrics("BETSAPI", windows);
  assert.equal(result.lastError, "timeout after 10000ms");
});

test("rateLimitHits counts windows where the sync run's rateLimitRemaining reached 0", () => {
  const windows = [
    { syncRun: syncRun({ id: "a", rateLimitRemaining: 0 }), hostMetrics: null },
    { syncRun: syncRun({ id: "b", rateLimitRemaining: 30 }), hostMetrics: null },
  ];
  const result = analyzeProviderMetrics("BETSAPI", windows);
  assert.equal(result.rateLimitHits, 1);
});

test("retryCount and fallbackCount stay documented as 0 in this phase (BetsApiClient does not expose real counters)", () => {
  const windows = [{ syncRun: syncRun({}), hostMetrics: null }];
  const result = analyzeProviderMetrics("BETSAPI", windows);
  assert.equal(result.retryCount, 0);
  assert.equal(result.fallbackCount, 0);
});

test("computeProviderReliabilityScore: null metric yields the documented neutral score, never maximum reliability", () => {
  assert.equal(computeProviderReliabilityScore(null), PROVIDER_RELIABILITY_NEUTRAL_SCORE);
  assert.equal(PROVIDER_RELIABILITY_NEUTRAL_SCORE, 50);
});

test("computeProviderReliabilityScore: totalRequests=0 also yields the neutral score (insufficient data is never read as full reliability)", () => {
  const score = computeProviderReliabilityScore(metric({ totalRequests: 0, successfulRequests: 0 }));
  assert.equal(score, PROVIDER_RELIABILITY_NEUTRAL_SCORE);
});

test("computeProviderReliabilityScore: 100% success with no rate-limit/retry/fallback yields exactly 100", () => {
  const score = computeProviderReliabilityScore(metric({ totalRequests: 10, successfulRequests: 10 }));
  assert.equal(score, 100);
});

test("computeProviderReliabilityScore: 100% total failure yields 0", () => {
  const score = computeProviderReliabilityScore(metric({ totalRequests: 10, successfulRequests: 0, failedRequests: 10 }));
  assert.equal(score, 0);
});

test("computeProviderReliabilityScore: a partial failure counts as half a success, distinct from a total failure", () => {
  const allPartial = computeProviderReliabilityScore(metric({ totalRequests: 10, successfulRequests: 0, partialRequests: 10, failedRequests: 0 }));
  const allFailed = computeProviderReliabilityScore(metric({ totalRequests: 10, successfulRequests: 0, partialRequests: 0, failedRequests: 10 }));
  assert.equal(allPartial, 50);
  assert.equal(allFailed, 0);
  assert.ok(allPartial > allFailed);
});

test("computeProviderReliabilityScore: rate-limit events apply a documented penalty on top of the success rate", () => {
  const withoutRateLimit = computeProviderReliabilityScore(metric({ totalRequests: 10, successfulRequests: 10, rateLimitHits: 0 }));
  const withRateLimit = computeProviderReliabilityScore(metric({ totalRequests: 10, successfulRequests: 10, rateLimitHits: 10 }));
  assert.equal(withoutRateLimit, 100);
  assert.ok(withRateLimit < withoutRateLimit);
});

test("computeProviderReliabilityScore is always clamped to 0..100 even under adversarial inputs", () => {
  const score = computeProviderReliabilityScore(metric({ totalRequests: 5, successfulRequests: 5, rateLimitHits: 100 }));
  assert.ok(score >= 0 && score <= 100);
});

test("computeProviderReliabilityScore is deterministic - same metric always yields the same score", () => {
  const input = metric({ totalRequests: 7, successfulRequests: 5, partialRequests: 1, failedRequests: 1, rateLimitHits: 2 });
  assert.equal(computeProviderReliabilityScore(input), computeProviderReliabilityScore(input));
});
