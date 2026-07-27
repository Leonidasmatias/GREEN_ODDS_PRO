import test from "node:test";
import assert from "node:assert/strict";
import { buildAdaptiveReport } from "../src/services/prediction-adaptation/AdaptiveReport.ts";
import {
  DEFAULT_PREDICTION_ADAPTATION_CONFIG,
  PredictionAdaptationConfigurationError,
} from "../src/services/prediction-adaptation/PredictionAdaptationConfig.ts";

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

const CONFIG = DEFAULT_PREDICTION_ADAPTATION_CONFIG;

test("a valid partial config override produces a report without throwing", () => {
  const config = { ...CONFIG, decimalPlaces: 2 };
  assert.doesNotThrow(() => buildAdaptiveReport(learningReport(), config, { reportId: "r1" }));
});

test("an invalid config throws PredictionAdaptationConfigurationError before any processing runs", () => {
  const config = { ...CONFIG, decimalPlaces: -1 };
  assert.throws(() => buildAdaptiveReport(learningReport(), config, { reportId: "r1" }), PredictionAdaptationConfigurationError);
});

test("the report is fully JSON-serializable", () => {
  const report = buildAdaptiveReport(learningReport(), CONFIG, { reportId: "r1", generatedAt: "2026-01-01T00:00:00.000Z" });
  assert.doesNotThrow(() => JSON.stringify(report));
});

test("the report is deterministic across two separate calls", () => {
  const source = learningReport();
  const options = { reportId: "r1", generatedAt: "2026-01-01T00:00:00.000Z" };
  const first = buildAdaptiveReport(source, CONFIG, options);
  const second = buildAdaptiveReport(source, CONFIG, options);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("reportId is always exactly what the caller supplied", () => {
  const report = buildAdaptiveReport(learningReport(), CONFIG, { reportId: "fixed-id" });
  assert.equal(report.reportId, "fixed-id");
});

test("generatedAt is always exactly what the caller supplied, or null when omitted", () => {
  const withDate = buildAdaptiveReport(learningReport(), CONFIG, { reportId: "r1", generatedAt: "2020-05-05T00:00:00.000Z" });
  assert.equal(withDate.generatedAt, "2020-05-05T00:00:00.000Z");
  const withoutDate = buildAdaptiveReport(learningReport(), CONFIG, { reportId: "r1" });
  assert.equal(withoutDate.generatedAt, null);
});

test("sourceReportId/sourceStatus trace back to the input LearningReport", () => {
  const source = learningReport({ reportId: "learning-xyz", status: "INSUFFICIENT_SAMPLE" });
  const report = buildAdaptiveReport(source, CONFIG, { reportId: "r1" });
  assert.equal(report.sourceReportId, "learning-xyz");
  assert.equal(report.sourceStatus, "INSUFFICIENT_SAMPLE");
});

test("config is preserved exactly, never rounded", () => {
  const config = { ...CONFIG, decimalPlaces: 1, recommendationLowReliabilityThreshold: 33.333333 };
  const report = buildAdaptiveReport(learningReport(), config, { reportId: "r1" });
  assert.equal(report.config.recommendationLowReliabilityThreshold, 33.333333);
});

test("decimalPlaces rounds computed numeric fields (suggestedMultiplier/reliabilityScore)", () => {
  const config = { ...CONFIG, decimalPlaces: 1 };
  const source = learningReport({
    reliabilityRankings: { entries: [{ rank: 1, dimension: "GLOBAL", key: "GLOBAL", reliabilityScore: 71.526387, sampleSize: 20, status: "OK", metricContributions: [], warnings: [] }], profileCount: 1 },
  });
  const report = buildAdaptiveReport(source, config, { reportId: "r1" });
  assert.equal(report.decisions[0].riskAssessment.reliabilityScore, 71.5);
});

test("decisions length matches the number of historicalProfiles in the source LearningReport", () => {
  const source = learningReport({ historicalProfiles: [profile("GLOBAL", "GLOBAL"), profile("PLAYER", "alice")] });
  const report = buildAdaptiveReport(source, CONFIG, { reportId: "r1" });
  assert.equal(report.decisions.length, 2);
});

test("a null reliabilityScore (no matching ranking entry) survives rounding unchanged, never fabricated as 0", () => {
  const source = learningReport({ reliabilityRankings: { entries: [], profileCount: 0 } });
  const report = buildAdaptiveReport(source, { ...CONFIG, decimalPlaces: 2 }, { reportId: "r1" });
  assert.equal(report.decisions[0].riskAssessment.reliabilityScore, null);
});

test("an empty historicalProfiles array produces an empty decisions array, never throwing", () => {
  const source = learningReport({ historicalProfiles: [], reliabilityRankings: { entries: [], profileCount: 0 } });
  const report = buildAdaptiveReport(source, CONFIG, { reportId: "r1" });
  assert.deepEqual(report.decisions, []);
  assert.doesNotThrow(() => JSON.stringify(report));
});

test("each decision consolidates matching recommendation/confidenceAdjustment/riskAssessment for the same dimension+key", () => {
  const report = buildAdaptiveReport(learningReport(), CONFIG, { reportId: "r1" });
  const decision = report.decisions[0];
  assert.equal(decision.recommendation.dimension, decision.dimension);
  assert.equal(decision.confidenceAdjustment.dimension, decision.dimension);
  assert.equal(decision.riskAssessment.dimension, decision.dimension);
  assert.equal(decision.confidenceAdjustment.recommendationType, decision.recommendation.type);
});

test("does not mutate the input LearningReport", () => {
  const source = learningReport();
  const snapshot = JSON.parse(JSON.stringify(source));
  buildAdaptiveReport(source, CONFIG, { reportId: "r1" });
  assert.deepEqual(source, snapshot);
});

test("never references odds, ROI, EV, Kelly, or stake anywhere in the serialized output", () => {
  const report = buildAdaptiveReport(learningReport(), CONFIG, { reportId: "r1" });
  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of ["odds", "stake", "kelly", "expectedvalue", "roi", "bookmaker", "wager"]) {
    assert.ok(!serialized.includes(forbidden), `unexpected forbidden term: ${forbidden}`);
  }
});

test("integrates strategyStatus into the final report", () => {
  const report = buildAdaptiveReport(learningReport(), CONFIG, { reportId: "r1" });
  assert.ok(["NORMAL", "WATCH", "WARNING", "CRITICAL"].includes(report.strategyStatus));
});
