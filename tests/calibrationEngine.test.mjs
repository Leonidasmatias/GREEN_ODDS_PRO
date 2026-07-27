import test from "node:test";
import assert from "node:assert/strict";
import { computeBrierScore, computeBrierScoreReport, computeLogLoss, computeCalibrationCurve } from "../src/services/prediction-quality/CalibrationEngine.ts";

function predictionResult({ homeWin, draw, awayWin, predictedOutcome, confidence = 70, greenScoreValue = 60, greenScoreCategory = "HIGH" }) {
  const probabilities = { homeWin, draw, awayWin };
  const topProbability = predictedOutcome ? probabilities[{ HOME_WIN: "homeWin", DRAW: "draw", AWAY_WIN: "awayWin" }[predictedOutcome]] : Math.max(homeWin, draw, awayWin);
  return {
    prediction: { probabilities, predictedOutcome: predictedOutcome ?? "HOME_WIN", topProbability },
    confidence,
    greenScore: { score: greenScoreValue, category: greenScoreCategory },
  };
}

function record(matchId, { homeWin, draw, awayWin, predictedOutcome, actualOutcome, homePlayerId = "home", awayPlayerId = "away", league = null, period = null }) {
  return {
    matchId,
    homePlayerId,
    awayPlayerId,
    league,
    period,
    result: predictionResult({ homeWin, draw, awayWin, predictedOutcome }),
    actualOutcome,
  };
}

test("brier score is 0 for a perfect, fully-confident correct prediction", () => {
  const r = record("m1", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" });
  assert.equal(computeBrierScore([r]), 0);
});

test("brier score is 2 for a fully-confident wrong prediction (the worst possible score)", () => {
  const r = record("m1", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "AWAY_WIN" });
  assert.equal(computeBrierScore([r]), 2);
});

test("brier score for a uniform (1/3, 1/3, 1/3) prediction matches the known textbook value", () => {
  const r = record("m1", { homeWin: 1 / 3, draw: 1 / 3, awayWin: 1 / 3, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" });
  // (1/3-1)^2 + (1/3-0)^2 + (1/3-0)^2 = 4/9 + 1/9 + 1/9 = 6/9 = 2/3
  assert.ok(Math.abs(computeBrierScore([r]) - 2 / 3) < 1e-9);
});

test("brier score is the average across multiple records", () => {
  const perfect = record("m1", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" });
  const worst = record("m2", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "AWAY_WIN" });
  assert.equal(computeBrierScore([perfect, worst]), 1);
});

test("brier score is 0 for an empty list", () => {
  assert.equal(computeBrierScore([]), 0);
});

test("log loss is close to 0 for a highly confident correct prediction", () => {
  const r = record("m1", { homeWin: 0.999, draw: 0.0005, awayWin: 0.0005, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" });
  assert.ok(computeLogLoss([r]) < 0.01);
});

test("log loss is large (but finite) for a confidently wrong prediction, never Infinity", () => {
  const r = record("m1", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "AWAY_WIN" });
  const loss = computeLogLoss([r]);
  assert.ok(Number.isFinite(loss));
  assert.ok(loss > 10);
});

test("log loss for a uniform (1/3,1/3,1/3) prediction matches -ln(1/3)", () => {
  const r = record("m1", { homeWin: 1 / 3, draw: 1 / 3, awayWin: 1 / 3, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" });
  assert.ok(Math.abs(computeLogLoss([r]) - (-Math.log(1 / 3))) < 1e-9);
});

test("log loss is 0 for an empty list", () => {
  assert.equal(computeLogLoss([]), 0);
});

test("computeBrierScoreReport groups by player (each match counted for both home and away), league, and period", () => {
  const records = [
    record("m1", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN", homePlayerId: "alice", awayPlayerId: "bob", league: "league-a", period: "2026-07" }),
    record("m2", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "AWAY_WIN", homePlayerId: "carol", awayPlayerId: "bob", league: "league-b", period: "2026-08" }),
    // A second league-a match, to exercise appending to an already-existing group key.
    record("m3", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN", homePlayerId: "dave", awayPlayerId: "erin", league: "league-a", period: "2026-07" }),
  ];
  const report = computeBrierScoreReport(records);
  assert.ok(Math.abs(report.global - 2 / 3) < 1e-9); // (0 + 2 + 0) / 3

  const bobEntry = report.byPlayer.find((e) => e.key === "bob");
  assert.equal(bobEntry.sampleSize, 2);
  assert.equal(bobEntry.value, 1);

  const aliceEntry = report.byPlayer.find((e) => e.key === "alice");
  assert.equal(aliceEntry.sampleSize, 1);
  assert.equal(aliceEntry.value, 0);

  const leagueAEntry = report.byLeague.find((e) => e.key === "league-a");
  assert.equal(leagueAEntry.sampleSize, 2);
  assert.equal(leagueAEntry.value, 0);
  assert.equal(report.byLeague.find((e) => e.key === "league-b").value, 2);

  const periodJulyEntry = report.byPeriod.find((e) => e.key === "2026-07");
  assert.equal(periodJulyEntry.sampleSize, 2);
  assert.equal(report.byPeriod.length, 2);
});

test("computeBrierScoreReport excludes null league/period from their respective groupings", () => {
  const records = [record("m1", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN", league: null, period: null })];
  const report = computeBrierScoreReport(records);
  assert.equal(report.byLeague.length, 0);
  assert.equal(report.byPeriod.length, 0);
  assert.equal(report.byPlayer.length, 2);
});

test("calibration curve assigns a record to the bucket matching its topProbability", () => {
  const r = record("m1", { homeWin: 0.75, draw: 0.15, awayWin: 0.1, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" });
  const curve = computeCalibrationCurve([r], 10);
  const bucket = curve.buckets.find((b) => b.sampleSize > 0);
  assert.ok(bucket);
  assert.ok(0.75 >= bucket.bucketStart && 0.75 < bucket.bucketEnd);
  assert.equal(bucket.observedAccuracy, 1);
  assert.ok(Math.abs(bucket.averagePredictedProbability - 0.75) < 1e-9);
});

test("calibration curve: a topProbability of exactly 1.0 falls in the last (inclusive) bucket", () => {
  const r = record("m1", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" });
  const curve = computeCalibrationCurve([r], 10);
  assert.equal(curve.buckets[9].sampleSize, 1);
});

test("calibration curve: empty buckets report 0, never NaN", () => {
  const curve = computeCalibrationCurve([], 10);
  for (const bucket of curve.buckets) {
    assert.equal(bucket.sampleSize, 0);
    assert.equal(bucket.averagePredictedProbability, 0);
    assert.equal(bucket.observedAccuracy, 0);
    assert.equal(bucket.calibrationError, 0);
  }
  assert.equal(curve.expectedCalibrationError, 0);
});

test("expectedCalibrationError is the sample-weighted average of per-bucket calibration error", () => {
  // Two records both land in the 70-80% bucket (topProbability 0.75); one
  // correct, one wrong -> observedAccuracy 0.5 vs averagePredictedProbability 0.75.
  const records = [
    record("m1", { homeWin: 0.75, draw: 0.15, awayWin: 0.1, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" }),
    record("m2", { homeWin: 0.75, draw: 0.15, awayWin: 0.1, predictedOutcome: "HOME_WIN", actualOutcome: "AWAY_WIN" }),
  ];
  const curve = computeCalibrationCurve(records, 10);
  const bucket = curve.buckets.find((b) => b.sampleSize === 2);
  assert.ok(Math.abs(bucket.observedAccuracy - 0.5) < 1e-9);
  assert.ok(Math.abs(bucket.calibrationError - 0.25) < 1e-9);
  assert.ok(Math.abs(curve.expectedCalibrationError - bucket.calibrationError) < 1e-9);
});

test("is deterministic for identical input", () => {
  const records = [record("m1", { homeWin: 0.6, draw: 0.25, awayWin: 0.15, predictedOutcome: "HOME_WIN", actualOutcome: "DRAW" })];
  assert.deepEqual(computeBrierScoreReport(records), computeBrierScoreReport(records));
  assert.deepEqual(computeCalibrationCurve(records, 10), computeCalibrationCurve(records, 10));
});
