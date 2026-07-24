import test from "node:test";
import assert from "node:assert/strict";
import { computeLatencyPercentiles } from "../src/services/observability/LatencyMetrics.ts";

test("empty sample yields all-null percentiles and 0 count", () => {
  const result = computeLatencyPercentiles([]);
  assert.deepEqual(result, { count: 0, p50: null, p95: null, p99: null, averageMs: null });
});

test("negative and NaN samples are filtered out before computing percentiles", () => {
  const result = computeLatencyPercentiles([100, -5, NaN, 200]);
  assert.equal(result.count, 2);
});

test("nearest-rank percentiles match a hand-computed 1..100 series", () => {
  const samples = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
  const result = computeLatencyPercentiles(samples);
  assert.equal(result.count, 100);
  assert.equal(result.p50, 50);
  assert.equal(result.p95, 95);
  assert.equal(result.p99, 99);
  assert.equal(result.averageMs, 50.5);
});

test("a single sample yields that same value for every percentile", () => {
  const result = computeLatencyPercentiles([42]);
  assert.equal(result.p50, 42);
  assert.equal(result.p95, 42);
  assert.equal(result.p99, 42);
  assert.equal(result.averageMs, 42);
});

test("percentiles are order-independent (unsorted input produces the same result as sorted input)", () => {
  const unsorted = [30, 10, 50, 20, 40];
  const sorted = [10, 20, 30, 40, 50];
  assert.deepEqual(computeLatencyPercentiles(unsorted), computeLatencyPercentiles(sorted));
});
