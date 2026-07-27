import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTrends } from "../src/services/prediction-observability/TrendAnalysisEngine.ts";
import { DEFAULT_PREDICTION_OBSERVABILITY_CONFIG } from "../src/services/prediction-observability/PredictionObservabilityConfig.ts";

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
    metrics: metrics(),
    firstSequenceKey: 1,
    lastSequenceKey: 10,
    warnings: [],
    ...overrides,
  };
}

function signal(dimension, key, type, severity, direction, metric = "accuracy") {
  return {
    id: `${dimension}:${key}:${type}:${metric}`,
    dimension,
    key,
    type,
    severity,
    metric,
    baselineValue: 0.8,
    currentValue: 0.5,
    absoluteDelta: -0.3,
    relativeDelta: -37.5,
    threshold: 0.05,
    direction,
    reason: "x",
    baselineRecords: 20,
    currentRecords: 20,
  };
}

function ranking(entries) {
  return { entries, profileCount: entries.length };
}

function rankingEntry(dimension, key, reliabilityScore) {
  return { rank: 1, dimension, key, reliabilityScore, sampleSize: 20, status: "OK", metricContributions: [], warnings: [] };
}

const CONFIG = DEFAULT_PREDICTION_OBSERVABILITY_CONFIG;

test("a PROFILE_EMERGED signal yields NEWLY_CREATED_PROFILE", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PROFILE_EMERGED", "INFO", "NEUTRAL", "presence")];
  const result = analyzeTrends(profiles, signals, ranking([]), CONFIG);
  assert.equal(result[0].trend, "NEWLY_CREATED_PROFILE");
});

test("a profile with no sequenceKey anchor at all yields NEWLY_CREATED_PROFILE", () => {
  const profiles = [profile("PLAYER", "alice", { firstSequenceKey: null, lastSequenceKey: null })];
  const result = analyzeTrends(profiles, [], ranking([]), CONFIG);
  assert.equal(result[0].trend, "NEWLY_CREATED_PROFILE");
});

test("degradation across >= continuousDriftMinMetricCount distinct metrics yields CONTINUOUS_DRIFT", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [
    signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "WARNING", "DEGRADATION", "accuracy"),
    signal("PLAYER", "alice", "CALIBRATION_DEGRADATION", "WARNING", "DEGRADATION", "brierScore"),
  ];
  const result = analyzeTrends(profiles, signals, ranking([]), CONFIG);
  assert.equal(result[0].trend, "CONTINUOUS_DRIFT");
});

test("a single degrading metric (below continuousDriftMinMetricCount) does not yield CONTINUOUS_DRIFT", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "WARNING", "DEGRADATION", "accuracy")];
  const result = analyzeTrends(profiles, signals, ranking([]), CONFIG);
  assert.notEqual(result[0].trend, "CONTINUOUS_DRIFT");
});

test("a WARNING/CRITICAL degradation signal with no improvement yields DETERIORATION", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "CRITICAL", "DEGRADATION")];
  const result = analyzeTrends(profiles, signals, ranking([]), CONFIG);
  assert.equal(result[0].trend, "DETERIORATION");
});

test("an improvement signal with reliability below recoveryReliabilityThreshold yields RECOVERY", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_IMPROVEMENT", "INFO", "IMPROVEMENT")];
  const result = analyzeTrends(profiles, signals, ranking([rankingEntry("PLAYER", "alice", 30)]), CONFIG);
  assert.equal(result[0].trend, "RECOVERY");
});

test("an improvement signal with reliability at or above the threshold does not yield RECOVERY", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_IMPROVEMENT", "INFO", "IMPROVEMENT")];
  const result = analyzeTrends(profiles, signals, ranking([rankingEntry("PLAYER", "alice", 90)]), CONFIG);
  assert.notEqual(result[0].trend, "RECOVERY");
});

test("only INFO-severity degradation (below the deterioration bar) yields DECREASING_STABILITY", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "INFO", "DEGRADATION")];
  const result = analyzeTrends(profiles, signals, ranking([]), CONFIG);
  assert.equal(result[0].trend, "DECREASING_STABILITY");
});

test("no drift signal at all yields INCREASING_STABILITY", () => {
  const profiles = [profile("PLAYER", "alice")];
  const result = analyzeTrends(profiles, [], ranking([]), CONFIG);
  assert.equal(result[0].trend, "INCREASING_STABILITY");
});

test("priority: NEWLY_CREATED_PROFILE wins over a simultaneous CONTINUOUS_DRIFT-eligible set of signals", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [
    signal("PLAYER", "alice", "PROFILE_EMERGED", "INFO", "NEUTRAL", "presence"),
    signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "CRITICAL", "DEGRADATION", "accuracy"),
    signal("PLAYER", "alice", "CALIBRATION_DEGRADATION", "CRITICAL", "DEGRADATION", "brierScore"),
  ];
  const result = analyzeTrends(profiles, signals, ranking([]), CONFIG);
  assert.equal(result[0].trend, "NEWLY_CREATED_PROFILE");
});

test("produces exactly one entry per profile, in the same order", () => {
  const profiles = [profile("GLOBAL", "GLOBAL"), profile("PLAYER", "alice"), profile("LEAGUE", "league-a")];
  const result = analyzeTrends(profiles, [], ranking([]), CONFIG);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((r) => `${r.dimension}:${r.key}`), ["GLOBAL:GLOBAL", "PLAYER:alice", "LEAGUE:league-a"]);
});

test("does not mutate the input profiles/driftSignals/reliabilityRanking", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "WARNING", "DEGRADATION")];
  const rankingData = ranking([rankingEntry("PLAYER", "alice", 90)]);
  const profilesSnapshot = JSON.parse(JSON.stringify(profiles));
  const signalsSnapshot = JSON.parse(JSON.stringify(signals));
  const rankingSnapshot = JSON.parse(JSON.stringify(rankingData));
  analyzeTrends(profiles, signals, rankingData, CONFIG);
  assert.deepEqual(profiles, profilesSnapshot);
  assert.deepEqual(signals, signalsSnapshot);
  assert.deepEqual(rankingData, rankingSnapshot);
});

test("is deterministic for identical input", () => {
  const profiles = [profile("PLAYER", "alice")];
  assert.deepEqual(analyzeTrends(profiles, [], ranking([]), CONFIG), analyzeTrends(profiles, [], ranking([]), CONFIG));
});

test("handles empty profiles/driftSignals/reliabilityRanking", () => {
  assert.deepEqual(analyzeTrends([], [], ranking([]), CONFIG), []);
});
