import test from "node:test";
import assert from "node:assert/strict";
import { compareEvaluations, compareMultiple } from "../src/services/prediction-evaluation/ModelComparisonEngine.ts";
import { DEFAULT_PREDICTION_EVALUATION_CONFIG } from "../src/services/prediction-evaluation/PredictionEvaluationConfig.ts";

function metrics(overrides = {}) {
  return {
    totalRecords: 10,
    validRecords: 10,
    ignoredRecords: 0,
    correct: 7,
    incorrect: 3,
    accuracy: 0.7,
    macroPrecision: 0.7,
    macroRecall: 0.7,
    brierScore: 0.5,
    logLoss: 0.8,
    averageConfidence: 60,
    averagePredictedProbability: 0.6,
    averageObservedOutcome: 0.7,
    ...overrides,
  };
}

function evalResult(label, { status = "OK", metricsOverrides = {} } = {}) {
  return { label, metrics: metrics(metricsOverrides), status };
}

const CONFIG = DEFAULT_PREDICTION_EVALUATION_CONFIG;

test("Accuracy comparison: higher accuracy wins, respecting the higher-is-better direction", () => {
  const a = evalResult("A", { metricsOverrides: { accuracy: 0.6 } });
  const b = evalResult("B", { metricsOverrides: { accuracy: 0.8 } });
  const comparison = compareEvaluations(a, b, CONFIG);
  const accuracyResult = comparison.comparisons.find((c) => c.metricName === "accuracy");
  assert.equal(accuracyResult.direction, "HIGHER_IS_BETTER");
  assert.equal(accuracyResult.winner, "B");
});

test("Brier Score comparison: lower brierScore wins, respecting the lower-is-better direction", () => {
  const a = evalResult("A", { metricsOverrides: { brierScore: 0.9 } });
  const b = evalResult("B", { metricsOverrides: { brierScore: 0.3 } });
  const comparison = compareEvaluations(a, b, CONFIG);
  const brierResult = comparison.comparisons.find((c) => c.metricName === "brierScore");
  assert.equal(brierResult.direction, "LOWER_IS_BETTER");
  assert.equal(brierResult.winner, "B");
});

test("Log Loss comparison: lower logLoss wins, respecting the lower-is-better direction", () => {
  const a = evalResult("A", { metricsOverrides: { logLoss: 1.2 } });
  const b = evalResult("B", { metricsOverrides: { logLoss: 0.4 } });
  const comparison = compareEvaluations(a, b, CONFIG);
  const logLossResult = comparison.comparisons.find((c) => c.metricName === "logLoss");
  assert.equal(logLossResult.direction, "LOWER_IS_BETTER");
  assert.equal(logLossResult.winner, "B");
});

test("a difference within numericTolerance is declared a TIE, not a winner", () => {
  const config = { ...CONFIG, numericTolerance: 0.01 };
  const a = evalResult("A", { metricsOverrides: { accuracy: 0.700 } });
  const b = evalResult("B", { metricsOverrides: { accuracy: 0.705 } });
  const comparison = compareEvaluations(a, b, config);
  const accuracyResult = comparison.comparisons.find((c) => c.metricName === "accuracy");
  assert.equal(accuracyResult.winner, "TIE");
});

test("a metric is UNAVAILABLE (not fabricated) when either side's status is not OK", () => {
  const a = evalResult("A", { status: "INSUFFICIENT_SAMPLE" });
  const b = evalResult("B", { status: "OK" });
  const comparison = compareEvaluations(a, b, CONFIG);
  assert.ok(comparison.comparisons.every((c) => c.winner === "UNAVAILABLE"));
});

test("a metric is UNAVAILABLE when either side's status is EMPTY, with null values (not 0)", () => {
  const a = evalResult("A", { status: "EMPTY" });
  const b = evalResult("B", { status: "OK" });
  const comparison = compareEvaluations(a, b, CONFIG);
  const accuracyResult = comparison.comparisons.find((c) => c.metricName === "accuracy");
  assert.equal(accuracyResult.winner, "UNAVAILABLE");
  assert.equal(accuracyResult.valueA, null);
});

test("overallStatus takes the worse of the two sides' statuses", () => {
  const a = evalResult("A", { status: "OK" });
  const b = evalResult("B", { status: "REJECTED" });
  const comparison = compareEvaluations(a, b, CONFIG);
  assert.equal(comparison.overallStatus, "REJECTED");
});

test("percentageDifference is null (not Infinity/NaN) when valueA is within tolerance of zero", () => {
  const config = { ...CONFIG, numericTolerance: 1e-6 };
  const a = evalResult("A", { metricsOverrides: { brierScore: 0 } });
  const b = evalResult("B", { metricsOverrides: { brierScore: 0.2 } });
  const comparison = compareEvaluations(a, b, config);
  const brierResult = comparison.comparisons.find((c) => c.metricName === "brierScore");
  assert.equal(brierResult.percentageDifference, null);
});

test("compares exactly the five mandatory metrics, never odds/financial fields", () => {
  const comparison = compareEvaluations(evalResult("A"), evalResult("B"), CONFIG);
  assert.deepEqual(
    comparison.comparisons.map((c) => c.metricName).sort(),
    ["accuracy", "brierScore", "logLoss", "macroPrecision", "macroRecall"].sort(),
  );
});

test("compareMultiple compares each pair independently, in the order supplied", () => {
  const pairs = [
    [evalResult("model"), evalResult("benchmark-1", { metricsOverrides: { accuracy: 0.5 } })],
    [evalResult("model"), evalResult("benchmark-2", { metricsOverrides: { accuracy: 0.9 } })],
  ];
  const comparisons = compareMultiple(pairs, CONFIG);
  assert.equal(comparisons.length, 2);
  assert.equal(comparisons[0].labelB, "benchmark-1");
  assert.equal(comparisons[1].labelB, "benchmark-2");
});

test("is deterministic: identical input yields identical comparison output", () => {
  const a = evalResult("A");
  const b = evalResult("B", { metricsOverrides: { accuracy: 0.9 } });
  assert.deepEqual(compareEvaluations(a, b, CONFIG), compareEvaluations(a, b, CONFIG));
});
