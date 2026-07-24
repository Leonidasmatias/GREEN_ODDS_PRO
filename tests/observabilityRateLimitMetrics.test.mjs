import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRateLimitMetrics } from "../src/services/observability/RateLimitMetrics.ts";

function state(overrides) {
  return { limit: 100, remaining: 50, resetAt: null, observedAt: "2026-01-01T00:00:00.000Z", blocked: false, reserveReached: false, ...overrides };
}

test("no observations yields an all-empty result", () => {
  const result = analyzeRateLimitMetrics([]);
  assert.equal(result.observationCount, 0);
  assert.equal(result.minRemainingObserved, null);
  assert.equal(result.lastObservedAt, null);
});

test("minRemainingObserved picks the smallest remaining value across observations", () => {
  const result = analyzeRateLimitMetrics([state({ remaining: 40 }), state({ remaining: 5 }), state({ remaining: 20 })]);
  assert.equal(result.minRemainingObserved, 5);
});

test("blockedCount and reserveReachedCount count only the flagged observations", () => {
  const result = analyzeRateLimitMetrics([
    state({ blocked: true, reserveReached: true }),
    state({ blocked: false, reserveReached: true }),
    state({ blocked: false, reserveReached: false }),
  ]);
  assert.equal(result.blockedCount, 1);
  assert.equal(result.reserveReachedCount, 2);
});

test("lastObservedAt reflects the chronologically latest observation, regardless of input order", () => {
  const result = analyzeRateLimitMetrics([
    state({ observedAt: "2026-01-03T00:00:00.000Z" }),
    state({ observedAt: "2026-01-01T00:00:00.000Z" }),
    state({ observedAt: "2026-01-02T00:00:00.000Z" }),
  ]);
  assert.equal(result.lastObservedAt, "2026-01-03T00:00:00.000Z");
});

test("null remaining values are excluded from minRemainingObserved", () => {
  const result = analyzeRateLimitMetrics([state({ remaining: null }), state({ remaining: null })]);
  assert.equal(result.minRemainingObserved, null);
});
