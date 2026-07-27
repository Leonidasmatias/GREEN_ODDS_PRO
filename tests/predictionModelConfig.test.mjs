import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREDICTION_MODEL_CONFIG,
  DEFAULT_PREDICTION_MODEL_WEIGHTS,
  DEFAULT_DATA_SUFFICIENCY_THRESHOLDS,
  PREDICTION_MODEL_VERSION,
  PredictionConfigurationError,
  validatePredictionModelConfig,
} from "../src/services/prediction/PredictionModelConfig.ts";

function cloneConfig(overrides = {}) {
  return {
    ...DEFAULT_PREDICTION_MODEL_CONFIG,
    ...overrides,
    weights: { ...DEFAULT_PREDICTION_MODEL_WEIGHTS, ...(overrides.weights ?? {}) },
    dataSufficiencyThresholds: { ...DEFAULT_DATA_SUFFICIENCY_THRESHOLDS, ...(overrides.dataSufficiencyThresholds ?? {}) },
  };
}

test("the default configuration is valid", () => {
  assert.doesNotThrow(() => validatePredictionModelConfig(DEFAULT_PREDICTION_MODEL_CONFIG));
});

test("modelVersion carries the documented provisional version string", () => {
  assert.equal(PREDICTION_MODEL_VERSION, "esoccer-outcome-v1.0.0-provisional");
  assert.equal(DEFAULT_PREDICTION_MODEL_CONFIG.modelVersion, PREDICTION_MODEL_VERSION);
});

test("rejects an empty modelVersion", () => {
  assert.throws(() => validatePredictionModelConfig(cloneConfig({ modelVersion: "" })), PredictionConfigurationError);
});

test("rejects a non-finite temperature", () => {
  assert.throws(() => validatePredictionModelConfig(cloneConfig({ temperature: Number.NaN })), PredictionConfigurationError);
  assert.throws(() => validatePredictionModelConfig(cloneConfig({ temperature: Number.POSITIVE_INFINITY })), PredictionConfigurationError);
});

test("rejects a zero or negative temperature", () => {
  assert.throws(() => validatePredictionModelConfig(cloneConfig({ temperature: 0 })), PredictionConfigurationError);
  assert.throws(() => validatePredictionModelConfig(cloneConfig({ temperature: -1 })), PredictionConfigurationError);
});

test("rejects a formWindow outside {5, 10, 20}", () => {
  assert.throws(() => validatePredictionModelConfig(cloneConfig({ formWindow: 15 })), PredictionConfigurationError);
});

test("rejects a negative weight", () => {
  assert.throws(
    () => validatePredictionModelConfig(cloneConfig({ weights: { ratingDifference: -0.5 } })),
    PredictionConfigurationError,
  );
});

test("rejects a NaN or Infinite weight", () => {
  assert.throws(
    () => validatePredictionModelConfig(cloneConfig({ weights: { formDifference: Number.NaN } })),
    PredictionConfigurationError,
  );
  assert.throws(
    () => validatePredictionModelConfig(cloneConfig({ weights: { formDifference: Number.POSITIVE_INFINITY } })),
    PredictionConfigurationError,
  );
});

test("accepts a weight of exactly zero (disabling a feature is valid)", () => {
  assert.doesNotThrow(() => validatePredictionModelConfig(cloneConfig({ weights: { drawBalance: 0 } })));
});

test("rejects data sufficiency thresholds out of ascending order", () => {
  assert.throws(
    () =>
      validatePredictionModelConfig(
        cloneConfig({ dataSufficiencyThresholds: { minConfidenceForLimited: 60, minConfidenceForSufficient: 50 } }),
      ),
    PredictionConfigurationError,
  );
});

test("rejects a minConfidenceForStrong above 100", () => {
  assert.throws(
    () => validatePredictionModelConfig(cloneConfig({ dataSufficiencyThresholds: { minConfidenceForStrong: 150 } })),
    PredictionConfigurationError,
  );
});

test("rejects a negative data sufficiency threshold", () => {
  assert.throws(
    () => validatePredictionModelConfig(cloneConfig({ dataSufficiencyThresholds: { minHomeAwaySampleSize: -1 } })),
    PredictionConfigurationError,
  );
});
