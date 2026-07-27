import test from "node:test";
import assert from "node:assert/strict";
import { buildMonitoringProfiles } from "../src/services/prediction-observability/ProfileMonitoringEngine.ts";
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
    metrics: metrics(overrides.metricsOverrides ?? {}),
    firstSequenceKey: null,
    lastSequenceKey: null,
    warnings: [],
    ...overrides,
  };
}

function signal(dimension, key, type, severity, direction) {
  return {
    id: `${dimension}:${key}:${type}:accuracy`,
    dimension,
    key,
    type,
    severity,
    metric: "accuracy",
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

function recommendation(dimension, key, type) {
  return { dimension, key, type, reason: "x", triggeredBySignalIds: [] };
}

function riskAssessment(dimension, key, level, reliabilityScore) {
  return { dimension, key, level, reliabilityScore };
}

function confidenceAdjustment(dimension, key, type, multiplier) {
  return { dimension, key, recommendationType: type, suggestedMultiplier: multiplier };
}

function adaptiveReport(decisions, strategyStatus = "NORMAL") {
  return {
    reportId: "adaptive-r1",
    generatedAt: null,
    modelVersion: "esoccer-prediction-adaptation-v1.0.0-provisional",
    config: {},
    sourceReportId: "learning-r1",
    sourceStatus: "OK",
    strategyStatus,
    decisions,
  };
}

const CONFIG = DEFAULT_PREDICTION_OBSERVABILITY_CONFIG;

test("consolidates a single profile with a matching decision", () => {
  const profiles = [profile("PLAYER", "alice")];
  const decision = {
    dimension: "PLAYER",
    key: "alice",
    recommendation: recommendation("PLAYER", "alice", "PROFILE_STABLE"),
    riskAssessment: riskAssessment("PLAYER", "alice", "LOW", 90),
    confidenceAdjustment: confidenceAdjustment("PLAYER", "alice", "PROFILE_STABLE", 1),
  };
  const result = buildMonitoringProfiles(profiles, [], ranking([rankingEntry("PLAYER", "alice", 90)]), adaptiveReport([decision]), CONFIG);
  assert.equal(result.length, 1);
  assert.equal(result[0].reliabilityScore, 90);
  assert.equal(result[0].recommendation.type, "PROFILE_STABLE");
  assert.equal(result[0].riskAssessment.level, "LOW");
  assert.equal(result[0].confidenceAdjustment.suggestedMultiplier, 1);
  assert.equal(result[0].status, "STABLE");
});

test("attaches only the drift signals matching that profile's dimension+key", () => {
  const profiles = [profile("PLAYER", "alice"), profile("PLAYER", "bob")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "WARNING", "DEGRADATION"), signal("PLAYER", "bob", "CONFIDENCE_SHIFT", "INFO", "NEUTRAL")];
  const result = buildMonitoringProfiles(profiles, signals, ranking([]), adaptiveReport([]), CONFIG);
  assert.deepEqual(result.find((p) => p.key === "alice").driftSignals, [signals[0]]);
  assert.deepEqual(result.find((p) => p.key === "bob").driftSignals, [signals[1]]);
});

test("reliabilityScore is null when no ranking entry matches (never fabricated as 0)", () => {
  const result = buildMonitoringProfiles([profile("PLAYER", "ghost")], [], ranking([]), adaptiveReport([]), CONFIG);
  assert.equal(result[0].reliabilityScore, null);
});

test("recommendation/riskAssessment/confidenceAdjustment are null when the AdaptiveReport has no matching decision", () => {
  const result = buildMonitoringProfiles([profile("PLAYER", "orphan")], [], ranking([]), adaptiveReport([]), CONFIG);
  assert.equal(result[0].recommendation, null);
  assert.equal(result[0].riskAssessment, null);
  assert.equal(result[0].confidenceAdjustment, null);
  assert.equal(result[0].status, "NEW");
});

test("status is derived purely from config.monitoringStatusByRecommendation, never recomputed", () => {
  const customConfig = { ...CONFIG, monitoringStatusByRecommendation: { ...CONFIG.monitoringStatusByRecommendation, PROFILE_STABLE: "CRITICAL" } };
  const profiles = [profile("PLAYER", "alice")];
  const decision = { dimension: "PLAYER", key: "alice", recommendation: recommendation("PLAYER", "alice", "PROFILE_STABLE"), riskAssessment: null, confidenceAdjustment: null };
  const result = buildMonitoringProfiles(profiles, [], ranking([]), adaptiveReport([decision]), customConfig);
  assert.equal(result[0].status, "CRITICAL");
});

test("strategyStatus is denormalized onto every entry from the AdaptiveReport", () => {
  const profiles = [profile("GLOBAL", "GLOBAL"), profile("PLAYER", "alice")];
  const result = buildMonitoringProfiles(profiles, [], ranking([]), adaptiveReport([], "CRITICAL"), CONFIG);
  assert.ok(result.every((p) => p.strategyStatus === "CRITICAL"));
});

test("produces exactly one MonitoringProfile per HistoricalProfile, in the same order", () => {
  const profiles = [profile("GLOBAL", "GLOBAL"), profile("PLAYER", "alice"), profile("LEAGUE", "league-a")];
  const result = buildMonitoringProfiles(profiles, [], ranking([]), adaptiveReport([]), CONFIG);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((p) => `${p.dimension}:${p.key}`), ["GLOBAL:GLOBAL", "PLAYER:alice", "LEAGUE:league-a"]);
});

test("embeds the full original HistoricalProfile unchanged (never recomputes it)", () => {
  const sourceProfile = profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.55 } });
  const result = buildMonitoringProfiles([sourceProfile], [], ranking([]), adaptiveReport([]), CONFIG);
  assert.deepEqual(result[0].profile, sourceProfile);
});

test("does not mutate the input profiles/driftSignals/reliabilityRanking/adaptiveReport", () => {
  const profiles = [profile("PLAYER", "alice")];
  const signals = [signal("PLAYER", "alice", "PERFORMANCE_DEGRADATION", "WARNING", "DEGRADATION")];
  const rankingData = ranking([rankingEntry("PLAYER", "alice", 90)]);
  const adaptive = adaptiveReport([{ dimension: "PLAYER", key: "alice", recommendation: recommendation("PLAYER", "alice", "PROFILE_STABLE"), riskAssessment: null, confidenceAdjustment: null }]);
  const profilesSnapshot = JSON.parse(JSON.stringify(profiles));
  const signalsSnapshot = JSON.parse(JSON.stringify(signals));
  const rankingSnapshot = JSON.parse(JSON.stringify(rankingData));
  const adaptiveSnapshot = JSON.parse(JSON.stringify(adaptive));
  buildMonitoringProfiles(profiles, signals, rankingData, adaptive, CONFIG);
  assert.deepEqual(profiles, profilesSnapshot);
  assert.deepEqual(signals, signalsSnapshot);
  assert.deepEqual(rankingData, rankingSnapshot);
  assert.deepEqual(adaptive, adaptiveSnapshot);
});

test("is deterministic for identical input", () => {
  const profiles = [profile("PLAYER", "alice")];
  assert.deepEqual(
    buildMonitoringProfiles(profiles, [], ranking([]), adaptiveReport([]), CONFIG),
    buildMonitoringProfiles(profiles, [], ranking([]), adaptiveReport([]), CONFIG),
  );
});

test("handles empty profiles/driftSignals/reliabilityRanking/decisions", () => {
  assert.deepEqual(buildMonitoringProfiles([], [], ranking([]), adaptiveReport([]), CONFIG), []);
});
