import test from "node:test";
import assert from "node:assert/strict";
import { computeOutcomeProbabilities } from "../src/services/prediction/PredictionNormalizer.ts";

function sum(probabilities) {
  return probabilities.homeWin + probabilities.draw + probabilities.awayWin;
}

test("probabilities always sum to 1 within Number.EPSILON", () => {
  for (let i = 0; i < 5000; i += 1) {
    const logits = {
      home: (Math.random() - 0.5) * 40,
      draw: (Math.random() - 0.5) * 40,
      away: (Math.random() - 0.5) * 40,
    };
    const result = computeOutcomeProbabilities(logits);
    assert.ok(Math.abs(sum(result) - 1) <= Number.EPSILON, `sum=${sum(result)} for logits=${JSON.stringify(logits)}`);
  }
});

test("no probability is ever negative", () => {
  for (let i = 0; i < 5000; i += 1) {
    const logits = {
      home: (Math.random() - 0.5) * 40,
      draw: (Math.random() - 0.5) * 40,
      away: (Math.random() - 0.5) * 40,
    };
    const result = computeOutcomeProbabilities(logits);
    assert.ok(result.homeWin >= 0 && result.draw >= 0 && result.awayWin >= 0);
  }
});

test("no probability ever exceeds 1", () => {
  for (let i = 0; i < 5000; i += 1) {
    const logits = {
      home: (Math.random() - 0.5) * 40,
      draw: (Math.random() - 0.5) * 40,
      away: (Math.random() - 0.5) * 40,
    };
    const result = computeOutcomeProbabilities(logits);
    assert.ok(result.homeWin <= 1 && result.draw <= 1 && result.awayWin <= 1);
  }
});

test("equal logits produce a balanced distribution (each within 1 ULP of 1/3)", () => {
  const result = computeOutcomeProbabilities({ home: 3, draw: 3, away: 3 });
  assert.ok(Math.abs(result.homeWin - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(result.draw - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(result.awayWin - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(sum(result) - 1) <= Number.EPSILON);
});

test("zero logits (no information) produce a balanced distribution (each within 1 ULP of 1/3)", () => {
  const result = computeOutcomeProbabilities({ home: 0, draw: 0, away: 0 });
  assert.ok(Math.abs(result.homeWin - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(result.draw - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(result.awayWin - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(sum(result) - 1) <= Number.EPSILON);
});

test("extreme logits do not overflow and remain finite", () => {
  const result = computeOutcomeProbabilities({ home: 1e6, draw: -1e6, away: 500 });
  assert.ok(Number.isFinite(result.homeWin));
  assert.ok(Number.isFinite(result.draw));
  assert.ok(Number.isFinite(result.awayWin));
  assert.ok(Math.abs(sum(result) - 1) <= Number.EPSILON);
  assert.ok(result.homeWin > result.draw);
  assert.ok(result.homeWin > result.awayWin);
});

test("moderately separated extreme logits preserve relative ranking", () => {
  const result = computeOutcomeProbabilities({ home: 60, draw: 10, away: -60 });
  assert.ok(Number.isFinite(result.homeWin));
  assert.ok(Number.isFinite(result.draw));
  assert.ok(Number.isFinite(result.awayWin));
  assert.ok(Math.abs(sum(result) - 1) <= Number.EPSILON);
  assert.ok(result.homeWin > result.draw);
  assert.ok(result.draw > result.awayWin);
});

test("extreme negative logits on all sides do not produce NaN", () => {
  const result = computeOutcomeProbabilities({ home: -1e10, draw: -1e10, away: -1e10 });
  assert.ok(Number.isFinite(result.homeWin));
  assert.ok(Math.abs(sum(result) - 1) <= Number.EPSILON);
});

test("a dominant home logit yields overwhelming home probability", () => {
  const result = computeOutcomeProbabilities({ home: 50, draw: 0, away: -50 });
  assert.ok(result.homeWin > 0.999);
});

test("NaN logits are neutralized to 0 rather than propagated", () => {
  const result = computeOutcomeProbabilities({ home: Number.NaN, draw: 0, away: 0 });
  assert.ok(Number.isFinite(result.homeWin));
  assert.ok(Number.isFinite(result.draw));
  assert.ok(Number.isFinite(result.awayWin));
  assert.ok(Math.abs(result.homeWin - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(result.draw - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(result.awayWin - 1 / 3) <= Number.EPSILON);
});

test("+Infinity and -Infinity logits are neutralized to 0 rather than propagated", () => {
  const result = computeOutcomeProbabilities({ home: Number.POSITIVE_INFINITY, draw: Number.NEGATIVE_INFINITY, away: 0 });
  assert.ok(Number.isFinite(result.homeWin));
  assert.ok(Number.isFinite(result.draw));
  assert.ok(Number.isFinite(result.awayWin));
  assert.ok(Math.abs(sum(result) - 1) <= Number.EPSILON);
});

test("all three logits invalid falls back to a balanced three-way split", () => {
  const result = computeOutcomeProbabilities({ home: Number.NaN, draw: Number.POSITIVE_INFINITY, away: Number.NEGATIVE_INFINITY });
  assert.ok(Math.abs(result.homeWin - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(result.draw - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(result.awayWin - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(sum(result) - 1) <= Number.EPSILON);
});

test("is deterministic for the same input", () => {
  const logits = { home: 1.234, draw: -0.5, away: 0.87 };
  const first = computeOutcomeProbabilities(logits);
  const second = computeOutcomeProbabilities(logits);
  assert.deepEqual(first, second);
});
