import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREDICTION_OBSERVABILITY_CONFIG,
  DEFAULT_MONITORING_STATUS_BY_RECOMMENDATION,
  PREDICTION_OBSERVABILITY_MODEL_VERSION,
  PredictionObservabilityConfigurationError,
  validatePredictionObservabilityConfig,
} from "../src/services/prediction-observability/PredictionObservabilityConfig.ts";

function cloneConfig(overrides = {}) {
  return { ...DEFAULT_PREDICTION_OBSERVABILITY_CONFIG, ...overrides };
}

test("the default configuration is valid", () => {
  assert.doesNotThrow(() => validatePredictionObservabilityConfig(DEFAULT_PREDICTION_OBSERVABILITY_CONFIG));
});

test("modelVersion carries the documented provisional version string", () => {
  assert.equal(PREDICTION_OBSERVABILITY_MODEL_VERSION, "esoccer-prediction-observability-v1.0.0-provisional");
  assert.equal(DEFAULT_PREDICTION_OBSERVABILITY_CONFIG.modelVersion, PREDICTION_OBSERVABILITY_MODEL_VERSION);
});

test("a partial, valid override (only one field changed) is accepted", () => {
  const config = cloneConfig({ maxTimelineEvents: 10 });
  assert.doesNotThrow(() => validatePredictionObservabilityConfig(config));
  assert.equal(config.maxTimelineEvents, 10);
  assert.equal(config.lowReliabilityAlertThreshold, DEFAULT_PREDICTION_OBSERVABILITY_CONFIG.lowReliabilityAlertThreshold);
});

test("rejects an empty modelVersion", () => {
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ modelVersion: "" })), PredictionObservabilityConfigurationError);
});

test("rejects lowReliabilityAlertThreshold/recoveryReliabilityThreshold outside [0,100]", () => {
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ lowReliabilityAlertThreshold: -1 })), PredictionObservabilityConfigurationError);
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ lowReliabilityAlertThreshold: 101 })), PredictionObservabilityConfigurationError);
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ recoveryReliabilityThreshold: Number.NaN })), PredictionObservabilityConfigurationError);
});

test("accepts thresholds of exactly 0 or 100", () => {
  assert.doesNotThrow(() => validatePredictionObservabilityConfig(cloneConfig({ lowReliabilityAlertThreshold: 0, recoveryReliabilityThreshold: 100 })));
});

test("rejects a continuousDriftMinMetricCount below 1 or non-integer", () => {
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ continuousDriftMinMetricCount: 0 })), PredictionObservabilityConfigurationError);
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ continuousDriftMinMetricCount: 1.5 })), PredictionObservabilityConfigurationError);
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ continuousDriftMinMetricCount: -1 })), PredictionObservabilityConfigurationError);
});

test("accepts continuousDriftMinMetricCount of exactly 1", () => {
  assert.doesNotThrow(() => validatePredictionObservabilityConfig(cloneConfig({ continuousDriftMinMetricCount: 1 })));
});

test("rejects a negative or non-integer maxTimelineEvents", () => {
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ maxTimelineEvents: -1 })), PredictionObservabilityConfigurationError);
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ maxTimelineEvents: 2.5 })), PredictionObservabilityConfigurationError);
});

test("accepts maxTimelineEvents of exactly zero", () => {
  assert.doesNotThrow(() => validatePredictionObservabilityConfig(cloneConfig({ maxTimelineEvents: 0 })));
});

test("rejects a monitoringStatusByRecommendation that is not an object, or missing a RecommendationType key", () => {
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ monitoringStatusByRecommendation: null })), PredictionObservabilityConfigurationError);
  const missingKey = { ...DEFAULT_MONITORING_STATUS_BY_RECOMMENDATION };
  delete missingKey.PROFILE_STABLE;
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ monitoringStatusByRecommendation: missingKey })), PredictionObservabilityConfigurationError);
});

test("rejects a monitoringStatusByRecommendation with an invalid MonitoringStatus value", () => {
  assert.throws(
    () =>
      validatePredictionObservabilityConfig(
        cloneConfig({ monitoringStatusByRecommendation: { ...DEFAULT_MONITORING_STATUS_BY_RECOMMENDATION, PROFILE_STABLE: "GREAT" } }),
      ),
    PredictionObservabilityConfigurationError,
  );
});

test("rejects an invalid decimalPlaces", () => {
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ decimalPlaces: -1 })), PredictionObservabilityConfigurationError);
  assert.throws(() => validatePredictionObservabilityConfig(cloneConfig({ decimalPlaces: 16 })), PredictionObservabilityConfigurationError);
});

test("DEFAULT_MONITORING_STATUS_BY_RECOMMENDATION covers all six RecommendationType values", () => {
  const expectedTypes = ["REDUCE_CONFIDENCE", "INCREASE_MONITORING", "TEMPORARILY_DISABLE_PROFILE", "PROFILE_STABLE", "PROFILE_IMPROVING", "NEEDS_MORE_DATA"];
  assert.deepEqual(Object.keys(DEFAULT_MONITORING_STATUS_BY_RECOMMENDATION).sort(), expectedTypes.sort());
});
