import test from "node:test";
import assert from "node:assert/strict";
import { poissonProbability, buildPoissonDistribution, sanitizeLambda } from "../src/services/goal-distribution/PoissonDistribution.ts";

function factorial(n) {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

function referencePoisson(lambda, k) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

test("sanitizeLambda clamps into [min, max]", () => {
  assert.equal(sanitizeLambda(3, 0.05, 6), 3);
  assert.equal(sanitizeLambda(10, 0.05, 6), 6);
  assert.equal(sanitizeLambda(0.001, 0.05, 6), 0.05);
});

test("sanitizeLambda treats NaN/Infinity as absent signal, falling back to minLambda", () => {
  assert.equal(sanitizeLambda(Number.NaN, 0.05, 6), 0.05);
  assert.equal(sanitizeLambda(Number.POSITIVE_INFINITY, 0.05, 6), 0.05);
  assert.equal(sanitizeLambda(Number.NEGATIVE_INFINITY, 0.05, 6), 0.05);
});

test("poissonProbability matches the textbook formula for small lambda", () => {
  const lambda = 0.5;
  for (let k = 0; k <= 5; k += 1) {
    assert.ok(Math.abs(poissonProbability(lambda, k) - referencePoisson(lambda, k)) < 1e-9);
  }
});

test("poissonProbability matches the textbook formula for typical lambda", () => {
  const lambda = 1.5;
  for (let k = 0; k <= 8; k += 1) {
    assert.ok(Math.abs(poissonProbability(lambda, k) - referencePoisson(lambda, k)) < 1e-9);
  }
});

test("poissonProbability matches the textbook formula for high lambda", () => {
  const lambda = 5;
  for (let k = 0; k <= 12; k += 1) {
    assert.ok(Math.abs(poissonProbability(lambda, k) - referencePoisson(lambda, k)) < 1e-8);
  }
});

test("poissonProbability at k=0 equals exp(-lambda)", () => {
  assert.ok(Math.abs(poissonProbability(2.3, 0) - Math.exp(-2.3)) < 1e-12);
});

test("poissonProbability at a large k does not overflow or produce NaN", () => {
  const p = poissonProbability(3, 200);
  assert.ok(Number.isFinite(p));
  assert.ok(p >= 0);
});

test("poissonProbability rejects negative or non-integer k", () => {
  assert.equal(poissonProbability(2, -1), 0);
  assert.equal(poissonProbability(2, 1.5), 0);
  assert.equal(poissonProbability(2, Number.NaN), 0);
});

test("poissonProbability sanitizes an invalid lambda instead of returning NaN", () => {
  const p = poissonProbability(Number.NaN, 2, 0.05, 6);
  assert.ok(Number.isFinite(p));
  assert.ok(p >= 0);
});

test("buildPoissonDistribution returns maxGoals+1 entries with sequential goal counts", () => {
  const dist = buildPoissonDistribution(1.5, 10);
  assert.equal(dist.length, 11);
  dist.forEach((entry, index) => assert.equal(entry.goals, index));
});

test("buildPoissonDistribution probabilities are never negative", () => {
  for (const lambda of [0.01, 0.5, 1.5, 3, 6]) {
    const dist = buildPoissonDistribution(lambda, 10);
    for (const entry of dist) assert.ok(entry.probability >= 0);
  }
});

test("buildPoissonDistribution probabilities are always finite", () => {
  const dist = buildPoissonDistribution(6, 15);
  for (const entry of dist) assert.ok(Number.isFinite(entry.probability));
});

test("buildPoissonDistribution is renormalized: truncated tail mass is redistributed so the sum is 1", () => {
  // A small maxGoals relative to lambda truncates meaningful tail mass;
  // the raw (un-renormalized) sum would be well below 1.
  const dist = buildPoissonDistribution(5, 3);
  const sum = dist.reduce((total, entry) => total + entry.probability, 0);
  assert.ok(Math.abs(sum - 1) <= Number.EPSILON * dist.length);
});

test("buildPoissonDistribution sums to 1 (within tolerance) across a wide range of lambdas", () => {
  for (const lambda of [0.05, 0.3, 1, 1.5, 3, 6, 10]) {
    const dist = buildPoissonDistribution(lambda, 10);
    const sum = dist.reduce((total, entry) => total + entry.probability, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `lambda=${lambda} sum=${sum}`);
  }
});

test("buildPoissonDistribution never produces NaN or Infinity even for an invalid lambda", () => {
  for (const lambda of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5, 0]) {
    const dist = buildPoissonDistribution(lambda, 10, 0.05, 6);
    for (const entry of dist) {
      assert.ok(Number.isFinite(entry.probability));
      assert.ok(entry.probability >= 0);
    }
  }
});

test("buildPoissonDistribution falls back to all mass at k=0 in the pathological case where the raw sum underflows to exactly 0", () => {
  // Forcing minLambda=maxLambda=1000 sanitizes lambda to 1000, at which
  // exp(-1000) underflows to a literal 0 in double precision, making
  // every term of the recurrence (and thus the raw sum) exactly 0 — the
  // safe fallback (all mass at k=0) must trigger instead of a 0/0 divide.
  const dist = buildPoissonDistribution(5, 5, 1000, 1000);
  assert.equal(dist.length, 6);
  assert.equal(dist[0].probability, 1);
  for (let k = 1; k < dist.length; k += 1) assert.equal(dist[k].probability, 0);
});

test("buildPoissonDistribution is deterministic for the same input", () => {
  const first = buildPoissonDistribution(2.2, 10);
  const second = buildPoissonDistribution(2.2, 10);
  assert.deepEqual(first, second);
});

test("a higher lambda shifts probability mass toward higher goal counts", () => {
  const low = buildPoissonDistribution(0.5, 10);
  const high = buildPoissonDistribution(4, 10);
  assert.ok(low[0].probability > high[0].probability);
  assert.ok(high[4].probability > low[4].probability);
});
