import test from "node:test";
import assert from "node:assert/strict";
import { compareLearningWindows, sliceBySequenceWindow } from "../src/services/prediction-learning/WindowComparisonEngine.ts";
import { DEFAULT_PREDICTION_LEARNING_CONFIG } from "../src/services/prediction-learning/PredictionLearningConfig.ts";

function record(matchId, overrides = {}) {
  return {
    matchId,
    homePlayerId: "home",
    awayPlayerId: "away",
    virtualTeamHome: null,
    virtualTeamAway: null,
    league: null,
    period: null,
    sequenceKey: null,
    predictedOutcome: "HOME_WIN",
    actualOutcome: "HOME_WIN",
    probabilities: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 },
    confidence: 70,
    greenScoreCategory: "HIGH",
    ...overrides,
  };
}

const CONFIG = { ...DEFAULT_PREDICTION_LEARNING_CONFIG, minimumRecordsPerWindow: 1 };

test("compares two windows defined by numeric sequenceKey", () => {
  const records = [
    record("m1", { sequenceKey: 1, actualOutcome: "HOME_WIN" }),
    record("m2", { sequenceKey: 2, actualOutcome: "HOME_WIN" }),
    record("m3", { sequenceKey: 10, actualOutcome: "AWAY_WIN" }),
    record("m4", { sequenceKey: 11, actualOutcome: "AWAY_WIN" }),
  ];
  const comparison = compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: 1, toSequenceKey: 2 },
    { label: "current", fromSequenceKey: 10, toSequenceKey: 11 },
    CONFIG,
  );
  assert.equal(comparison.baseline.validRecords, 2);
  assert.equal(comparison.current.validRecords, 2);
  assert.equal(comparison.status, "OK");
});

test("compares two windows defined by string sequenceKey", () => {
  const records = [
    record("m1", { sequenceKey: "2026-01-01" }),
    record("m2", { sequenceKey: "2026-01-02" }),
    record("m3", { sequenceKey: "2026-02-01" }),
  ];
  const comparison = compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: "2026-01-01", toSequenceKey: "2026-01-31" },
    { label: "current", fromSequenceKey: "2026-02-01", toSequenceKey: "2026-02-28" },
    CONFIG,
  );
  assert.equal(comparison.baseline.validRecords, 2);
  assert.equal(comparison.current.validRecords, 1);
});

test("rejects mixed sequenceKey types by producing empty windows with a MIXED_SEQUENCE_KEY_TYPES warning", () => {
  const records = [record("m1", { sequenceKey: 1 }), record("m2", { sequenceKey: "2026-01-01" })];
  const comparison = compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: null, toSequenceKey: null },
    { label: "current", fromSequenceKey: null, toSequenceKey: null },
    CONFIG,
  );
  assert.equal(comparison.baseline.validRecords, 0);
  assert.ok(comparison.baseline.warnings.some((w) => w.code === "MIXED_SEQUENCE_KEY_TYPES"));
});

test("an empty baseline window yields status EMPTY for that side", () => {
  const records = [record("m1", { sequenceKey: 10 })];
  const comparison = compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: 1, toSequenceKey: 5 },
    { label: "current", fromSequenceKey: 10, toSequenceKey: 15 },
    CONFIG,
  );
  assert.equal(comparison.baseline.status, "EMPTY");
  assert.equal(comparison.current.status, "OK");
  assert.equal(comparison.status, "EMPTY");
});

test("an empty current window yields status EMPTY for that side", () => {
  const records = [record("m1", { sequenceKey: 1 })];
  const comparison = compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: 1, toSequenceKey: 5 },
    { label: "current", fromSequenceKey: 10, toSequenceKey: 15 },
    CONFIG,
  );
  assert.equal(comparison.current.status, "EMPTY");
});

test("delta for accuracy is positive when accuracy improved (higher-is-better)", () => {
  const records = [
    record("m1", { sequenceKey: 1, predictedOutcome: "HOME_WIN", actualOutcome: "AWAY_WIN" }),
    record("m2", { sequenceKey: 10, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" }),
  ];
  const comparison = compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: 1, toSequenceKey: 1 },
    { label: "current", fromSequenceKey: 10, toSequenceKey: 10 },
    CONFIG,
  );
  const accuracyDelta = comparison.deltas.find((d) => d.metricName === "accuracy");
  assert.equal(accuracyDelta.direction, "HIGHER_IS_BETTER");
  assert.ok(accuracyDelta.absoluteDelta > 0);
});

test("delta for brierScore/logLoss uses lower-is-better direction", () => {
  const records = [record("m1", { sequenceKey: 1 }), record("m2", { sequenceKey: 10 })];
  const comparison = compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: 1, toSequenceKey: 1 },
    { label: "current", fromSequenceKey: 10, toSequenceKey: 10 },
    CONFIG,
  );
  assert.equal(comparison.deltas.find((d) => d.metricName === "brierScore").direction, "LOWER_IS_BETTER");
  assert.equal(comparison.deltas.find((d) => d.metricName === "logLoss").direction, "LOWER_IS_BETTER");
});

test("delta for averageConfidence uses the INFORMATIVE direction (never improvement/degradation)", () => {
  const records = [record("m1", { sequenceKey: 1, confidence: 30 }), record("m2", { sequenceKey: 10, confidence: 90 })];
  const comparison = compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: 1, toSequenceKey: 1 },
    { label: "current", fromSequenceKey: 10, toSequenceKey: 10 },
    CONFIG,
  );
  const confidenceDelta = comparison.deltas.find((d) => d.metricName === "averageConfidence");
  assert.equal(confidenceDelta.direction, "INFORMATIVE");
  assert.equal(confidenceDelta.absoluteDelta, 60);
});

test("computes exactly the six mandatory window delta metrics", () => {
  const records = [record("m1", { sequenceKey: 1 }), record("m2", { sequenceKey: 10 })];
  const comparison = compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: 1, toSequenceKey: 1 },
    { label: "current", fromSequenceKey: 10, toSequenceKey: 10 },
    CONFIG,
  );
  assert.deepEqual(
    comparison.deltas.map((d) => d.metricName).sort(),
    ["accuracy", "averageConfidence", "brierScore", "logLoss", "macroPrecision", "macroRecall"].sort(),
  );
});

test("records without a sequenceKey are excluded from every window (never fabricated position)", () => {
  const records = [record("m1", { sequenceKey: null }), record("m2", { sequenceKey: 1 })];
  const slice = sliceBySequenceWindow(records, { label: "baseline", fromSequenceKey: null, toSequenceKey: null });
  assert.equal(slice.records.length, 1);
  assert.equal(slice.records[0].matchId, "m2");
});

test("sliceBySequenceWindow with no records having any sequenceKey produces an empty slice with NO_SEQUENCE_KEY_PROVIDED warning", () => {
  const records = [record("m1", { sequenceKey: null }), record("m2", { sequenceKey: null })];
  const slice = sliceBySequenceWindow(records, { label: "baseline", fromSequenceKey: null, toSequenceKey: null });
  assert.equal(slice.records.length, 0);
  assert.ok(slice.warnings.some((w) => w.code === "NO_SEQUENCE_KEY_PROVIDED"));
});

test("percentageDifference (relativeDelta) is null when baselineValue is within tolerance of zero", () => {
  const config = { ...CONFIG, numericTolerance: 1e-6 };
  const records = [
    record("m1", { sequenceKey: 1, actualOutcome: "AWAY_WIN", probabilities: { homeWin: 1, draw: 0, awayWin: 0 } }),
    record("m2", { sequenceKey: 10, actualOutcome: "HOME_WIN", probabilities: { homeWin: 1, draw: 0, awayWin: 0 } }),
  ];
  const comparison = compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: 1, toSequenceKey: 1 },
    { label: "current", fromSequenceKey: 10, toSequenceKey: 10 },
    config,
  );
  const brierDelta = comparison.deltas.find((d) => d.metricName === "brierScore");
  // baseline brierScore for a fully-wrong prediction is 2, not near zero — pick accuracy instead (baseline=0).
  const accuracyDelta = comparison.deltas.find((d) => d.metricName === "accuracy");
  assert.equal(accuracyDelta.baselineValue, 0);
  assert.equal(accuracyDelta.relativeDelta, null);
  assert.ok(Number.isFinite(brierDelta.absoluteDelta));
});

test("does not mutate the input records array", () => {
  const records = [record("m1", { sequenceKey: 1 }), record("m2", { sequenceKey: 10 })];
  const snapshot = JSON.parse(JSON.stringify(records));
  compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: 1, toSequenceKey: 1 },
    { label: "current", fromSequenceKey: 10, toSequenceKey: 10 },
    CONFIG,
  );
  assert.deepEqual(records, snapshot);
});

test("is deterministic for identical input", () => {
  const records = [record("m1", { sequenceKey: 1 }), record("m2", { sequenceKey: 10 })];
  const baselineDef = { label: "baseline", fromSequenceKey: 1, toSequenceKey: 1 };
  const currentDef = { label: "current", fromSequenceKey: 10, toSequenceKey: 10 };
  assert.deepEqual(compareLearningWindows(records, baselineDef, currentDef, CONFIG), compareLearningWindows(records, baselineDef, currentDef, CONFIG));
});

test("overlapping windows are each computed independently from the same underlying records", () => {
  const records = [record("m1", { sequenceKey: 1 }), record("m2", { sequenceKey: 5 }), record("m3", { sequenceKey: 10 })];
  const comparison = compareLearningWindows(
    records,
    { label: "baseline", fromSequenceKey: 1, toSequenceKey: 5 },
    { label: "current", fromSequenceKey: 5, toSequenceKey: 10 },
    CONFIG,
  );
  assert.equal(comparison.baseline.validRecords, 2);
  assert.equal(comparison.current.validRecords, 2);
});
