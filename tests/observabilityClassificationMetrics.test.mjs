import test from "node:test";
import assert from "node:assert/strict";
import { analyzeClassificationMetrics } from "../src/services/observability/ClassificationMetrics.ts";

test("empty sample yields all-zero metrics without dividing by zero", () => {
  const result = analyzeClassificationMetrics([]);
  assert.equal(result.totalCount, 0);
  assert.equal(result.classificationConfidenceScore, 0);
});

test("all confirmed_esoccer yields confidence score of exactly 1", () => {
  const results = [
    { classification: "confirmed_esoccer", evidence: [] },
    { classification: "confirmed_esoccer", evidence: [] },
  ];
  const result = analyzeClassificationMetrics(results);
  assert.equal(result.confirmedEsoccer, 2);
  assert.equal(result.confirmedRatio, 1);
  assert.equal(result.classificationConfidenceScore, 1);
});

test("a mix of confirmed/probable/unknown/not_esoccer computes the documented weighted average", () => {
  const results = [
    { classification: "confirmed_esoccer", evidence: [] },
    { classification: "probable_esoccer", evidence: [] },
    { classification: "unknown", evidence: [] },
    { classification: "not_esoccer", evidence: [] },
  ];
  const result = analyzeClassificationMetrics(results);
  assert.equal(result.totalCount, 4);
  assert.equal(result.confirmedEsoccer, 1);
  assert.equal(result.probableEsoccer, 1);
  assert.equal(result.unknown, 1);
  assert.equal(result.notEsoccer, 1);
  // weighted sum = 1*1.0 + 1*0.5 + 1*0 + 1*0 = 1.5 ; / 4 = 0.375
  assert.ok(Math.abs(result.classificationConfidenceScore - 0.375) < 1e-9);
});
