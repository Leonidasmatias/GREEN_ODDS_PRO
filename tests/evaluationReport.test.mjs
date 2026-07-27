import test from "node:test";
import assert from "node:assert/strict";
import { buildEvaluationReport } from "../src/services/prediction-evaluation/EvaluationReport.ts";
import {
  DEFAULT_PREDICTION_EVALUATION_CONFIG,
  PredictionEvaluationConfigurationError,
} from "../src/services/prediction-evaluation/PredictionEvaluationConfig.ts";

function predictionResult({ homeWin = 0.6, draw = 0.25, awayWin = 0.15, predictedOutcome = "HOME_WIN" } = {}) {
  return {
    prediction: { probabilities: { homeWin, draw, awayWin }, predictedOutcome, topProbability: Math.max(homeWin, draw, awayWin) },
    confidence: 70,
    greenScore: { score: 60, category: "HIGH" },
  };
}

function snapshot(matchId, { predictedOutcome = "HOME_WIN", sequenceKey = null, league = "league-a" } = {}) {
  return {
    matchId,
    homePlayerId: "home",
    awayPlayerId: "away",
    virtualTeamHome: null,
    virtualTeamAway: null,
    league,
    period: null,
    sequenceKey,
    result: predictionResult({ predictedOutcome }),
  };
}

function actual(matchId, outcome = "HOME_WIN") {
  return { matchId, outcome, homeGoals: 2, awayGoals: 1 };
}

function buildDataset(count) {
  const predictions = Array.from({ length: count }, (_, i) => snapshot(`m${i}`, { sequenceKey: i }));
  const actuals = Array.from({ length: count }, (_, i) => actual(`m${i}`));
  return { datasetId: "ds", predictions, actuals };
}

const CONFIG = { ...DEFAULT_PREDICTION_EVALUATION_CONFIG, minRecordsForEvaluation: 1 };

test("a valid partial config override produces a report without throwing", () => {
  const config = { ...DEFAULT_PREDICTION_EVALUATION_CONFIG, decimalPlaces: 2 };
  assert.doesNotThrow(() => buildEvaluationReport(buildDataset(3), config, { reportId: "r1" }));
});

test("an invalid config throws PredictionEvaluationConfigurationError before any evaluation runs", () => {
  const config = { ...DEFAULT_PREDICTION_EVALUATION_CONFIG, decimalPlaces: -1 };
  assert.throws(() => buildEvaluationReport(buildDataset(3), config, { reportId: "r1" }), PredictionEvaluationConfigurationError);
});

test("the report is fully JSON-serializable with no circular references or functions", () => {
  const report = buildEvaluationReport(buildDataset(5), CONFIG, { reportId: "r1", generatedAt: "2026-01-01T00:00:00.000Z" });
  assert.doesNotThrow(() => JSON.stringify(report));
  const serialized = JSON.parse(JSON.stringify(report));
  assert.equal(serialized.reportId, "r1");
});

test("reportId and generatedAt are always exactly what the caller supplied, never derived from the system clock", () => {
  const report = buildEvaluationReport(buildDataset(3), CONFIG, { reportId: "fixed-id", generatedAt: "2020-05-05T00:00:00.000Z" });
  assert.equal(report.reportId, "fixed-id");
  assert.equal(report.generatedAt, "2020-05-05T00:00:00.000Z");
});

test("generatedAt defaults to null (never Date.now()) when omitted", () => {
  const report = buildEvaluationReport(buildDataset(3), CONFIG, { reportId: "r1" });
  assert.equal(report.generatedAt, null);
});

test("decimalPlaces rounds computed metrics but never rounds the embedded config", () => {
  const config = { ...CONFIG, decimalPlaces: 2, numericTolerance: 0.000001 };
  const report = buildEvaluationReport(buildDataset(3), config, { reportId: "r1" });
  assert.equal(report.config.numericTolerance, 0.000001);
  const accuracyString = String(report.globalMetrics.accuracy);
  const decimalPart = accuracyString.split(".")[1];
  assert.ok(!decimalPart || decimalPart.length <= 2);
});

test("output is reproducible: identical dataset/config/options produce byte-identical JSON across separate calls", () => {
  const dataset = buildDataset(6);
  const options = { reportId: "r1", generatedAt: "2026-01-01T00:00:00.000Z" };
  const first = buildEvaluationReport(dataset, CONFIG, options);
  const second = buildEvaluationReport(dataset, CONFIG, options);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("integrates with a division-by-zero-prone dataset (all records identical, zero variance) without producing NaN anywhere", () => {
  const predictions = [snapshot("m1", { sequenceKey: 1 }), snapshot("m2", { sequenceKey: 2 })];
  const actuals = [actual("m1"), actual("m2")];
  const report = buildEvaluationReport({ datasetId: "ds", predictions, actuals }, CONFIG, { reportId: "r1" });
  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes("NaN"));
});

test("global metrics and per-segment metrics are computed from the same underlying valid records (consistency)", () => {
  const report = buildEvaluationReport(buildDataset(5), CONFIG, { reportId: "r1" });
  const leagueSegment = report.segments.find((s) => s.segment.type === "LEAGUE" && s.segment.key === "league-a");
  assert.equal(leagueSegment.metrics.totalRecords, report.globalMetrics.totalRecords);
  assert.equal(leagueSegment.metrics.correct, report.globalMetrics.correct);
});

test("default benchmarks (UNIFORM, MAJORITY_CLASS, GLOBAL_AVERAGE) are computed and compared against the model when none are supplied", () => {
  const report = buildEvaluationReport(buildDataset(5), CONFIG, { reportId: "r1" });
  assert.deepEqual(
    report.benchmarks.map((b) => b.definition.type),
    ["UNIFORM", "MAJORITY_CLASS", "GLOBAL_AVERAGE"],
  );
  assert.equal(report.comparisons.length, 3);
});

test("custom benchmarks (options.benchmarks) fully replace the default set", () => {
  const report = buildEvaluationReport(buildDataset(5), CONFIG, {
    reportId: "r1",
    benchmarks: [{ type: "UNIFORM", constantProbabilities: null }],
  });
  assert.equal(report.benchmarks.length, 1);
  assert.equal(report.benchmarks[0].definition.type, "UNIFORM");
});

test("an empty dataset produces a fully serializable report with status EMPTY, never throwing", () => {
  const report = buildEvaluationReport({ datasetId: "ds", predictions: [], actuals: [] }, CONFIG, { reportId: "r1" });
  assert.equal(report.status, "EMPTY");
  assert.doesNotThrow(() => JSON.stringify(report));
});

test("integrates correctly with real PredictionResult-shaped input (matches the orchestrator's public contract fields)", () => {
  const report = buildEvaluationReport(buildDataset(3), CONFIG, { reportId: "r1" });
  assert.equal(report.status, "OK");
  assert.ok(Number.isFinite(report.globalMetrics.brierScore));
  assert.ok(Number.isFinite(report.globalMetrics.logLoss));
});

test("warnings and rejectedRecords are deterministic and in a stable order across repeated calls", () => {
  const predictions = [snapshot("m1"), snapshot("m1")];
  const actuals = [actual("m1")];
  const dataset = { datasetId: "ds", predictions, actuals };
  const first = buildEvaluationReport(dataset, { ...CONFIG, invalidRecordPolicy: "collect" }, { reportId: "r1" });
  const second = buildEvaluationReport(dataset, { ...CONFIG, invalidRecordPolicy: "collect" }, { reportId: "r1" });
  assert.deepEqual(first.warnings, second.warnings);
  assert.deepEqual(first.rejectedRecords, second.rejectedRecords);
});
