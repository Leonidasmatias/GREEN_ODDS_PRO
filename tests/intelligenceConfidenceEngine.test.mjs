import test from "node:test";
import assert from "node:assert/strict";
import { calculateConfidence } from "../src/services/intelligence/ConfidenceEngine.ts";

test("zero matches, zero H2H, zero form yields zero confidence", () => {
  const result = calculateConfidence({ matchesCount: 0, h2hMatchesCount: 0, formMatchesCount: 0 });
  assert.equal(result.confidenceScore, 0);
  assert.equal(result.breakdown.matchesFactor, 0);
  assert.equal(result.breakdown.h2hFactor, 0);
  assert.equal(result.breakdown.formFactor, 0);
});

test("meeting every sample target exactly yields full confidence", () => {
  const result = calculateConfidence({ matchesCount: 20, h2hMatchesCount: 5, formMatchesCount: 10 });
  assert.equal(result.confidenceScore, 100);
  assert.equal(result.breakdown.matchesFactor, 100);
  assert.equal(result.breakdown.h2hFactor, 100);
  assert.equal(result.breakdown.formFactor, 100);
});

test("exceeding sample targets never pushes confidence above 100", () => {
  const result = calculateConfidence({ matchesCount: 500, h2hMatchesCount: 50, formMatchesCount: 100 });
  assert.equal(result.confidenceScore, 100);
  assert.equal(result.breakdown.matchesFactor, 100);
  assert.equal(result.breakdown.h2hFactor, 100);
  assert.equal(result.breakdown.formFactor, 100);
});

test("1 match's worth of history (out of 20 target) contributes a small partial score", () => {
  const result = calculateConfidence({ matchesCount: 1, h2hMatchesCount: 0, formMatchesCount: 0 });
  assert.ok(result.confidenceScore > 0 && result.confidenceScore < 10);
});

test("matches-only progress (half of target, no H2H or form) matches the documented weight", () => {
  const result = calculateConfidence({ matchesCount: 10, h2hMatchesCount: 0, formMatchesCount: 0 });
  // matchesFactor = 50, weight 0.5 -> contributes 25 to the total, others contribute 0.
  assert.equal(result.breakdown.matchesFactor, 50);
  assert.equal(result.confidenceScore, 25);
});

test("5 matches worth of H2H (full H2H target) alone contributes the documented 20% weight", () => {
  const result = calculateConfidence({ matchesCount: 0, h2hMatchesCount: 5, formMatchesCount: 0 });
  assert.equal(result.breakdown.h2hFactor, 100);
  assert.equal(result.confidenceScore, 20);
});

test("10 matches of form (full form target) alone contributes the documented 30% weight", () => {
  const result = calculateConfidence({ matchesCount: 0, h2hMatchesCount: 0, formMatchesCount: 10 });
  assert.equal(result.breakdown.formFactor, 100);
  assert.equal(result.confidenceScore, 30);
});

test("confidence score is always an integer within 0..100", () => {
  const samples = [
    { matchesCount: 3, h2hMatchesCount: 1, formMatchesCount: 4 },
    { matchesCount: 20, h2hMatchesCount: 0, formMatchesCount: 10 },
    { matchesCount: 7, h2hMatchesCount: 7, formMatchesCount: 7 },
  ];
  for (const input of samples) {
    const result = calculateConfidence(input);
    assert.equal(Number.isInteger(result.confidenceScore), true);
    assert.ok(result.confidenceScore >= 0 && result.confidenceScore <= 100);
  }
});
