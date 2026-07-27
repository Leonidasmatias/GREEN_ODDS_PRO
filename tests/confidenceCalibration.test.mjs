import test from "node:test";
import assert from "node:assert/strict";
import { computeConfidenceReliability, computeGreenScoreCalibration } from "../src/services/prediction-quality/ConfidenceCalibration.ts";

function record(matchId, { predictedOutcome = "HOME_WIN", actualOutcome = "HOME_WIN", confidence = 70, greenScoreValue = 60, greenScoreCategory = "HIGH" }) {
  return {
    matchId,
    homePlayerId: "home",
    awayPlayerId: "away",
    league: null,
    period: null,
    result: {
      prediction: { probabilities: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 }, predictedOutcome, topProbability: 0.6 },
      confidence,
      greenScore: { score: greenScoreValue, category: greenScoreCategory },
    },
    actualOutcome,
  };
}

test("computeConfidenceReliability buckets records by confidence and computes observed accuracy per bucket", () => {
  const records = [
    record("m1", { confidence: 25, predictedOutcome: "HOME_WIN", actualOutcome: "DRAW" }),
    record("m2", { confidence: 85, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" }),
  ];
  const result = computeConfidenceReliability(records, 10, 1);
  const lowBucket = result.buckets.find((b) => b.sampleSize > 0 && b.bucketStart === 20);
  const highBucket = result.buckets.find((b) => b.sampleSize > 0 && b.bucketStart === 80);
  assert.equal(lowBucket.observedAccuracy, 0);
  assert.equal(highBucket.observedAccuracy, 1);
});

test("a confidence of exactly 100 falls in the last (inclusive) bucket", () => {
  const records = [record("m1", { confidence: 100 })];
  const result = computeConfidenceReliability(records, 10, 1);
  assert.equal(result.buckets[9].sampleSize, 1);
});

test("empty records yield all-zero buckets and isMonotonic true (vacuously)", () => {
  const result = computeConfidenceReliability([], 10, 1);
  for (const bucket of result.buckets) {
    assert.equal(bucket.sampleSize, 0);
    assert.equal(bucket.averageConfidence, 0);
    assert.equal(bucket.observedAccuracy, 0);
  }
  assert.equal(result.isMonotonic, true);
});

test("higher confidence genuinely predicting more correctness is detected as monotonic", () => {
  const records = [];
  for (let i = 0; i < 10; i += 1) records.push(record(`low${i}`, { confidence: 15, actualOutcome: i < 8 ? "DRAW" : "HOME_WIN" }));
  for (let i = 0; i < 10; i += 1) records.push(record(`high${i}`, { confidence: 85, actualOutcome: "HOME_WIN" }));
  const result = computeConfidenceReliability(records, 10, 5);
  assert.equal(result.isMonotonic, true);
});

test("a confidence tier that performs worse than a lower tier is detected as non-monotonic", () => {
  const records = [];
  for (let i = 0; i < 10; i += 1) records.push(record(`low${i}`, { confidence: 15, actualOutcome: "HOME_WIN" }));
  for (let i = 0; i < 10; i += 1) records.push(record(`high${i}`, { confidence: 85, actualOutcome: i < 8 ? "DRAW" : "HOME_WIN" }));
  const result = computeConfidenceReliability(records, 10, 5);
  assert.equal(result.isMonotonic, false);
});

test("buckets below the minimum sample size are excluded from the monotonicity check but still reported", () => {
  const records = [
    record("m1", { confidence: 15, actualOutcome: "HOME_WIN" }), // single noisy low-confidence record, 100% "accuracy"
  ];
  for (let i = 0; i < 10; i += 1) records.push(record(`high${i}`, { confidence: 85, actualOutcome: "HOME_WIN" }));
  const result = computeConfidenceReliability(records, 10, 5);
  const lowBucket = result.buckets.find((b) => b.bucketStart === 10);
  assert.equal(lowBucket.sampleSize, 1);
  // Despite the low bucket having a "perfect" 100% accuracy with n=1, it's
  // excluded from the monotonicity comparison (below minSampleSize), so
  // the well-supported high-confidence bucket alone determines the result.
  assert.equal(result.isMonotonic, true);
});

test("computeGreenScoreCalibration buckets by the four fixed categories in LOW/MEDIUM/HIGH/VERY_HIGH order", () => {
  const result = computeGreenScoreCalibration([], 1);
  assert.deepEqual(
    result.buckets.map((b) => b.category),
    ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"],
  );
});

test("HIGH green score genuinely predicting more correctness than LOW is detected as monotonic", () => {
  const records = [];
  for (let i = 0; i < 10; i += 1) records.push(record(`low${i}`, { greenScoreCategory: "LOW", actualOutcome: i < 8 ? "DRAW" : "HOME_WIN" }));
  for (let i = 0; i < 10; i += 1) records.push(record(`high${i}`, { greenScoreCategory: "HIGH", actualOutcome: "HOME_WIN" }));
  const result = computeGreenScoreCalibration(records, 5);
  assert.equal(result.isMonotonic, true);
});

test("a LOW category outperforming a HIGHER category is detected as non-monotonic", () => {
  const records = [];
  for (let i = 0; i < 10; i += 1) records.push(record(`low${i}`, { greenScoreCategory: "LOW", actualOutcome: "HOME_WIN" }));
  for (let i = 0; i < 10; i += 1) records.push(record(`high${i}`, { greenScoreCategory: "HIGH", actualOutcome: i < 8 ? "DRAW" : "HOME_WIN" }));
  const result = computeGreenScoreCalibration(records, 5);
  assert.equal(result.isMonotonic, false);
});

test("categories with no records at all are excluded from the monotonicity comparison but reported with sampleSize 0", () => {
  const records = [];
  for (let i = 0; i < 10; i += 1) records.push(record(`m${i}`, { greenScoreCategory: "HIGH", actualOutcome: "HOME_WIN" }));
  const result = computeGreenScoreCalibration(records, 5);
  const mediumBucket = result.buckets.find((b) => b.category === "MEDIUM");
  assert.equal(mediumBucket.sampleSize, 0);
  assert.equal(result.isMonotonic, true);
});

test("is deterministic for identical input", () => {
  const records = [record("m1", { confidence: 60, greenScoreCategory: "MEDIUM", actualOutcome: "DRAW" })];
  assert.deepEqual(computeConfidenceReliability(records, 10, 5), computeConfidenceReliability(records, 10, 5));
  assert.deepEqual(computeGreenScoreCalibration(records, 5), computeGreenScoreCalibration(records, 5));
});
