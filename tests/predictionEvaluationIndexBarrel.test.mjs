import test from "node:test";
import assert from "node:assert/strict";
import * as PredictionEvaluation from "../src/services/prediction-evaluation/index.ts";

const EXPECTED_PUBLIC_EXPORTS = [
  "buildEvaluationReport",
  "evaluateHistoricalDataset",
  "computeEvaluationMetrics",
  "computeSegmentEvaluations",
  "toOutcomeProbabilityPair",
  "computeBenchmark",
  "computeBenchmarks",
  "compareEvaluations",
  "compareMultiple",
  "PREDICTION_EVALUATION_MODEL_VERSION",
  "DEFAULT_PREDICTION_EVALUATION_CONFIG",
  "DEFAULT_CONFIDENCE_BUCKETS",
  "validatePredictionEvaluationConfig",
  "PredictionEvaluationConfigurationError",
  "clamp",
  "isFiniteNumber",
  "toPredictionQualityRecord",
];

test("the public barrel exports exactly the documented public API (function/value bindings)", () => {
  const actualExports = Object.keys(PredictionEvaluation).sort();
  assert.deepEqual(actualExports, [...EXPECTED_PUBLIC_EXPORTS].sort());
});

test("every documented export is defined and of the expected kind", () => {
  assert.equal(typeof PredictionEvaluation.buildEvaluationReport, "function");
  assert.equal(typeof PredictionEvaluation.evaluateHistoricalDataset, "function");
  assert.equal(typeof PredictionEvaluation.computeEvaluationMetrics, "function");
  assert.equal(typeof PredictionEvaluation.computeSegmentEvaluations, "function");
  assert.equal(typeof PredictionEvaluation.toOutcomeProbabilityPair, "function");
  assert.equal(typeof PredictionEvaluation.computeBenchmark, "function");
  assert.equal(typeof PredictionEvaluation.computeBenchmarks, "function");
  assert.equal(typeof PredictionEvaluation.compareEvaluations, "function");
  assert.equal(typeof PredictionEvaluation.compareMultiple, "function");
  assert.equal(typeof PredictionEvaluation.validatePredictionEvaluationConfig, "function");
  assert.equal(typeof PredictionEvaluation.clamp, "function");
  assert.equal(typeof PredictionEvaluation.isFiniteNumber, "function");
  assert.equal(typeof PredictionEvaluation.toPredictionQualityRecord, "function");
  assert.equal(typeof PredictionEvaluation.PREDICTION_EVALUATION_MODEL_VERSION, "string");
  assert.equal(typeof PredictionEvaluation.DEFAULT_PREDICTION_EVALUATION_CONFIG, "object");
  assert.ok(Array.isArray(PredictionEvaluation.DEFAULT_CONFIDENCE_BUCKETS));
  assert.equal(typeof PredictionEvaluation.PredictionEvaluationConfigurationError, "function");
});

test("PredictionEvaluationConfigurationError is a real Error subclass, throwable and catchable", () => {
  const error = new PredictionEvaluation.PredictionEvaluationConfigurationError("test message");
  assert.ok(error instanceof Error);
  assert.equal(error.message, "test message");
});

test("internal-only helpers are never re-exported (pickWinner, brier/logLoss formulas, rounding, grouping helpers)", () => {
  const forbiddenNames = ["pickWinner", "brierScoreForPair", "logLossForPair", "roundDeep", "roundNumber", "groupBySingleKey", "sortedEntries"];
  for (const name of forbiddenNames) {
    assert.ok(!(name in PredictionEvaluation), `${name} should not be part of the public barrel`);
  }
});
