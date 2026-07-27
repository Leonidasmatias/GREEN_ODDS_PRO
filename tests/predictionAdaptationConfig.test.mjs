import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREDICTION_ADAPTATION_CONFIG,
  DEFAULT_CONFIDENCE_MULTIPLIERS,
  DEFAULT_RISK_LEVEL_BY_RECOMMENDATION,
  PREDICTION_ADAPTATION_MODEL_VERSION,
  PredictionAdaptationConfigurationError,
  validatePredictionAdaptationConfig,
} from "../src/services/prediction-adaptation/PredictionAdaptationConfig.ts";

function cloneConfig(overrides = {}) {
  return { ...DEFAULT_PREDICTION_ADAPTATION_CONFIG, ...overrides };
}

test("the default configuration is valid", () => {
  assert.doesNotThrow(() => validatePredictionAdaptationConfig(DEFAULT_PREDICTION_ADAPTATION_CONFIG));
});

test("modelVersion carries the documented provisional version string", () => {
  assert.equal(PREDICTION_ADAPTATION_MODEL_VERSION, "esoccer-prediction-adaptation-v1.0.0-provisional");
  assert.equal(DEFAULT_PREDICTION_ADAPTATION_CONFIG.modelVersion, PREDICTION_ADAPTATION_MODEL_VERSION);
});

test("a partial, valid override (only one field changed) is accepted", () => {
  const config = cloneConfig({ riskReliabilityFloor: 30 });
  assert.doesNotThrow(() => validatePredictionAdaptationConfig(config));
  assert.equal(config.riskReliabilityFloor, 30);
  assert.equal(config.strategyLowReliabilityThreshold, DEFAULT_PREDICTION_ADAPTATION_CONFIG.strategyLowReliabilityThreshold);
});

test("rejects an empty modelVersion", () => {
  assert.throws(() => validatePredictionAdaptationConfig(cloneConfig({ modelVersion: "" })), PredictionAdaptationConfigurationError);
});

test("rejects a confidenceMultipliers that is not an object, or missing a RecommendationType key", () => {
  assert.throws(() => validatePredictionAdaptationConfig(cloneConfig({ confidenceMultipliers: null })), PredictionAdaptationConfigurationError);
  const missingKey = { ...DEFAULT_CONFIDENCE_MULTIPLIERS };
  delete missingKey.PROFILE_STABLE;
  assert.throws(() => validatePredictionAdaptationConfig(cloneConfig({ confidenceMultipliers: missingKey })), PredictionAdaptationConfigurationError);
});

test("rejects a confidenceMultipliers value outside [0,1]", () => {
  assert.throws(
    () => validatePredictionAdaptationConfig(cloneConfig({ confidenceMultipliers: { ...DEFAULT_CONFIDENCE_MULTIPLIERS, REDUCE_CONFIDENCE: 1.5 } })),
    PredictionAdaptationConfigurationError,
  );
  assert.throws(
    () => validatePredictionAdaptationConfig(cloneConfig({ confidenceMultipliers: { ...DEFAULT_CONFIDENCE_MULTIPLIERS, REDUCE_CONFIDENCE: -0.1 } })),
    PredictionAdaptationConfigurationError,
  );
  assert.throws(
    () => validatePredictionAdaptationConfig(cloneConfig({ confidenceMultipliers: { ...DEFAULT_CONFIDENCE_MULTIPLIERS, REDUCE_CONFIDENCE: Number.NaN } })),
    PredictionAdaptationConfigurationError,
  );
});

test("rejects a riskLevelByRecommendation that is not an object, or with an invalid RiskLevel value", () => {
  assert.throws(() => validatePredictionAdaptationConfig(cloneConfig({ riskLevelByRecommendation: null })), PredictionAdaptationConfigurationError);
  assert.throws(
    () =>
      validatePredictionAdaptationConfig(
        cloneConfig({ riskLevelByRecommendation: { ...DEFAULT_RISK_LEVEL_BY_RECOMMENDATION, REDUCE_CONFIDENCE: "SEVERE" } }),
      ),
    PredictionAdaptationConfigurationError,
  );
});

test("rejects recommendationLowReliabilityThreshold/strategyLowReliabilityThreshold/riskReliabilityFloor outside [0,100]", () => {
  assert.throws(() => validatePredictionAdaptationConfig(cloneConfig({ recommendationLowReliabilityThreshold: -1 })), PredictionAdaptationConfigurationError);
  assert.throws(() => validatePredictionAdaptationConfig(cloneConfig({ recommendationLowReliabilityThreshold: 101 })), PredictionAdaptationConfigurationError);
  assert.throws(() => validatePredictionAdaptationConfig(cloneConfig({ strategyLowReliabilityThreshold: Number.NaN })), PredictionAdaptationConfigurationError);
  assert.throws(() => validatePredictionAdaptationConfig(cloneConfig({ riskReliabilityFloor: 200 })), PredictionAdaptationConfigurationError);
});

test("accepts thresholds of exactly 0 or 100", () => {
  assert.doesNotThrow(() =>
    validatePredictionAdaptationConfig(
      cloneConfig({ recommendationLowReliabilityThreshold: 0, strategyLowReliabilityThreshold: 100, riskReliabilityFloor: 0 }),
    ),
  );
});

test("rejects an invalid decimalPlaces", () => {
  assert.throws(() => validatePredictionAdaptationConfig(cloneConfig({ decimalPlaces: -1 })), PredictionAdaptationConfigurationError);
  assert.throws(() => validatePredictionAdaptationConfig(cloneConfig({ decimalPlaces: 16 })), PredictionAdaptationConfigurationError);
  assert.throws(() => validatePredictionAdaptationConfig(cloneConfig({ decimalPlaces: 2.5 })), PredictionAdaptationConfigurationError);
});

test("DEFAULT_CONFIDENCE_MULTIPLIERS and DEFAULT_RISK_LEVEL_BY_RECOMMENDATION cover all six RecommendationType values", () => {
  const expectedTypes = ["REDUCE_CONFIDENCE", "INCREASE_MONITORING", "TEMPORARILY_DISABLE_PROFILE", "PROFILE_STABLE", "PROFILE_IMPROVING", "NEEDS_MORE_DATA"];
  assert.deepEqual(Object.keys(DEFAULT_CONFIDENCE_MULTIPLIERS).sort(), expectedTypes.sort());
  assert.deepEqual(Object.keys(DEFAULT_RISK_LEVEL_BY_RECOMMENDATION).sort(), expectedTypes.sort());
});
