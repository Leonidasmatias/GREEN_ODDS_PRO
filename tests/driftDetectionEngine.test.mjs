import test from "node:test";
import assert from "node:assert/strict";
import { detectDrift } from "../src/services/prediction-learning/DriftDetectionEngine.ts";
import { DEFAULT_PREDICTION_LEARNING_CONFIG } from "../src/services/prediction-learning/PredictionLearningConfig.ts";

function metrics(overrides = {}) {
  return {
    totalRecords: 20,
    validRecords: 20,
    ignoredRecords: 0,
    correct: 16,
    incorrect: 4,
    accuracy: 0.8,
    macroPrecision: 0.8,
    macroRecall: 0.8,
    brierScore: 0.4,
    logLoss: 0.6,
    averageConfidence: 70,
    averagePredictedProbability: 0.7,
    averageObservedOutcome: 0.8,
    ...overrides,
  };
}

function profile(dimension, key, overrides = {}) {
  return {
    dimension,
    key,
    totalRecords: 20,
    validRecords: 20,
    status: "OK",
    metrics: metrics(overrides.metricsOverrides ?? {}),
    firstSequenceKey: null,
    lastSequenceKey: null,
    warnings: [],
    ...overrides,
  };
}

const CONFIG = { ...DEFAULT_PREDICTION_LEARNING_CONFIG, accuracyDriftThreshold: 0.05, brierDriftThreshold: 0.05, logLossDriftThreshold: 0.05, confidenceDriftThreshold: 5, warningSeverityMultiplier: 1, criticalSeverityMultiplier: 2, minimumRecordsForDrift: 10 };

test("no drift signal is produced when both baseline and current are identical", () => {
  const baseline = [profile("PLAYER", "alice")];
  const current = [profile("PLAYER", "alice")];
  const signals = detectDrift(baseline, current, CONFIG);
  assert.equal(signals.length, 0);
});

test("no drift is declared when the delta is within numericTolerance", () => {
  const config = { ...CONFIG, numericTolerance: 0.1 };
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.8 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.85 } })];
  const signals = detectDrift(baseline, current, config);
  assert.equal(signals.length, 0);
});

test("accuracy drop produces a PERFORMANCE_DEGRADATION signal with DEGRADATION direction", () => {
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.8 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.5 } })];
  const signals = detectDrift(baseline, current, CONFIG);
  const signal = signals.find((s) => s.metric === "accuracy");
  assert.equal(signal.type, "PERFORMANCE_DEGRADATION");
  assert.equal(signal.direction, "DEGRADATION");
});

test("accuracy improvement produces a PERFORMANCE_IMPROVEMENT signal with IMPROVEMENT direction", () => {
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.5 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.8 } })];
  const signals = detectDrift(baseline, current, CONFIG);
  const signal = signals.find((s) => s.metric === "accuracy");
  assert.equal(signal.type, "PERFORMANCE_IMPROVEMENT");
  assert.equal(signal.direction, "IMPROVEMENT");
});

test("Brier Score worsening (increase) produces a CALIBRATION_DEGRADATION signal", () => {
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { brierScore: 0.3 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { brierScore: 0.9 } })];
  const signals = detectDrift(baseline, current, CONFIG);
  const signal = signals.find((s) => s.metric === "brierScore");
  assert.equal(signal.type, "CALIBRATION_DEGRADATION");
  assert.equal(signal.direction, "DEGRADATION");
});

test("Log Loss worsening (increase) produces a CALIBRATION_DEGRADATION signal", () => {
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { logLoss: 0.5 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { logLoss: 1.5 } })];
  const signals = detectDrift(baseline, current, CONFIG);
  const signal = signals.find((s) => s.metric === "logLoss");
  assert.equal(signal.type, "CALIBRATION_DEGRADATION");
  assert.equal(signal.direction, "DEGRADATION");
});

test("a confidence shift produces a CONFIDENCE_SHIFT signal with NEUTRAL direction (never interpreted as improvement)", () => {
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { averageConfidence: 40 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { averageConfidence: 90 } })];
  const signals = detectDrift(baseline, current, CONFIG);
  const signal = signals.find((s) => s.metric === "averageConfidence");
  assert.equal(signal.type, "CONFIDENCE_SHIFT");
  assert.equal(signal.direction, "NEUTRAL");
});

test("drift is never declared when either side has insufficient sample (SAMPLE_INSUFFICIENT only)", () => {
  const baseline = [profile("PLAYER", "alice", { validRecords: 3, metricsOverrides: { accuracy: 0.9 } })];
  const current = [profile("PLAYER", "alice", { validRecords: 20, metricsOverrides: { accuracy: 0.1 } })];
  const signals = detectDrift(baseline, current, CONFIG);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, "SAMPLE_INSUFFICIENT");
});

test("a profile present only in current is flagged PROFILE_EMERGED", () => {
  const baseline = [];
  const current = [profile("LEAGUE", "new-league")];
  const signals = detectDrift(baseline, current, CONFIG);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, "PROFILE_EMERGED");
  assert.equal(signals[0].currentRecords, 20);
  assert.equal(signals[0].baselineRecords, 0);
});

test("a profile present only in baseline is flagged PROFILE_DISAPPEARED", () => {
  const baseline = [profile("LEAGUE", "old-league")];
  const current = [];
  const signals = detectDrift(baseline, current, CONFIG);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, "PROFILE_DISAPPEARED");
  assert.equal(signals[0].baselineRecords, 20);
  assert.equal(signals[0].currentRecords, 0);
});

test("severity is WARNING for a moderate delta (>= threshold*warningMultiplier, < threshold*criticalMultiplier)", () => {
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.80 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.72 } })]; // delta 0.08, threshold 0.05*1=0.05, *2=0.10
  const signals = detectDrift(baseline, current, CONFIG);
  const signal = signals.find((s) => s.metric === "accuracy");
  assert.equal(signal.severity, "WARNING");
});

test("severity is CRITICAL for a large delta (>= threshold*criticalMultiplier)", () => {
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.80 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.50 } })]; // delta 0.30 >= 0.10
  const signals = detectDrift(baseline, current, CONFIG);
  const signal = signals.find((s) => s.metric === "accuracy");
  assert.equal(signal.severity, "CRITICAL");
});

test("severity is INFO for a small delta above tolerance but below threshold*warningMultiplier", () => {
  const config = { ...CONFIG, numericTolerance: 1e-6 };
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.80 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.78 } })]; // delta 0.02 < 0.05
  const signals = detectDrift(baseline, current, config);
  const signal = signals.find((s) => s.metric === "accuracy");
  assert.equal(signal.severity, "INFO");
});

test("the drift signal id is deterministic and follows the dimension:key:type:metric composition", () => {
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.8 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.5 } })];
  const signals = detectDrift(baseline, current, CONFIG);
  const signal = signals.find((s) => s.metric === "accuracy");
  assert.equal(signal.id, "PLAYER:alice:PERFORMANCE_DEGRADATION:accuracy");
  const signalsAgain = detectDrift(baseline, current, CONFIG);
  assert.equal(signalsAgain.find((s) => s.metric === "accuracy").id, signal.id);
});

test("includes numeric evidence (baselineValue/currentValue/absoluteDelta/threshold) in every signal", () => {
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.8 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.5 } })];
  const signal = detectDrift(baseline, current, CONFIG).find((s) => s.metric === "accuracy");
  assert.equal(signal.baselineValue, 0.8);
  assert.equal(signal.currentValue, 0.5);
  assert.ok(Math.abs(signal.absoluteDelta - -0.3) < 1e-9);
  assert.equal(signal.threshold, CONFIG.accuracyDriftThreshold);
});

test("result is stable regardless of the order of baselineProfiles/currentProfiles input", () => {
  const baseline = [profile("PLAYER", "zeta", { metricsOverrides: { accuracy: 0.8 } }), profile("PLAYER", "alpha", { metricsOverrides: { accuracy: 0.8 } })];
  const current = [profile("PLAYER", "alpha", { metricsOverrides: { accuracy: 0.5 } }), profile("PLAYER", "zeta", { metricsOverrides: { accuracy: 0.5 } })];
  const a = detectDrift(baseline, current, CONFIG);
  const b = detectDrift([...baseline].reverse(), [...current].reverse(), CONFIG);
  assert.deepEqual(a, b);
});

test("is deterministic for identical input", () => {
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.8 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.5 } })];
  assert.deepEqual(detectDrift(baseline, current, CONFIG), detectDrift(baseline, current, CONFIG));
});

test("handles an empty baseline and empty current with no signals", () => {
  assert.deepEqual(detectDrift([], [], CONFIG), []);
});

test("multiple dimensions/keys are each evaluated independently in the same call", () => {
  const baseline = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.8 } }), profile("LEAGUE", "league-a", { metricsOverrides: { accuracy: 0.8 } })];
  const current = [profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.5 } }), profile("LEAGUE", "league-a", { metricsOverrides: { accuracy: 0.8 } })];
  const signals = detectDrift(baseline, current, CONFIG);
  assert.ok(signals.some((s) => s.dimension === "PLAYER" && s.key === "alice"));
  assert.ok(!signals.some((s) => s.dimension === "LEAGUE" && s.key === "league-a"));
});
