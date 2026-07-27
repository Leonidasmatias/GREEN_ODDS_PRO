import test from "node:test";
import assert from "node:assert/strict";
import { computeAccuracyMetrics } from "../src/services/prediction-quality/AccuracyMetrics.ts";

function predictionResult(predictedOutcome) {
  return { prediction: { probabilities: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 }, predictedOutcome, topProbability: 0.6 }, confidence: 70, greenScore: { score: 60, category: "HIGH" } };
}

function record(matchId, predictedOutcome, actualOutcome) {
  return {
    matchId,
    homePlayerId: "home",
    awayPlayerId: "away",
    league: null,
    period: null,
    result: predictionResult(predictedOutcome),
    actualOutcome,
  };
}

test("empty records list yields zeroed accuracy without throwing", () => {
  const result = computeAccuracyMetrics([]);
  assert.equal(result.sampleSize, 0);
  assert.equal(result.accuracy, 0);
  assert.equal(result.macroPrecision, 0);
  assert.equal(result.macroRecall, 0);
});

test("all predictions correct yields accuracy 1 and perfect per-class precision/recall", () => {
  const records = [
    record("m1", "HOME_WIN", "HOME_WIN"),
    record("m2", "DRAW", "DRAW"),
    record("m3", "AWAY_WIN", "AWAY_WIN"),
  ];
  const result = computeAccuracyMetrics(records);
  assert.equal(result.accuracy, 1);
  assert.equal(result.macroPrecision, 1);
  assert.equal(result.macroRecall, 1);
  for (const metric of result.perClass) {
    assert.equal(metric.precision, 1);
    assert.equal(metric.recall, 1);
  }
});

test("all predictions wrong yields accuracy 0", () => {
  const records = [
    record("m1", "AWAY_WIN", "HOME_WIN"),
    record("m2", "HOME_WIN", "DRAW"),
    record("m3", "DRAW", "AWAY_WIN"),
  ];
  const result = computeAccuracyMetrics(records);
  assert.equal(result.accuracy, 0);
});

test("the confusion matrix counts (actual, predicted) pairs correctly", () => {
  const records = [
    record("m1", "HOME_WIN", "HOME_WIN"),
    record("m2", "HOME_WIN", "HOME_WIN"),
    record("m3", "DRAW", "HOME_WIN"),
    record("m4", "AWAY_WIN", "AWAY_WIN"),
  ];
  const result = computeAccuracyMetrics(records);
  // record("m3", "DRAW", "HOME_WIN") means predicted=DRAW, actual=HOME_WIN,
  // so it belongs at confusionMatrix[actual=HOME_WIN][predicted=DRAW].
  assert.equal(result.confusionMatrix.HOME_WIN.HOME_WIN, 2);
  assert.equal(result.confusionMatrix.HOME_WIN.DRAW, 1);
  assert.equal(result.confusionMatrix.AWAY_WIN.AWAY_WIN, 1);
  assert.equal(result.confusionMatrix.DRAW.DRAW, 0);
});

test("precision reflects false positives for a class that is over-predicted", () => {
  // HOME_WIN predicted 3 times, but only 1 of those was actually a home win.
  const records = [
    record("m1", "HOME_WIN", "HOME_WIN"),
    record("m2", "HOME_WIN", "DRAW"),
    record("m3", "HOME_WIN", "AWAY_WIN"),
  ];
  const result = computeAccuracyMetrics(records);
  const homeWinMetric = result.perClass.find((m) => m.outcome === "HOME_WIN");
  assert.equal(homeWinMetric.truePositives, 1);
  assert.equal(homeWinMetric.falsePositives, 2);
  assert.ok(Math.abs(homeWinMetric.precision - 1 / 3) < 1e-9);
});

test("recall reflects false negatives for a class that is under-predicted", () => {
  // HOME_WIN actually happened 3 times, but was only predicted correctly once.
  const records = [
    record("m1", "HOME_WIN", "HOME_WIN"),
    record("m2", "DRAW", "HOME_WIN"),
    record("m3", "AWAY_WIN", "HOME_WIN"),
  ];
  const result = computeAccuracyMetrics(records);
  const homeWinMetric = result.perClass.find((m) => m.outcome === "HOME_WIN");
  assert.equal(homeWinMetric.truePositives, 1);
  assert.equal(homeWinMetric.falseNegatives, 2);
  assert.equal(homeWinMetric.support, 3);
  assert.ok(Math.abs(homeWinMetric.recall - 1 / 3) < 1e-9);
});

test("a class with zero predictions has precision 0 (not NaN) and support reflects its true occurrence", () => {
  const records = [record("m1", "DRAW", "HOME_WIN"), record("m2", "AWAY_WIN", "DRAW")];
  const result = computeAccuracyMetrics(records);
  const homeWinMetric = result.perClass.find((m) => m.outcome === "HOME_WIN");
  assert.equal(homeWinMetric.truePositives, 0);
  assert.equal(homeWinMetric.falsePositives, 0);
  assert.equal(homeWinMetric.precision, 0);
  assert.equal(Number.isNaN(homeWinMetric.precision), false);
  assert.equal(homeWinMetric.support, 1);
});

test("a class that never actually occurs has recall 0 (not NaN) and support 0", () => {
  const records = [record("m1", "HOME_WIN", "HOME_WIN"), record("m2", "DRAW", "DRAW")];
  const result = computeAccuracyMetrics(records);
  const awayWinMetric = result.perClass.find((m) => m.outcome === "AWAY_WIN");
  assert.equal(awayWinMetric.support, 0);
  assert.equal(awayWinMetric.recall, 0);
  assert.equal(Number.isNaN(awayWinMetric.recall), false);
});

test("macroPrecision/macroRecall are the simple average across all three classes", () => {
  const records = [
    record("m1", "HOME_WIN", "HOME_WIN"),
    record("m2", "DRAW", "DRAW"),
    record("m3", "HOME_WIN", "AWAY_WIN"),
  ];
  const result = computeAccuracyMetrics(records);
  const expectedMacroPrecision = result.perClass.reduce((sum, m) => sum + m.precision, 0) / 3;
  const expectedMacroRecall = result.perClass.reduce((sum, m) => sum + m.recall, 0) / 3;
  assert.ok(Math.abs(result.macroPrecision - expectedMacroPrecision) < 1e-9);
  assert.ok(Math.abs(result.macroRecall - expectedMacroRecall) < 1e-9);
});

test("perClass always contains exactly the three outcomes, in a fixed order", () => {
  const result = computeAccuracyMetrics([record("m1", "HOME_WIN", "HOME_WIN")]);
  assert.deepEqual(
    result.perClass.map((m) => m.outcome),
    ["HOME_WIN", "DRAW", "AWAY_WIN"],
  );
});

test("is deterministic for identical input", () => {
  const records = [record("m1", "HOME_WIN", "DRAW"), record("m2", "AWAY_WIN", "AWAY_WIN")];
  assert.deepEqual(computeAccuracyMetrics(records), computeAccuracyMetrics(records));
});
