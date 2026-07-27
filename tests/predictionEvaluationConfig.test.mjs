import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREDICTION_EVALUATION_CONFIG,
  DEFAULT_CONFIDENCE_BUCKETS,
  PREDICTION_EVALUATION_MODEL_VERSION,
  PredictionEvaluationConfigurationError,
  validatePredictionEvaluationConfig,
} from "../src/services/prediction-evaluation/PredictionEvaluationConfig.ts";

function cloneConfig(overrides = {}) {
  return { ...DEFAULT_PREDICTION_EVALUATION_CONFIG, ...overrides };
}

test("the default configuration is valid", () => {
  assert.doesNotThrow(() => validatePredictionEvaluationConfig(DEFAULT_PREDICTION_EVALUATION_CONFIG));
});

test("modelVersion carries the documented provisional version string", () => {
  assert.equal(PREDICTION_EVALUATION_MODEL_VERSION, "esoccer-prediction-evaluation-v1.0.0-provisional");
  assert.equal(DEFAULT_PREDICTION_EVALUATION_CONFIG.modelVersion, PREDICTION_EVALUATION_MODEL_VERSION);
});

test("a partial, valid override (only one field changed) is accepted", () => {
  const config = cloneConfig({ minRecordsForEvaluation: 50 });
  assert.doesNotThrow(() => validatePredictionEvaluationConfig(config));
  assert.equal(config.minRecordsForEvaluation, 50);
  assert.equal(config.minRecordsPerSegment, DEFAULT_PREDICTION_EVALUATION_CONFIG.minRecordsPerSegment);
});

test("rejects an empty modelVersion", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ modelVersion: "" })), PredictionEvaluationConfigurationError);
});

test("rejects a negative or non-integer minRecordsForEvaluation", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ minRecordsForEvaluation: -1 })), PredictionEvaluationConfigurationError);
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ minRecordsForEvaluation: 2.5 })), PredictionEvaluationConfigurationError);
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ minRecordsForEvaluation: Number.NaN })), PredictionEvaluationConfigurationError);
});

test("rejects a negative or non-integer minRecordsPerSegment", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ minRecordsPerSegment: -1 })), PredictionEvaluationConfigurationError);
});

test("accepts minRecordsForEvaluation/minRecordsPerSegment of exactly zero", () => {
  assert.doesNotThrow(() => validatePredictionEvaluationConfig(cloneConfig({ minRecordsForEvaluation: 0, minRecordsPerSegment: 0 })));
});

test("rejects confidenceBuckets with fewer than 2 boundaries", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ confidenceBuckets: [0] })), PredictionEvaluationConfigurationError);
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ confidenceBuckets: [] })), PredictionEvaluationConfigurationError);
});

test("rejects a confidenceBuckets boundary outside [0, 100]", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ confidenceBuckets: [0, 50, 150] })), PredictionEvaluationConfigurationError);
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ confidenceBuckets: [-10, 50, 100] })), PredictionEvaluationConfigurationError);
});

test("rejects confidenceBuckets that do not start at 0", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ confidenceBuckets: [10, 50, 100] })), PredictionEvaluationConfigurationError);
});

test("rejects confidenceBuckets that do not end at 100", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ confidenceBuckets: [0, 50, 90] })), PredictionEvaluationConfigurationError);
});

test("rejects confidenceBuckets with a gap or overlap (not strictly increasing)", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ confidenceBuckets: [0, 50, 50, 100] })), PredictionEvaluationConfigurationError);
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ confidenceBuckets: [0, 60, 40, 100] })), PredictionEvaluationConfigurationError);
});

test("rejects a NaN or Infinite confidenceBuckets value", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ confidenceBuckets: [0, Number.NaN, 100] })), PredictionEvaluationConfigurationError);
});

test("rejects an invalid invalidRecordPolicy", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ invalidRecordPolicy: "ignore" })), PredictionEvaluationConfigurationError);
});

test("accepts all three valid invalidRecordPolicy values", () => {
  for (const policy of ["reject", "skip", "collect"]) {
    assert.doesNotThrow(() => validatePredictionEvaluationConfig(cloneConfig({ invalidRecordPolicy: policy })));
  }
});

test("rejects an invalid decimalPlaces", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ decimalPlaces: -1 })), PredictionEvaluationConfigurationError);
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ decimalPlaces: 2.5 })), PredictionEvaluationConfigurationError);
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ decimalPlaces: 16 })), PredictionEvaluationConfigurationError);
});

test("rejects a negative or non-finite numericTolerance", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ numericTolerance: -0.1 })), PredictionEvaluationConfigurationError);
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ numericTolerance: Number.NaN })), PredictionEvaluationConfigurationError);
});

test("accepts a numericTolerance of exactly zero", () => {
  assert.doesNotThrow(() => validatePredictionEvaluationConfig(cloneConfig({ numericTolerance: 0 })));
});

test("rejects an empty enabledSegments array", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ enabledSegments: [] })), PredictionEvaluationConfigurationError);
});

test("rejects an unknown segment type in enabledSegments", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ enabledSegments: ["NOT_A_REAL_SEGMENT"] })), PredictionEvaluationConfigurationError);
});

test("rejects an invalid emptyDatasetBehavior", () => {
  assert.throws(() => validatePredictionEvaluationConfig(cloneConfig({ emptyDatasetBehavior: "IGNORE" })), PredictionEvaluationConfigurationError);
});

test("DEFAULT_CONFIDENCE_BUCKETS is a valid, ready-to-use bucket definition", () => {
  assert.deepEqual(DEFAULT_CONFIDENCE_BUCKETS, [0, 20, 40, 60, 80, 100]);
  assert.doesNotThrow(() => validatePredictionEvaluationConfig(cloneConfig({ confidenceBuckets: DEFAULT_CONFIDENCE_BUCKETS })));
});
