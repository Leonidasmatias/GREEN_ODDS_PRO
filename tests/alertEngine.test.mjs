import test from "node:test";
import assert from "node:assert/strict";
import { buildAlerts } from "../src/services/prediction-observability/AlertEngine.ts";
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

function signal(dimension, key, severity) {
  return { id: `${dimension}:${key}:X:accuracy`, dimension, key, type: "PERFORMANCE_DEGRADATION", severity, metric: "accuracy", baselineValue: 0.8, currentValue: 0.5, absoluteDelta: -0.3, relativeDelta: -37.5, threshold: 0.05, direction: "DEGRADATION", reason: "x", baselineRecords: 20, currentRecords: 20 };
}

function monitoringProfile(dimension, key, overrides = {}) {
  return {
    dimension,
    key,
    profile: historicalProfile(dimension, key, overrides.status ?? "OK"),
    driftSignals: overrides.driftSignals ?? [],
    reliabilityScore: overrides.reliabilityScore ?? 90,
    recommendation: overrides.recommendation ?? null,
    riskAssessment: overrides.riskAssessment ?? null,
    confidenceAdjustment: overrides.confidenceAdjustment ?? null,
    strategyStatus: "NORMAL",
    status: overrides.status ?? "STABLE",
  };
}

function trend(dimension, key, trendType) {
  return { dimension, key, trend: trendType, reason: "x" };
}

const CONFIG = DEFAULT_PREDICTION_OBSERVABILITY_CONFIG;

test("a CRITICAL-severity drift signal produces a DRIFT_CRITICAL alert", () => {
  const profile = monitoringProfile("PLAYER", "alice", { driftSignals: [signal("PLAYER", "alice", "CRITICAL")] });
  const alerts = buildAlerts([profile], [], CONFIG);
  assert.ok(alerts.some((a) => a.type === "DRIFT_CRITICAL" && a.level === "CRITICAL"));
});

test("a TEMPORARILY_DISABLE_PROFILE recommendation produces a PROFILE_DISABLED alert", () => {
  const profile = monitoringProfile("PLAYER", "alice", { recommendation: { dimension: "PLAYER", key: "alice", type: "TEMPORARILY_DISABLE_PROFILE", reason: "x", triggeredBySignalIds: [] } });
  const alerts = buildAlerts([profile], [], CONFIG);
  assert.ok(alerts.some((a) => a.type === "PROFILE_DISABLED" && a.level === "CRITICAL"));
});

test("a CRITICAL risk level produces a CRITICAL HIGH_RISK alert; a HIGH risk level produces a WARNING HIGH_RISK alert", () => {
  const critical = monitoringProfile("PLAYER", "alice", { riskAssessment: { dimension: "PLAYER", key: "alice", level: "CRITICAL", reliabilityScore: 90 } });
  const high = monitoringProfile("PLAYER", "bob", { riskAssessment: { dimension: "PLAYER", key: "bob", level: "HIGH", reliabilityScore: 90 } });
  const alerts = buildAlerts([critical, high], [], CONFIG);
  assert.ok(alerts.some((a) => a.key === "alice" && a.type === "HIGH_RISK" && a.level === "CRITICAL"));
  assert.ok(alerts.some((a) => a.key === "bob" && a.type === "HIGH_RISK" && a.level === "WARNING"));
});

test("a MEDIUM or LOW risk level does not produce a HIGH_RISK alert", () => {
  const profile = monitoringProfile("PLAYER", "alice", { riskAssessment: { dimension: "PLAYER", key: "alice", level: "MEDIUM", reliabilityScore: 90 } });
  const alerts = buildAlerts([profile], [], CONFIG);
  assert.ok(!alerts.some((a) => a.type === "HIGH_RISK"));
});

test("reliabilityScore below lowReliabilityAlertThreshold produces a LOW_RELIABILITY alert", () => {
  const profile = monitoringProfile("PLAYER", "alice", { reliabilityScore: 10 });
  const alerts = buildAlerts([profile], [], CONFIG);
  assert.ok(alerts.some((a) => a.type === "LOW_RELIABILITY" && a.level === "WARNING"));
});

test("a null reliabilityScore never produces a LOW_RELIABILITY alert", () => {
  const profile = monitoringProfile("PLAYER", "alice", { reliabilityScore: null });
  const alerts = buildAlerts([profile], [], CONFIG);
  assert.ok(!alerts.some((a) => a.type === "LOW_RELIABILITY"));
});

test("profile status INSUFFICIENT_SAMPLE or EMPTY produces a SAMPLE_TOO_SMALL alert", () => {
  const insufficient = monitoringProfile("PLAYER", "alice", { status: "INSUFFICIENT_SAMPLE" });
  const empty = monitoringProfile("PLAYER", "bob", { status: "EMPTY" });
  const alerts = buildAlerts([insufficient, empty], [], CONFIG);
  assert.ok(alerts.some((a) => a.key === "alice" && a.type === "SAMPLE_TOO_SMALL"));
  assert.ok(alerts.some((a) => a.key === "bob" && a.type === "SAMPLE_TOO_SMALL"));
});

test("a PROFILE_IMPROVING recommendation produces an IMPROVING_PROFILE alert", () => {
  const profile = monitoringProfile("PLAYER", "alice", { recommendation: { dimension: "PLAYER", key: "alice", type: "PROFILE_IMPROVING", reason: "x", triggeredBySignalIds: [] } });
  const alerts = buildAlerts([profile], [], CONFIG);
  assert.ok(alerts.some((a) => a.type === "IMPROVING_PROFILE" && a.level === "INFO"));
});

test("a NEWLY_CREATED_PROFILE trend produces a NEW_PROFILE alert", () => {
  const profile = monitoringProfile("PLAYER", "alice");
  const alerts = buildAlerts([profile], [trend("PLAYER", "alice", "NEWLY_CREATED_PROFILE")], CONFIG);
  assert.ok(alerts.some((a) => a.type === "NEW_PROFILE" && a.level === "INFO"));
});

test("a profile with no applicable condition produces zero alerts", () => {
  const profile = monitoringProfile("PLAYER", "alice");
  const alerts = buildAlerts([profile], [trend("PLAYER", "alice", "INCREASING_STABILITY")], CONFIG);
  assert.equal(alerts.length, 0);
});

test("a single profile can produce multiple simultaneous alerts", () => {
  const profile = monitoringProfile("PLAYER", "alice", {
    driftSignals: [signal("PLAYER", "alice", "CRITICAL")],
    reliabilityScore: 5,
    recommendation: { dimension: "PLAYER", key: "alice", type: "TEMPORARILY_DISABLE_PROFILE", reason: "x", triggeredBySignalIds: [] },
  });
  const alerts = buildAlerts([profile], [], CONFIG);
  assert.ok(alerts.length >= 3);
  assert.ok(alerts.some((a) => a.type === "DRIFT_CRITICAL"));
  assert.ok(alerts.some((a) => a.type === "PROFILE_DISABLED"));
  assert.ok(alerts.some((a) => a.type === "LOW_RELIABILITY"));
});

test("alert ids are deterministic (dimension:key:type)", () => {
  const profile = monitoringProfile("PLAYER", "alice", { driftSignals: [signal("PLAYER", "alice", "CRITICAL")] });
  const alerts = buildAlerts([profile], [], CONFIG);
  assert.equal(alerts[0].id, "PLAYER:alice:DRIFT_CRITICAL");
});

test("alerts within a profile follow the fixed type order", () => {
  const profile = monitoringProfile("PLAYER", "alice", {
    driftSignals: [signal("PLAYER", "alice", "CRITICAL")],
    reliabilityScore: 5,
    recommendation: { dimension: "PLAYER", key: "alice", type: "TEMPORARILY_DISABLE_PROFILE", reason: "x", triggeredBySignalIds: [] },
  });
  const alerts = buildAlerts([profile], [], CONFIG);
  const types = alerts.map((a) => a.type);
  assert.deepEqual(types, ["DRIFT_CRITICAL", "PROFILE_DISABLED", "LOW_RELIABILITY"]);
});

test("does not mutate the input monitoringProfiles/trendAnalysis", () => {
  const profile = monitoringProfile("PLAYER", "alice", { driftSignals: [signal("PLAYER", "alice", "CRITICAL")] });
  const trends = [trend("PLAYER", "alice", "DETERIORATION")];
  const profileSnapshot = JSON.parse(JSON.stringify(profile));
  const trendsSnapshot = JSON.parse(JSON.stringify(trends));
  buildAlerts([profile], trends, CONFIG);
  assert.deepEqual(profile, profileSnapshot);
  assert.deepEqual(trends, trendsSnapshot);
});

test("is deterministic for identical input", () => {
  const profile = monitoringProfile("PLAYER", "alice", { driftSignals: [signal("PLAYER", "alice", "CRITICAL")] });
  assert.deepEqual(buildAlerts([profile], [], CONFIG), buildAlerts([profile], [], CONFIG));
});

test("handles empty monitoringProfiles/trendAnalysis", () => {
  assert.deepEqual(buildAlerts([], [], CONFIG), []);
});
