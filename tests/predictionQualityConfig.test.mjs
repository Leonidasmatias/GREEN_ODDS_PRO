import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREDICTION_QUALITY_CONFIG,
  PREDICTION_QUALITY_MODEL_VERSION,
  PredictionQualityConfigurationError,
  validatePredictionQualityConfig,
} from "../src/services/prediction-quality/PredictionQualityConfig.ts";

function cloneConfig(overrides = {}) {
  return { ...DEFAULT_PREDICTION_QUALITY_CONFIG, ...overrides };
}

test("the default configuration is valid", () => {
  assert.doesNotThrow(() => validatePredictionQualityConfig(DEFAULT_PREDICTION_QUALITY_CONFIG));
});

test("modelVersion carries the documented provisional version string", () => {
  assert.equal(PREDICTION_QUALITY_MODEL_VERSION, "esoccer-prediction-quality-v1.0.0-provisional");
  assert.equal(DEFAULT_PREDICTION_QUALITY_CONFIG.modelVersion, PREDICTION_QUALITY_MODEL_VERSION);
});

test("rejects an empty modelVersion", () => {
  assert.throws(() => validatePredictionQualityConfig(cloneConfig({ modelVersion: "" })), PredictionQualityConfigurationError);
});

test("rejects an invalid calibrationBucketCount", () => {
  assert.throws(() => validatePredictionQualityConfig(cloneConfig({ calibrationBucketCount: 0 })), PredictionQualityConfigurationError);
  assert.throws(() => validatePredictionQualityConfig(cloneConfig({ calibrationBucketCount: -1 })), PredictionQualityConfigurationError);
  assert.throws(() => validatePredictionQualityConfig(cloneConfig({ calibrationBucketCount: 2.5 })), PredictionQualityConfigurationError);
  assert.throws(() => validatePredictionQualityConfig(cloneConfig({ calibrationBucketCount: Number.NaN })), PredictionQualityConfigurationError);
});

test("rejects an invalid confidenceBucketCount", () => {
  assert.throws(() => validatePredictionQualityConfig(cloneConfig({ confidenceBucketCount: 0 })), PredictionQualityConfigurationError);
  assert.throws(() => validatePredictionQualityConfig(cloneConfig({ confidenceBucketCount: 3.3 })), PredictionQualityConfigurationError);
});

test("rejects a negative or non-finite minSampleSizeForMonotonicityCheck", () => {
  assert.throws(
    () => validatePredictionQualityConfig(cloneConfig({ minSampleSizeForMonotonicityCheck: -1 })),
    PredictionQualityConfigurationError,
  );
  assert.throws(
    () => validatePredictionQualityConfig(cloneConfig({ minSampleSizeForMonotonicityCheck: Number.NaN })),
    PredictionQualityConfigurationError,
  );
});

test("rejects a negative or non-finite minSampleSizeForReport", () => {
  assert.throws(() => validatePredictionQualityConfig(cloneConfig({ minSampleSizeForReport: -1 })), PredictionQualityConfigurationError);
  assert.throws(
    () => validatePredictionQualityConfig(cloneConfig({ minSampleSizeForReport: Number.POSITIVE_INFINITY })),
    PredictionQualityConfigurationError,
  );
});

test("accepts a minSampleSizeForMonotonicityCheck/minSampleSizeForReport of exactly zero", () => {
  assert.doesNotThrow(() =>
    validatePredictionQualityConfig(cloneConfig({ minSampleSizeForMonotonicityCheck: 0, minSampleSizeForReport: 0 })),
  );
});
