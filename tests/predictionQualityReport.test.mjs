import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionQualityReport } from "../src/services/prediction-quality/PredictionQualityReport.ts";
import { DEFAULT_PREDICTION_QUALITY_CONFIG, PredictionQualityConfigurationError } from "../src/services/prediction-quality/PredictionQualityConfig.ts";

function record(matchId, { predictedOutcome = "HOME_WIN", actualOutcome = "HOME_WIN", confidence = 70, greenScoreValue = 60, greenScoreCategory = "HIGH", homeWin = 0.6, draw = 0.25, awayWin = 0.15, homePlayerId = "home", awayPlayerId = "away", league = null, period = null } = {}) {
  return {
    matchId,
    homePlayerId,
    awayPlayerId,
    league,
    period,
    result: {
      prediction: { probabilities: { homeWin, draw, awayWin }, predictedOutcome, topProbability: Math.max(homeWin, draw, awayWin) },
      confidence,
      greenScore: { score: greenScoreValue, category: greenScoreCategory },
    },
    actualOutcome,
  };
}

const CONFIG = DEFAULT_PREDICTION_QUALITY_CONFIG;
const FIXED_NOW = () => new Date("2026-07-27T00:00:00.000Z");

test("assembles a complete report with all documented sections populated", () => {
  const records = Array.from({ length: 12 }, (_, i) => record(`m${i}`, { actualOutcome: i % 3 === 0 ? "DRAW" : "HOME_WIN" }));
  const report = buildPredictionQualityReport(records, CONFIG, FIXED_NOW);

  assert.equal(report.modelVersion, CONFIG.modelVersion);
  assert.equal(report.generatedAt, "2026-07-27T00:00:00.000Z");
  assert.equal(report.sampleSize, 12);
  assert.equal(report.validRecordCount, 12);
  assert.equal(report.invalidRecordCount, 0);
  assert.ok(report.accuracy);
  assert.ok(report.brierScore);
  assert.equal(typeof report.logLoss, "number");
  assert.ok(report.calibrationCurve);
  assert.ok(report.confidenceReliability);
  assert.ok(report.greenScoreCalibration);
  assert.ok(Array.isArray(report.warnings));
});

test("a sample below minSampleSizeForReport adds the insufficient_sample_size warning", () => {
  const records = [record("m1"), record("m2")];
  const report = buildPredictionQualityReport(records, CONFIG, FIXED_NOW);
  assert.ok(report.warnings.includes("insufficient_sample_size"));
});

test("a sample at or above minSampleSizeForReport never adds the insufficient_sample_size warning", () => {
  const records = Array.from({ length: CONFIG.minSampleSizeForReport }, (_, i) => record(`m${i}`));
  const report = buildPredictionQualityReport(records, CONFIG, FIXED_NOW);
  assert.equal(report.warnings.includes("insufficient_sample_size"), false);
});

test("invalid records are excluded from every metric and flagged via invalid_records_excluded", () => {
  const goodRecords = Array.from({ length: 10 }, (_, i) => record(`good${i}`));
  const badRecord = record("bad", { actualOutcome: "NOT_REAL" });
  const report = buildPredictionQualityReport([...goodRecords, badRecord], CONFIG, FIXED_NOW);

  assert.equal(report.sampleSize, 11);
  assert.equal(report.validRecordCount, 10);
  assert.equal(report.invalidRecordCount, 1);
  assert.equal(report.validationIssues.length, 1);
  assert.equal(report.validationIssues[0].matchId, "bad");
  assert.ok(report.warnings.includes("invalid_records_excluded"));
  assert.equal(report.accuracy.sampleSize, 10);
});

test("a non-monotonic confidence reliability adds its warning", () => {
  const records = [];
  for (let i = 0; i < 10; i += 1) records.push(record(`low${i}`, { confidence: 15, actualOutcome: "HOME_WIN" }));
  for (let i = 0; i < 10; i += 1) records.push(record(`high${i}`, { confidence: 85, actualOutcome: i < 8 ? "DRAW" : "HOME_WIN" }));
  const report = buildPredictionQualityReport(records, CONFIG, FIXED_NOW);
  assert.ok(report.warnings.includes("non_monotonic_confidence_reliability"));
});

test("a non-monotonic green score calibration adds its warning", () => {
  const records = [];
  for (let i = 0; i < 10; i += 1) records.push(record(`low${i}`, { greenScoreCategory: "LOW", actualOutcome: "HOME_WIN" }));
  for (let i = 0; i < 10; i += 1) records.push(record(`high${i}`, { greenScoreCategory: "HIGH", actualOutcome: i < 8 ? "DRAW" : "HOME_WIN" }));
  const report = buildPredictionQualityReport(records, CONFIG, FIXED_NOW);
  assert.ok(report.warnings.includes("non_monotonic_green_score_calibration"));
});

test("well-behaved data (monotonic confidence and green score, sufficient sample) produces no warnings", () => {
  const records = [];
  for (let i = 0; i < 10; i += 1) records.push(record(`low${i}`, { confidence: 15, greenScoreCategory: "LOW", actualOutcome: i < 6 ? "DRAW" : "HOME_WIN" }));
  for (let i = 0; i < 10; i += 1) records.push(record(`high${i}`, { confidence: 85, greenScoreCategory: "HIGH", actualOutcome: "HOME_WIN" }));
  const report = buildPredictionQualityReport(records, CONFIG, FIXED_NOW);
  assert.deepEqual(report.warnings, []);
});

test("generatedAt reflects the injected clock and never influences any metric", () => {
  const records = Array.from({ length: 10 }, (_, i) => record(`m${i}`));
  const first = buildPredictionQualityReport(records, CONFIG, () => new Date("2020-01-01T00:00:00.000Z"));
  const second = buildPredictionQualityReport(records, CONFIG, () => new Date("2030-06-15T08:30:00.000Z"));
  assert.equal(first.generatedAt, "2020-01-01T00:00:00.000Z");
  assert.equal(second.generatedAt, "2030-06-15T08:30:00.000Z");
  assert.equal(first.accuracy.accuracy, second.accuracy.accuracy);
  assert.deepEqual(first.brierScore, second.brierScore);
});

test("an invalid configuration throws PredictionQualityConfigurationError instead of silently producing a report", () => {
  const invalidConfig = { ...CONFIG, calibrationBucketCount: 0 };
  assert.throws(() => buildPredictionQualityReport([record("m1")], invalidConfig, FIXED_NOW), PredictionQualityConfigurationError);
});

test("never generates any betting-recommendation-shaped field (Kelly, stake, EV, odds, bookmaker, ROI)", () => {
  const records = Array.from({ length: 10 }, (_, i) => record(`m${i}`));
  const report = buildPredictionQualityReport(records, CONFIG, FIXED_NOW);
  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of ["kelly", "stake", "expectedvalue", " ev ", "odds", "bookmaker", "roi", "bankroll", "recommendation"]) {
    assert.equal(serialized.includes(forbidden), false, `unexpected "${forbidden}" in report output`);
  }
});

test("an empty records list produces a valid, zeroed report rather than throwing", () => {
  const report = buildPredictionQualityReport([], CONFIG, FIXED_NOW);
  assert.equal(report.sampleSize, 0);
  assert.equal(report.validRecordCount, 0);
  assert.ok(report.warnings.includes("insufficient_sample_size"));
});

test("using the default config and default clock (no explicit now) produces a valid report with a real, current-ish timestamp", () => {
  const records = Array.from({ length: 10 }, (_, i) => record(`m${i}`));
  const before = Date.now();
  const report = buildPredictionQualityReport(records);
  const after = Date.now();
  const generatedAtMs = new Date(report.generatedAt).getTime();
  assert.ok(generatedAtMs >= before && generatedAtMs <= after);
});

test("is deterministic for identical input", () => {
  const records = Array.from({ length: 10 }, (_, i) => record(`m${i}`, { actualOutcome: i % 2 === 0 ? "HOME_WIN" : "DRAW" }));
  const first = buildPredictionQualityReport(records, CONFIG, FIXED_NOW);
  const second = buildPredictionQualityReport(records, CONFIG, FIXED_NOW);
  assert.deepEqual(first, second);
});
