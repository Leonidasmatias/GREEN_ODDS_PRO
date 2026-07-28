import test from "node:test";
import assert from "node:assert/strict";
import { buildIntelligenceDashboardViewModel } from "../src/adapters/observabilityDashboardAdapter.ts";
import { NOT_AVAILABLE } from "../src/lib/intelligenceFormatters.ts";

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

function historicalProfile(dimension, key, status = "OK") {
  return {
    dimension,
    key,
    totalRecords: 20,
    validRecords: 20,
    status,
    metrics: metrics(),
    firstSequenceKey: 1,
    lastSequenceKey: 10,
    warnings: [],
  };
}

function monitoringProfile(dimension, key, overrides = {}) {
  return {
    dimension,
    key,
    profile: historicalProfile(dimension, key, overrides.profileStatus ?? "OK"),
    driftSignals: overrides.driftSignals ?? [],
    reliabilityScore: overrides.reliabilityScore === undefined ? 90 : overrides.reliabilityScore,
    recommendation: overrides.recommendation === undefined ? { dimension, key, type: "PROFILE_STABLE", reason: "x", triggeredBySignalIds: [] } : overrides.recommendation,
    riskAssessment: overrides.riskAssessment === undefined ? { dimension, key, level: "LOW", reliabilityScore: 90 } : overrides.riskAssessment,
    confidenceAdjustment: overrides.confidenceAdjustment === undefined ? { dimension, key, recommendationType: "PROFILE_STABLE", suggestedMultiplier: 1 } : overrides.confidenceAdjustment,
    strategyStatus: overrides.strategyStatus ?? "NORMAL",
    status: overrides.status ?? "STABLE",
  };
}

function observabilityReport(overrides = {}) {
  return {
    reportId: "obs-r1",
    generatedAt: "2026-07-27T12:00:00.000Z",
    modelVersion: "esoccer-prediction-observability-v1.0.0-provisional",
    config: {},
    dashboardMetrics: {
      totalProfiles: 1,
      monitoredProfiles: 1,
      stableProfiles: 1,
      warningProfiles: 0,
      criticalProfiles: 0,
      improvingProfiles: 0,
      disabledProfiles: 0,
      averageReliability: 90,
      averageRisk: 0,
      averageConfidenceMultiplier: 1,
      driftDistribution: {
        PERFORMANCE_DEGRADATION: 0,
        PERFORMANCE_IMPROVEMENT: 0,
        CALIBRATION_DEGRADATION: 0,
        CONFIDENCE_SHIFT: 0,
        SAMPLE_INSUFFICIENT: 0,
        PROFILE_DISAPPEARED: 0,
        PROFILE_EMERGED: 0,
      },
      recommendationDistribution: {
        REDUCE_CONFIDENCE: 0,
        INCREASE_MONITORING: 0,
        TEMPORARILY_DISABLE_PROFILE: 0,
        PROFILE_STABLE: 1,
        PROFILE_IMPROVING: 0,
        NEEDS_MORE_DATA: 0,
      },
    },
    monitoredProfiles: [monitoringProfile("GLOBAL", "GLOBAL")],
    trendAnalysis: [{ dimension: "GLOBAL", key: "GLOBAL", trend: "INCREASING_STABILITY", reason: "x" }],
    alerts: [],
    timeline: [{ timestamp: "2026-07-27T12:00:00.000Z", dimension: null, key: null, type: "STRATEGY_CHANGE", description: "strategy status observed: NORMAL" }],
    metadata: {
      sourceLearningReportId: "learning-r1",
      sourceAdaptiveReportId: "adaptive-r1",
      sourceLearningStatus: "OK",
      sourceStrategyStatus: "NORMAL",
    },
    ...overrides,
  };
}

test("builds a header with modelVersion, formatted date, and reportId", () => {
  const vm = buildIntelligenceDashboardViewModel(observabilityReport());
  assert.equal(vm.header.modelVersion, "esoccer-prediction-observability-v1.0.0-provisional");
  assert.equal(vm.header.reportId, "obs-r1");
  assert.ok(vm.header.generatedAtLabel.includes("2026"));
});

test("strategy status is derived from metadata.sourceStrategyStatus, never fabricated", () => {
  const vm = buildIntelligenceDashboardViewModel(observabilityReport({ metadata: { sourceLearningReportId: "l", sourceAdaptiveReportId: "a", sourceLearningStatus: "OK", sourceStrategyStatus: "CRITICAL" } }));
  assert.equal(vm.strategy.status, "CRITICAL");
});

test("summary cards include exactly the ten documented metrics", () => {
  const vm = buildIntelligenceDashboardViewModel(observabilityReport());
  const keys = vm.summaryCards.map((card) => card.key);
  assert.deepEqual(
    keys,
    ["totalProfiles", "monitoredProfiles", "stableProfiles", "warningProfiles", "criticalProfiles", "improvingProfiles", "disabledProfiles", "averageReliability", "averageRisk", "averageConfidenceMultiplier"],
  );
});

test("drift/recommendation distributions include every backend category, even with zero count", () => {
  const vm = buildIntelligenceDashboardViewModel(observabilityReport());
  assert.equal(vm.driftDistribution.length, 7);
  assert.equal(vm.recommendationDistribution.length, 6);
  assert.ok(vm.driftDistribution.every((entry) => entry.percentage >= 0));
});

test("distribution percentage is 0 (never NaN) when the total is zero", () => {
  const report = observabilityReport();
  report.dashboardMetrics.recommendationDistribution = { REDUCE_CONFIDENCE: 0, INCREASE_MONITORING: 0, TEMPORARILY_DISABLE_PROFILE: 0, PROFILE_STABLE: 0, PROFILE_IMPROVING: 0, NEEDS_MORE_DATA: 0 };
  const vm = buildIntelligenceDashboardViewModel(report);
  assert.ok(vm.recommendationDistribution.every((entry) => entry.percentage === 0));
});

test("a profile row reflects a null reliabilityScore as NOT_AVAILABLE, never 0", () => {
  const report = observabilityReport({ monitoredProfiles: [monitoringProfile("PLAYER", "ghost", { reliabilityScore: null, recommendation: null, riskAssessment: null, confidenceAdjustment: null, status: "NEW" })] });
  const vm = buildIntelligenceDashboardViewModel(report);
  const row = vm.profiles[0];
  assert.equal(row.reliabilityValue, null);
  assert.equal(row.reliabilityLabel, NOT_AVAILABLE);
  assert.equal(row.recommendationLabel, NOT_AVAILABLE);
  assert.equal(row.riskLabel, NOT_AVAILABLE);
  assert.equal(row.suggestedMultiplierLabel, NOT_AVAILABLE);
});

test("a profile row's trend is matched from trendAnalysis by dimension+key, not fabricated", () => {
  const report = observabilityReport({
    monitoredProfiles: [monitoringProfile("PLAYER", "alice")],
    trendAnalysis: [{ dimension: "PLAYER", key: "alice", trend: "DETERIORATION", reason: "x" }],
  });
  const vm = buildIntelligenceDashboardViewModel(report);
  assert.equal(vm.profiles[0].trendCode, "DETERIORATION");
});

test("a profile row without a matching trend entry shows NOT_AVAILABLE, never a fabricated trend", () => {
  const report = observabilityReport({ monitoredProfiles: [monitoringProfile("PLAYER", "orphan")], trendAnalysis: [] });
  const vm = buildIntelligenceDashboardViewModel(report);
  assert.equal(vm.profiles[0].trendCode, null);
  assert.equal(vm.profiles[0].trendLabel, NOT_AVAILABLE);
});

test("alerts always show NOT_AVAILABLE for timestamp (TechnicalAlert has no timestamp field in the backend contract)", () => {
  const report = observabilityReport({ alerts: [{ id: "a1", dimension: "PLAYER", key: "alice", type: "HIGH_RISK", level: "WARNING", message: "x" }] });
  const vm = buildIntelligenceDashboardViewModel(report);
  assert.equal(vm.alerts[0].timestampLabel, NOT_AVAILABLE);
  assert.equal(vm.alerts[0].profileLabel, "Jogador · alice");
});

test("multiple alerts are all preserved, in the same order as received", () => {
  const report = observabilityReport({
    alerts: [
      { id: "a1", dimension: "PLAYER", key: "alice", type: "HIGH_RISK", level: "WARNING", message: "x" },
      { id: "a2", dimension: "PLAYER", key: "bob", type: "DRIFT_CRITICAL", level: "CRITICAL", message: "y" },
    ],
  });
  const vm = buildIntelligenceDashboardViewModel(report);
  assert.equal(vm.alerts.length, 2);
  assert.deepEqual(vm.alerts.map((a) => a.id), ["a1", "a2"]);
});

test("trend groups only include trends that actually occur, grouping profiles correctly", () => {
  const report = observabilityReport({
    trendAnalysis: [
      { dimension: "PLAYER", key: "alice", trend: "DETERIORATION", reason: "x" },
      { dimension: "PLAYER", key: "bob", trend: "DETERIORATION", reason: "y" },
      { dimension: "LEAGUE", key: "league-a", trend: "INCREASING_STABILITY", reason: "z" },
    ],
  });
  const vm = buildIntelligenceDashboardViewModel(report);
  const deterioration = vm.trends.find((t) => t.trend === "DETERIORATION");
  assert.equal(deterioration.count, 2);
  assert.deepEqual(deterioration.profiles.map((p) => p.key).sort(), ["alice", "bob"]);
});

test("timeline preserves the exact backend order, never reordered", () => {
  const report = observabilityReport({
    timeline: [
      { timestamp: null, dimension: null, key: null, type: "STRATEGY_CHANGE", description: "z-first" },
      { timestamp: null, dimension: "PLAYER", key: "alice", type: "RISK_CHANGE", description: "a-second" },
    ],
  });
  const vm = buildIntelligenceDashboardViewModel(report);
  assert.deepEqual(vm.timeline.map((e) => e.description), ["z-first", "a-second"]);
});

test("a timeline event with a null timestamp shows NOT_AVAILABLE, never a fabricated date", () => {
  const report = observabilityReport({ timeline: [{ timestamp: null, dimension: null, key: null, type: "STRATEGY_CHANGE", description: "x" }] });
  const vm = buildIntelligenceDashboardViewModel(report);
  assert.equal(vm.timeline[0].timestampLabel, NOT_AVAILABLE);
});

test("does not mutate the input ObservabilityReport", () => {
  const report = observabilityReport();
  const snapshot = JSON.parse(JSON.stringify(report));
  buildIntelligenceDashboardViewModel(report);
  assert.deepEqual(report, snapshot);
});

test("is deterministic for identical input", () => {
  const report = observabilityReport();
  assert.deepEqual(buildIntelligenceDashboardViewModel(report), buildIntelligenceDashboardViewModel(report));
});

test("handles an empty monitoredProfiles/alerts/trendAnalysis/timeline without throwing", () => {
  const report = observabilityReport({ monitoredProfiles: [], alerts: [], trendAnalysis: [], timeline: [] });
  const vm = buildIntelligenceDashboardViewModel(report);
  assert.deepEqual(vm.profiles, []);
  assert.deepEqual(vm.alerts, []);
  assert.deepEqual(vm.trends, []);
  assert.deepEqual(vm.timeline, []);
});
