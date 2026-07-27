import test from "node:test";
import assert from "node:assert/strict";
import * as PredictionLearning from "../src/services/prediction-learning/index.ts";

const EXPECTED_PUBLIC_EXPORTS = [
  "buildLearningReport",
  "buildHistoricalProfiles",
  "compareLearningWindows",
  "detectDrift",
  "buildReliabilityRanking",
  "PREDICTION_LEARNING_MODEL_VERSION",
  "DEFAULT_PREDICTION_LEARNING_CONFIG",
  "DEFAULT_CONFIDENCE_BUCKETS",
  "DEFAULT_RELIABILITY_WEIGHTS",
  "validatePredictionLearningConfig",
  "PredictionLearningConfigurationError",
  "clamp",
  "isFiniteNumber",
  "toLearningHistoricalRecord",
  "GLOBAL_PROFILE_KEY",
];

test("the public barrel exports exactly the documented public API (function/value bindings)", () => {
  const actualExports = Object.keys(PredictionLearning).sort();
  assert.deepEqual(actualExports, [...EXPECTED_PUBLIC_EXPORTS].sort());
});

test("every documented export is defined and of the expected kind", () => {
  assert.equal(typeof PredictionLearning.buildLearningReport, "function");
  assert.equal(typeof PredictionLearning.buildHistoricalProfiles, "function");
  assert.equal(typeof PredictionLearning.compareLearningWindows, "function");
  assert.equal(typeof PredictionLearning.detectDrift, "function");
  assert.equal(typeof PredictionLearning.buildReliabilityRanking, "function");
  assert.equal(typeof PredictionLearning.validatePredictionLearningConfig, "function");
  assert.equal(typeof PredictionLearning.clamp, "function");
  assert.equal(typeof PredictionLearning.isFiniteNumber, "function");
  assert.equal(typeof PredictionLearning.toLearningHistoricalRecord, "function");
  assert.equal(typeof PredictionLearning.PredictionLearningConfigurationError, "function");
  assert.equal(typeof PredictionLearning.PREDICTION_LEARNING_MODEL_VERSION, "string");
  assert.equal(typeof PredictionLearning.GLOBAL_PROFILE_KEY, "string");
  assert.equal(typeof PredictionLearning.DEFAULT_PREDICTION_LEARNING_CONFIG, "object");
  assert.equal(typeof PredictionLearning.DEFAULT_RELIABILITY_WEIGHTS, "object");
  assert.ok(Array.isArray(PredictionLearning.DEFAULT_CONFIDENCE_BUCKETS));
});

test("PredictionLearningConfigurationError is a real Error subclass, throwable and catchable", () => {
  const error = new PredictionLearning.PredictionLearningConfigurationError("test message");
  assert.ok(error instanceof Error);
  assert.equal(error.message, "test message");
  assert.equal(error.name, "PredictionLearningConfigurationError");
});

test("internal-only helpers are never re-exported (validation, window slicing, pair conversion, rounding)", () => {
  const forbiddenNames = ["findInvalidLearningReason", "sliceBySequenceWindow", "toEvaluationPair", "computeHistoricalProfiles", "roundDeep", "roundNumber", "worseStatus"];
  for (const name of forbiddenNames) {
    assert.ok(!(name in PredictionLearning), `${name} should not be part of the public barrel`);
  }
});
