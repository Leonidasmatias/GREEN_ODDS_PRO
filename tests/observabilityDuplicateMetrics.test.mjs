import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateDuplicateMetrics,
  analyzeDuplicateMetrics,
  duplicateMetricsInputFromSyncReport,
} from "../src/services/observability/DuplicateMetrics.ts";

test("zero totalRaw yields a 0 duplicate rate and perfect health score, no NaN", () => {
  const result = analyzeDuplicateMetrics({ totalRaw: 0, duplicated: 0 });
  assert.equal(result.duplicateRate, 0);
  assert.equal(result.duplicateHealthScore, 1);
});

test("10% duplicate rate yields a 0.9 health score", () => {
  const result = analyzeDuplicateMetrics({ totalRaw: 100, duplicated: 10 });
  assert.equal(result.duplicateRate, 0.1);
  assert.equal(result.duplicateHealthScore, 0.9);
});

test("100% duplicate rate clamps health score at 0 (never negative)", () => {
  const result = analyzeDuplicateMetrics({ totalRaw: 10, duplicated: 10 });
  assert.equal(result.duplicateHealthScore, 0);
});

test("aggregateDuplicateMetrics sums totalRaw/duplicated across multiple runs before computing the rate", () => {
  const result = aggregateDuplicateMetrics([
    { totalRaw: 100, duplicated: 10 },
    { totalRaw: 50, duplicated: 5 },
  ]);
  assert.equal(result.totalRaw, 150);
  assert.equal(result.duplicated, 15);
  assert.equal(result.duplicateRate, 0.1);
});

test("duplicateMetricsInputFromSyncReport adapts a BetsApiSyncReport-shaped object without importing BetsApiSyncService", () => {
  const input = duplicateMetricsInputFromSyncReport({ eventsReceived: 40, duplicated: 4 });
  assert.deepEqual(input, { totalRaw: 40, duplicated: 4 });
});
