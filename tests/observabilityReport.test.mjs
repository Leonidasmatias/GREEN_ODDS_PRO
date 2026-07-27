import test from "node:test";
import assert from "node:assert/strict";
import { buildObservabilityReport } from "../src/services/prediction-observability/ObservabilityReport.ts";
import {
  DEFAULT_PREDICTION_OBSERVABILITY_CONFIG,
  PredictionObservabilityConfigurationError,
} from "../src/services/prediction-observability/PredictionObservabilityConfig.ts";

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

function learningReport(overrides = {}) {
  return {
    reportId: "learning-r1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    modelVersion: "esoccer-prediction-learning-v1.0.0-provisional",
    config: {},
    datasetSummary: { datasetId: "ds", totalRecords: 20, validRecords: 20, ignoredRecords: 0, baselineRecords: 10, currentRecords: 10 },
    historicalProfiles: [profile("GLOBAL", "GLOBAL")],
    windowComparisons: [],
    driftSignals: [],
    reliabilityRankings: { entries: [{ rank: 1, dimension: "GLOBAL", key: "GLOBAL", reliabilityScore: 90, sampleSize: 20, status: "OK", metricContributions: [], warnings: [] }], profileCount: 1 },
    warnings: [],
    rejectedRecords: [],
    status: "OK",
    ...overrides,
  };
}

function adaptiveReport(overrides = {}) {
  return {
    reportId: "adaptive-r1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    modelVersion: "esoccer-prediction-adaptation-v1.0.0-provisional",
    config: {},
    sourceReportId: "learning-r1",
    sourceStatus: "OK",
    strategyStatus: "NORMAL",
    decisions: [
      {
        dimension: "GLOBAL",
        key: "GLOBAL",
        recommendation: { dimension: "GLOBAL", key: "GLOBAL", type: "PROFILE_STABLE", reason: "x", triggeredBySignalIds: [] },
        confidenceAdjustment: { dimension: "GLOBAL", key: "GLOBAL", recommendationType: "PROFILE_STABLE", suggestedMultiplier: 1 },
        riskAssessment: { dimension: "GLOBAL", key: "GLOBAL", level: "LOW", reliabilityScore: 90 },
      },
    ],
    ...overrides,
  };
}

const CONFIG = DEFAULT_PREDICTION_OBSERVABILITY_CONFIG;

test("a valid partial config override produces a report without throwing", () => {
  const config = { ...CONFIG, decimalPlaces: 2 };
  assert.doesNotThrow(() => buildObservabilityReport(learningReport(), adaptiveReport(), config, { reportId: "r1" }));
});

test("an invalid config throws PredictionObservabilityConfigurationError before any processing runs", () => {
  const config = { ...CONFIG, decimalPlaces: -1 };
  assert.throws(() => buildObservabilityReport(learningReport(), adaptiveReport(), config, { reportId: "r1" }), PredictionObservabilityConfigurationError);
});

test("the report is fully JSON-serializable", () => {
  const report = buildObservabilityReport(learningReport(), adaptiveReport(), CONFIG, { reportId: "r1", generatedAt: "2026-01-01T00:00:00.000Z" });
  assert.doesNotThrow(() => JSON.stringify(report));
});

test("the report is deterministic across two separate calls", () => {
  const learning = learningReport();
  const adaptive = adaptiveReport();
  const options = { reportId: "r1", generatedAt: "2026-01-01T00:00:00.000Z", timelineTimestamp: "2026-01-01T00:00:00.000Z" };
  const first = buildObservabilityReport(learning, adaptive, CONFIG, options);
  const second = buildObservabilityReport(learning, adaptive, CONFIG, options);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("reportId is always exactly what the caller supplied", () => {
  const report = buildObservabilityReport(learningReport(), adaptiveReport(), CONFIG, { reportId: "fixed-id" });
  assert.equal(report.reportId, "fixed-id");
});

test("generatedAt is always exactly what the caller supplied, or null when omitted", () => {
  const withDate = buildObservabilityReport(learningReport(), adaptiveReport(), CONFIG, { reportId: "r1", generatedAt: "2020-05-05T00:00:00.000Z" });
  assert.equal(withDate.generatedAt, "2020-05-05T00:00:00.000Z");
  const withoutDate = buildObservabilityReport(learningReport(), adaptiveReport(), CONFIG, { reportId: "r1" });
  assert.equal(withoutDate.generatedAt, null);
});

test("metadata traces back to both source reports", () => {
  const learning = learningReport({ reportId: "learning-xyz", status: "INSUFFICIENT_SAMPLE" });
  const adaptive = adaptiveReport({ reportId: "adaptive-xyz", strategyStatus: "WARNING" });
  const report = buildObservabilityReport(learning, adaptive, CONFIG, { reportId: "r1" });
  assert.equal(report.metadata.sourceLearningReportId, "learning-xyz");
  assert.equal(report.metadata.sourceAdaptiveReportId, "adaptive-xyz");
  assert.equal(report.metadata.sourceLearningStatus, "INSUFFICIENT_SAMPLE");
  assert.equal(report.metadata.sourceStrategyStatus, "WARNING");
});

test("config is preserved exactly, never rounded", () => {
  const config = { ...CONFIG, decimalPlaces: 1, lowReliabilityAlertThreshold: 33.333333 };
  const report = buildObservabilityReport(learningReport(), adaptiveReport(), config, { reportId: "r1" });
  assert.equal(report.config.lowReliabilityAlertThreshold, 33.333333);
});

test("decimalPlaces rounds computed numeric fields", () => {
  const config = { ...CONFIG, decimalPlaces: 1 };
  const learning = learningReport({
    reliabilityRankings: { entries: [{ rank: 1, dimension: "GLOBAL", key: "GLOBAL", reliabilityScore: 71.526387, sampleSize: 20, status: "OK", metricContributions: [], warnings: [] }], profileCount: 1 },
  });
  const report = buildObservabilityReport(learning, adaptiveReport(), config, { reportId: "r1" });
  assert.equal(report.monitoredProfiles[0].reliabilityScore, 71.5);
});

test("an empty historicalProfiles array produces empty arrays across the board, never throwing", () => {
  const learning = learningReport({ historicalProfiles: [], reliabilityRankings: { entries: [], profileCount: 0 } });
  const adaptive = adaptiveReport({ decisions: [] });
  const report = buildObservabilityReport(learning, adaptive, CONFIG, { reportId: "r1" });
  assert.deepEqual(report.monitoredProfiles, []);
  assert.deepEqual(report.trendAnalysis, []);
  assert.equal(report.dashboardMetrics.totalProfiles, 0);
  assert.doesNotThrow(() => JSON.stringify(report));
});

test("integrates dashboardMetrics/monitoredProfiles/trendAnalysis/alerts/timeline all present and consistent in size", () => {
  const report = buildObservabilityReport(learningReport(), adaptiveReport(), CONFIG, { reportId: "r1" });
  assert.equal(report.monitoredProfiles.length, 1);
  assert.equal(report.trendAnalysis.length, 1);
  assert.equal(report.dashboardMetrics.totalProfiles, 1);
  assert.ok(Array.isArray(report.alerts));
  assert.ok(report.timeline.length >= 1);
});

test("does not mutate the input LearningReport/AdaptiveReport", () => {
  const learning = learningReport();
  const adaptive = adaptiveReport();
  const learningSnapshot = JSON.parse(JSON.stringify(learning));
  const adaptiveSnapshot = JSON.parse(JSON.stringify(adaptive));
  buildObservabilityReport(learning, adaptive, CONFIG, { reportId: "r1" });
  assert.deepEqual(learning, learningSnapshot);
  assert.deepEqual(adaptive, adaptiveSnapshot);
});

test("never references odds, ROI, EV, Kelly, or stake anywhere in the serialized output", () => {
  const report = buildObservabilityReport(learningReport(), adaptiveReport(), CONFIG, { reportId: "r1" });
  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of ["odds", "stake", "kelly", "expectedvalue", "roi", "bookmaker", "wager"]) {
    assert.ok(!serialized.includes(forbidden), `unexpected forbidden term: ${forbidden}`);
  }
});

test("respects the timelineTimestamp option, never Date.now()", () => {
  const report = buildObservabilityReport(learningReport(), adaptiveReport(), CONFIG, { reportId: "r1", timelineTimestamp: "2020-01-01T00:00:00.000Z" });
  assert.ok(report.timeline.every((e) => e.timestamp === "2020-01-01T00:00:00.000Z"));
});

test("timelineTimestamp defaults to null when omitted", () => {
  const report = buildObservabilityReport(learningReport(), adaptiveReport(), CONFIG, { reportId: "r1" });
  assert.ok(report.timeline.every((e) => e.timestamp === null));
});
