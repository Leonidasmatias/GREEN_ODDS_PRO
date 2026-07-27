import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboardMetrics } from "../src/services/prediction-observability/DashboardMetricsEngine.ts";
import { buildTimeline } from "../src/services/prediction-observability/TimelineEngine.ts";
import { DEFAULT_PREDICTION_OBSERVABILITY_CONFIG } from "../src/services/prediction-observability/PredictionObservabilityConfig.ts";

function historicalProfile(dimension, key, status = "OK") {
  return {
    dimension,
    key,
    totalRecords: 20,
    validRecords: 20,
    status,
    metrics: { totalRecords: 20, validRecords: 20, ignoredRecords: 0, correct: 16, incorrect: 4, accuracy: 0.8, macroPrecision: 0.8, macroRecall: 0.8, brierScore: 0.4, logLoss: 0.6, averageConfidence: 70, averagePredictedProbability: 0.7, averageObservedOutcome: 0.8 },
    firstSequenceKey: 1,
    lastSequenceKey: 10,
    warnings: [],
  };
}

function signal(dimension, key, type, metric = "accuracy") {
  return { id: `${dimension}:${key}:${type}:${metric}`, dimension, key, type, severity: "WARNING", metric, baselineValue: 0.8, currentValue: 0.5, absoluteDelta: -0.3, relativeDelta: -37.5, threshold: 0.05, direction: "DEGRADATION", reason: "x", baselineRecords: 20, currentRecords: 20 };
}

function monitoringProfile(dimension, key, overrides = {}) {
  return {
    dimension,
    key,
    profile: historicalProfile(dimension, key, overrides.status ?? "OK"),
    driftSignals: overrides.driftSignals ?? [],
    reliabilityScore: overrides.reliabilityScore === undefined ? 90 : overrides.reliabilityScore,
    recommendation: overrides.recommendation ?? null,
    riskAssessment: overrides.riskAssessment ?? null,
    confidenceAdjustment: overrides.confidenceAdjustment ?? null,
    strategyStatus: "NORMAL",
    status: overrides.status2 ?? "STABLE",
  };
}

const CONFIG = DEFAULT_PREDICTION_OBSERVABILITY_CONFIG;

// ---- DashboardMetricsEngine ----

test("counts profiles by MonitoringStatus correctly", () => {
  const profiles = [
    monitoringProfile("PLAYER", "a", { status2: "STABLE" }),
    monitoringProfile("PLAYER", "b", { status2: "WARNING" }),
    monitoringProfile("PLAYER", "c", { status2: "CRITICAL" }),
    monitoringProfile("PLAYER", "d", { status2: "IMPROVING" }),
    monitoringProfile("PLAYER", "e", { status2: "DISABLED" }),
    monitoringProfile("PLAYER", "f", { status2: "NEW" }),
  ];
  const metrics = buildDashboardMetrics(profiles);
  assert.equal(metrics.totalProfiles, 6);
  assert.equal(metrics.stableProfiles, 1);
  assert.equal(metrics.warningProfiles, 1);
  assert.equal(metrics.criticalProfiles, 1);
  assert.equal(metrics.improvingProfiles, 1);
  assert.equal(metrics.disabledProfiles, 1);
  assert.equal(metrics.monitoredProfiles, 5);
});

test("averageReliability/averageConfidenceMultiplier ignore null entries and never divide by zero", () => {
  const profiles = [
    monitoringProfile("PLAYER", "a", { reliabilityScore: 100, confidenceAdjustment: { dimension: "PLAYER", key: "a", recommendationType: "PROFILE_STABLE", suggestedMultiplier: 1 } }),
    monitoringProfile("PLAYER", "b", { reliabilityScore: null, confidenceAdjustment: null }),
  ];
  const metrics = buildDashboardMetrics(profiles);
  assert.equal(metrics.averageReliability, 100);
  assert.equal(metrics.averageConfidenceMultiplier, 1);
});

test("averageReliability/averageRisk/averageConfidenceMultiplier are 0 (never NaN) for an empty list", () => {
  const metrics = buildDashboardMetrics([]);
  assert.equal(metrics.averageReliability, 0);
  assert.equal(metrics.averageRisk, 0);
  assert.equal(metrics.averageConfidenceMultiplier, 0);
  assert.equal(metrics.totalProfiles, 0);
});

test("averageRisk reflects the ordinal position of the risk level (LOW=0 .. CRITICAL=3)", () => {
  const profiles = [monitoringProfile("PLAYER", "a", { riskAssessment: { dimension: "PLAYER", key: "a", level: "CRITICAL", reliabilityScore: 90 } })];
  const metrics = buildDashboardMetrics(profiles);
  assert.equal(metrics.averageRisk, 3);
});

test("driftDistribution always contains all seven DriftSignalType keys, including zero counts", () => {
  const profiles = [monitoringProfile("PLAYER", "a", { driftSignals: [signal("PLAYER", "a", "PERFORMANCE_DEGRADATION")] })];
  const metrics = buildDashboardMetrics(profiles);
  assert.deepEqual(
    Object.keys(metrics.driftDistribution).sort(),
    ["PERFORMANCE_DEGRADATION", "PERFORMANCE_IMPROVEMENT", "CALIBRATION_DEGRADATION", "CONFIDENCE_SHIFT", "SAMPLE_INSUFFICIENT", "PROFILE_DISAPPEARED", "PROFILE_EMERGED"].sort(),
  );
  assert.equal(metrics.driftDistribution.PERFORMANCE_DEGRADATION, 1);
  assert.equal(metrics.driftDistribution.PROFILE_EMERGED, 0);
});

test("recommendationDistribution always contains all six RecommendationType keys, including zero counts", () => {
  const profiles = [monitoringProfile("PLAYER", "a", { recommendation: { dimension: "PLAYER", key: "a", type: "PROFILE_STABLE", reason: "x", triggeredBySignalIds: [] } })];
  const metrics = buildDashboardMetrics(profiles);
  assert.deepEqual(
    Object.keys(metrics.recommendationDistribution).sort(),
    ["REDUCE_CONFIDENCE", "INCREASE_MONITORING", "TEMPORARILY_DISABLE_PROFILE", "PROFILE_STABLE", "PROFILE_IMPROVING", "NEEDS_MORE_DATA"].sort(),
  );
  assert.equal(metrics.recommendationDistribution.PROFILE_STABLE, 1);
  assert.equal(metrics.recommendationDistribution.NEEDS_MORE_DATA, 0);
});

test("does not mutate the input monitoringProfiles", () => {
  const profiles = [monitoringProfile("PLAYER", "a", { driftSignals: [signal("PLAYER", "a", "PERFORMANCE_DEGRADATION")] })];
  const snapshot = JSON.parse(JSON.stringify(profiles));
  buildDashboardMetrics(profiles);
  assert.deepEqual(profiles, snapshot);
});

test("dashboard metrics are deterministic for identical input", () => {
  const profiles = [monitoringProfile("PLAYER", "a")];
  assert.deepEqual(buildDashboardMetrics(profiles), buildDashboardMetrics(profiles));
});

// ---- TimelineEngine ----

test("always includes exactly one global STRATEGY_CHANGE event", () => {
  const timeline = buildTimeline("WARNING", [], CONFIG, "2026-01-01T00:00:00.000Z");
  assert.equal(timeline.filter((e) => e.type === "STRATEGY_CHANGE").length, 1);
  assert.equal(timeline[0].dimension, null);
  assert.equal(timeline[0].key, null);
});

test("produces RISK_CHANGE/RELIABILITY_CHANGE/RECOMMENDATION_CHANGE only when the corresponding field is present", () => {
  const profiles = [
    monitoringProfile("PLAYER", "a", {
      reliabilityScore: 90,
      riskAssessment: { dimension: "PLAYER", key: "a", level: "LOW", reliabilityScore: 90 },
      recommendation: { dimension: "PLAYER", key: "a", type: "PROFILE_STABLE", reason: "x", triggeredBySignalIds: [] },
    }),
    monitoringProfile("PLAYER", "b", { reliabilityScore: null, riskAssessment: null, recommendation: null }),
  ];
  const timeline = buildTimeline("NORMAL", profiles, CONFIG, null);
  assert.equal(timeline.filter((e) => e.type === "RISK_CHANGE").length, 1);
  assert.equal(timeline.filter((e) => e.type === "RELIABILITY_CHANGE").length, 1);
  assert.equal(timeline.filter((e) => e.type === "RECOMMENDATION_CHANGE").length, 1);
});

test("produces one DRIFT_CHANGE event per drift signal", () => {
  const profiles = [monitoringProfile("PLAYER", "a", { driftSignals: [signal("PLAYER", "a", "PERFORMANCE_DEGRADATION"), signal("PLAYER", "a", "CONFIDENCE_SHIFT", "averageConfidence")] })];
  const timeline = buildTimeline("NORMAL", profiles, CONFIG, null);
  assert.equal(timeline.filter((e) => e.type === "DRIFT_CHANGE").length, 2);
});

test("every event uses exactly the caller-supplied timestamp, never Date.now()", () => {
  const timeline = buildTimeline("NORMAL", [], CONFIG, "2020-01-01T00:00:00.000Z");
  assert.ok(timeline.every((e) => e.timestamp === "2020-01-01T00:00:00.000Z"));
  const nullTimeline = buildTimeline("NORMAL", [], CONFIG, null);
  assert.ok(nullTimeline.every((e) => e.timestamp === null));
});

test("ordering is fully deterministic: fixed event-type order, then dimension+key", () => {
  const profiles = [
    monitoringProfile("PLAYER", "zeta", { riskAssessment: { dimension: "PLAYER", key: "zeta", level: "LOW", reliabilityScore: 90 } }),
    monitoringProfile("PLAYER", "alpha", { riskAssessment: { dimension: "PLAYER", key: "alpha", level: "LOW", reliabilityScore: 90 } }),
  ];
  const timeline = buildTimeline("NORMAL", profiles, CONFIG, null);
  const riskEvents = timeline.filter((e) => e.type === "RISK_CHANGE");
  assert.deepEqual(riskEvents.map((e) => e.key), ["alpha", "zeta"]);
});

test("ordering within the same type+dimension+key falls back to description (multiple drift signals for the same profile)", () => {
  const profiles = [
    monitoringProfile("PLAYER", "a", {
      driftSignals: [signal("PLAYER", "a", "PERFORMANCE_DEGRADATION", "brierScore"), signal("PLAYER", "a", "CONFIDENCE_SHIFT", "averageConfidence")],
    }),
  ];
  const timeline = buildTimeline("NORMAL", profiles, CONFIG, null);
  const driftEvents = timeline.filter((e) => e.type === "DRIFT_CHANGE");
  assert.equal(driftEvents.length, 2);
  const sortedDescriptions = [...driftEvents.map((e) => e.description)].sort();
  assert.deepEqual(driftEvents.map((e) => e.description), sortedDescriptions);
});

test("ordering compares dimension (not just key) when two same-type events belong to different dimensions", () => {
  const profiles = [
    monitoringProfile("PLAYER", "alice", { riskAssessment: { dimension: "PLAYER", key: "alice", level: "LOW", reliabilityScore: 90 } }),
    monitoringProfile("LEAGUE", "league-a", { riskAssessment: { dimension: "LEAGUE", key: "league-a", level: "LOW", reliabilityScore: 90 } }),
  ];
  const timeline = buildTimeline("NORMAL", profiles, CONFIG, null);
  const riskEvents = timeline.filter((e) => e.type === "RISK_CHANGE");
  assert.deepEqual(riskEvents.map((e) => e.dimension), ["LEAGUE", "PLAYER"]);
});

test("ordering compares dimension/key in both directions across three distinct profiles", () => {
  const profiles = [
    monitoringProfile("PLAYER", "middle", { riskAssessment: { dimension: "PLAYER", key: "middle", level: "LOW", reliabilityScore: 90 } }),
    monitoringProfile("PLAYER", "alpha", { riskAssessment: { dimension: "PLAYER", key: "alpha", level: "LOW", reliabilityScore: 90 } }),
    monitoringProfile("PLAYER", "zeta", { riskAssessment: { dimension: "PLAYER", key: "zeta", level: "LOW", reliabilityScore: 90 } }),
  ];
  const timeline = buildTimeline("NORMAL", profiles, CONFIG, null);
  const riskKeys = timeline.filter((e) => e.type === "RISK_CHANGE").map((e) => e.key);
  assert.deepEqual(riskKeys, ["alpha", "middle", "zeta"]);
});

test("ordering does not depend on timestamp (same result for the same profiles regardless of timestamp value)", () => {
  const profiles = [monitoringProfile("PLAYER", "a", { riskAssessment: { dimension: "PLAYER", key: "a", level: "LOW", reliabilityScore: 90 } })];
  const a = buildTimeline("NORMAL", profiles, CONFIG, "2020-01-01T00:00:00.000Z").map((e) => ({ ...e, timestamp: null }));
  const b = buildTimeline("NORMAL", profiles, CONFIG, "2099-01-01T00:00:00.000Z").map((e) => ({ ...e, timestamp: null }));
  assert.deepEqual(a, b);
});

test("truncates deterministically at config.maxTimelineEvents (keeps the first N after sorting)", () => {
  const profiles = [monitoringProfile("PLAYER", "a", { riskAssessment: { dimension: "PLAYER", key: "a", level: "LOW", reliabilityScore: 90 } })];
  const config = { ...CONFIG, maxTimelineEvents: 1 };
  const timeline = buildTimeline("NORMAL", profiles, config, null);
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].type, "STRATEGY_CHANGE");
});

test("maxTimelineEvents of zero produces an empty timeline", () => {
  const config = { ...CONFIG, maxTimelineEvents: 0 };
  const timeline = buildTimeline("NORMAL", [], config, null);
  assert.deepEqual(timeline, []);
});

test("timeline truncation never affects DashboardMetrics (independent computations)", () => {
  const profiles = [monitoringProfile("PLAYER", "a", { status2: "STABLE" })];
  const config = { ...CONFIG, maxTimelineEvents: 0 };
  const metrics = buildDashboardMetrics(profiles);
  const timeline = buildTimeline("NORMAL", profiles, config, null);
  assert.equal(metrics.totalProfiles, 1);
  assert.equal(timeline.length, 0);
});

test("does not mutate the input monitoringProfiles", () => {
  const profiles = [monitoringProfile("PLAYER", "a", { driftSignals: [signal("PLAYER", "a", "PERFORMANCE_DEGRADATION")] })];
  const snapshot = JSON.parse(JSON.stringify(profiles));
  buildTimeline("NORMAL", profiles, CONFIG, "2020-01-01T00:00:00.000Z");
  assert.deepEqual(profiles, snapshot);
});

test("timeline is deterministic for identical input", () => {
  const profiles = [monitoringProfile("PLAYER", "a")];
  assert.deepEqual(buildTimeline("NORMAL", profiles, CONFIG, "x"), buildTimeline("NORMAL", profiles, CONFIG, "x"));
});
