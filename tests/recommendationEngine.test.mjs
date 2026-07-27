import test from "node:test";
import assert from "node:assert/strict";
import { buildRecommendations } from "../src/services/prediction-adaptation/RecommendationEngine.ts";
import { DEFAULT_PREDICTION_ADAPTATION_CONFIG } from "../src/services/prediction-adaptation/PredictionAdaptationConfig.ts";

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

function signal(dimension, key, type, severity, direction, overrides = {}) {
  return {
    id: `${dimension}:${key}:${type}:${overrides.metric ?? "accuracy"}`,
    dimension,
    key,
    type,
    severity,
    metric: overrides.metric ?? "accuracy",
    baselineValue: 0.8,
    currentValue: 0.5,
    absoluteDelta: -0.3,
    relativeDelta: -37.5,
    threshold: 0.05,
    direction,
    reason: "x",
    baselineRecords: 20,
    currentRecords: 20,
    ...overrides,
  };
}

function ranking(entries) {
  return { entries, profileCount: entries.length };
}

function rankingEntry(dimension, key, reliabilityScore, overrides = {}) {
  return { rank: 1, dimension, key, reliabilityScore, sampleSize: 20, status: "OK", metricContributions: [], warnings: [], ...overrides };
}

const CONFIG = DEFAULT_PREDICTION_ADAPTATION_CONFIG;

test("a profile with status EMPTY yields NEEDS_MORE_DATA", () => {
  const profiles = [profile("PLAYER", "alice", { status: "EMPTY" })];
  const recs = buildRecommendations(profiles, [], ranking([]), CONFIG);
  assert.equal(recs[0].type, "NEEDS_MORE_DATA");
});

test("a profile with status REJECTED yields NEEDS_MORE_DATA", () => {
  const profiles = [profile("PLAYER", "alice", { status: "REJECTED" })];
  const recs = buildRecommendations(profiles, [], ranking([]), CONFIG);
  assert.equal(recs[0].type, "NEEDS_MORE_DATA");
});

test("a PROFILE_DISAPPEARED signal yields TEMPORARILY_DISABLE_PROFILE", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PROFILE_DISAPPEARED", "INFO", "NEUTRAL", { metric: "presence" })];
  const recs = buildRecommendations(profiles, signals, ranking([]), CONFIG);
  assert.equal(recs[0].type, "TEMPORARILY_DISABLE_PROFILE");
  assert.deepEqual(recs[0].triggeredBySignalIds, [signals[0].id]);
});

test("status INSUFFICIENT_SAMPLE yields NEEDS_MORE_DATA", () => {
  const profiles = [profile("PLAYER", "alice", { status: "INSUFFICIENT_SAMPLE" })];
  const recs = buildRecommendations(profiles, [], ranking([]), CONFIG);
  assert.equal(recs[0].type, "NEEDS_MORE_DATA");
});

test("a SAMPLE_INSUFFICIENT drift signal yields NEEDS_MORE_DATA even with status OK", () => {
  const profiles = [profile("PLAYER", "alice", { status: "OK" })];
  const signals = [signal("PLAYER", "alice", "SAMPLE_INSUFFICIENT", "INFO", "NEUTRAL", { metric: "sampleSize" })];
  const recs = buildRecommendations(profiles, signals, ranking([]), CONFIG);
  assert.equal(recs[0].type, "NEEDS_MORE_DATA");
});

test("a PROFILE_EMERGED drift signal yields NEEDS_MORE_DATA", () => {
  const profiles = [profile("PLAYER", "alice", { status: "OK" })];
  const signals = [signal("PLAYER", "alice", "PROFILE_EMERGED", "INFO", "NEUTRAL", { metric: "presence" })];
  const recs = buildRecommendations(profiles, signals, ranking([]), CONFIG);
  assert.equal(recs[0].type, "NEEDS_MORE_DATA");
});

test("a CRITICAL-severity degradation signal yields TEMPORARILY_DISABLE_PROFILE", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "CRITICAL", "DEGRADATION")];
  const recs = buildRecommendations(profiles, signals, ranking([]), CONFIG);
  assert.equal(recs[0].type, "TEMPORARILY_DISABLE_PROFILE");
});

test("a WARNING-severity degradation signal yields REDUCE_CONFIDENCE", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "CALIBRATION_DEGRADATION", "WARNING", "DEGRADATION")];
  const recs = buildRecommendations(profiles, signals, ranking([]), CONFIG);
  assert.equal(recs[0].type, "REDUCE_CONFIDENCE");
});

test("a reliability score below recommendationLowReliabilityThreshold yields REDUCE_CONFIDENCE even without an active drift signal", () => {
  const profiles = [profile("PLAYER", "alice")];
  const rankingWithLowScore = ranking([rankingEntry("PLAYER", "alice", 30)]);
  const recs = buildRecommendations(profiles, [], rankingWithLowScore, CONFIG);
  assert.equal(recs[0].type, "REDUCE_CONFIDENCE");
});

test("a reliability score at or above the threshold does not force REDUCE_CONFIDENCE", () => {
  const profiles = [profile("PLAYER", "alice")];
  const rankingWithHighScore = ranking([rankingEntry("PLAYER", "alice", 90)]);
  const recs = buildRecommendations(profiles, [], rankingWithHighScore, CONFIG);
  assert.equal(recs[0].type, "PROFILE_STABLE");
});

test("an INFO-severity degradation signal yields INCREASE_MONITORING", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "INFO", "DEGRADATION")];
  const recs = buildRecommendations(profiles, signals, ranking([]), CONFIG);
  assert.equal(recs[0].type, "INCREASE_MONITORING");
});

test("a CONFIDENCE_SHIFT signal yields INCREASE_MONITORING", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "CONFIDENCE_SHIFT", "WARNING", "NEUTRAL", { metric: "averageConfidence" })];
  const recs = buildRecommendations(profiles, signals, ranking([]), CONFIG);
  assert.equal(recs[0].type, "INCREASE_MONITORING");
});

test("a PERFORMANCE_IMPROVEMENT signal yields PROFILE_IMPROVING", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_IMPROVEMENT", "INFO", "IMPROVEMENT")];
  const recs = buildRecommendations(profiles, signals, ranking([]), CONFIG);
  assert.equal(recs[0].type, "PROFILE_IMPROVING");
});

test("no relevant signal and OK status yields PROFILE_STABLE", () => {
  const profiles = [profile("PLAYER", "alice")];
  const recs = buildRecommendations(profiles, [], ranking([]), CONFIG);
  assert.equal(recs[0].type, "PROFILE_STABLE");
});

test("priority: CRITICAL degradation wins over a simultaneous PERFORMANCE_IMPROVEMENT signal for a different metric", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [
    signal("PLAYER", "alice", "PERFORMANCE_IMPROVEMENT", "INFO", "IMPROVEMENT", { metric: "macroPrecision" }),
    signal("PLAYER", "alice", "CALIBRATION_DEGRADATION", "CRITICAL", "DEGRADATION", { metric: "brierScore" }),
  ];
  const recs = buildRecommendations(profiles, signals, ranking([]), CONFIG);
  assert.equal(recs[0].type, "TEMPORARILY_DISABLE_PROFILE");
});

test("priority: PROFILE_DISAPPEARED wins over a CRITICAL degradation signal for the same profile", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [
    signal("PLAYER", "alice", "CALIBRATION_DEGRADATION", "CRITICAL", "DEGRADATION"),
    signal("PLAYER", "alice", "PROFILE_DISAPPEARED", "INFO", "NEUTRAL", { metric: "presence" }),
  ];
  const recs = buildRecommendations(profiles, signals, ranking([]), CONFIG);
  assert.equal(recs[0].type, "TEMPORARILY_DISABLE_PROFILE");
});

test("produces exactly one recommendation per profile, in the same order", () => {
  const profiles = [profile("GLOBAL", "GLOBAL"), profile("PLAYER", "alice"), profile("LEAGUE", "league-a")];
  const recs = buildRecommendations(profiles, [], ranking([]), CONFIG);
  assert.equal(recs.length, 3);
  assert.deepEqual(recs.map((r) => `${r.dimension}:${r.key}`), ["GLOBAL:GLOBAL", "PLAYER:alice", "LEAGUE:league-a"]);
});

test("triggeredBySignalIds only includes signals for the matching dimension+key, sorted", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [
    signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "WARNING", "DEGRADATION", { metric: "accuracy" }),
    signal("PLAYER", "bob", "PERFORMANCE_DEGRADATION", "CRITICAL", "DEGRADATION", { metric: "accuracy" }),
  ];
  const recs = buildRecommendations(profiles, signals, ranking([]), CONFIG);
  assert.deepEqual(recs[0].triggeredBySignalIds, [signals[0].id]);
});

test("does not mutate the input profiles/driftSignals/reliabilityRanking", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "WARNING", "DEGRADATION")];
  const rankingData = ranking([rankingEntry("PLAYER", "alice", 90)]);
  const profilesSnapshot = JSON.parse(JSON.stringify(profiles));
  const signalsSnapshot = JSON.parse(JSON.stringify(signals));
  const rankingSnapshot = JSON.parse(JSON.stringify(rankingData));
  buildRecommendations(profiles, signals, rankingData, CONFIG);
  assert.deepEqual(profiles, profilesSnapshot);
  assert.deepEqual(signals, signalsSnapshot);
  assert.deepEqual(rankingData, rankingSnapshot);
});

test("is deterministic for identical input", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "WARNING", "DEGRADATION")];
  assert.deepEqual(buildRecommendations(profiles, signals, ranking([]), CONFIG), buildRecommendations(profiles, signals, ranking([]), CONFIG));
});

test("handles empty profiles/driftSignals/reliabilityRanking", () => {
  assert.deepEqual(buildRecommendations([], [], ranking([]), CONFIG), []);
});
