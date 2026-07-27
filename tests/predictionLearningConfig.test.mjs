import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREDICTION_LEARNING_CONFIG,
  DEFAULT_CONFIDENCE_BUCKETS,
  DEFAULT_RELIABILITY_WEIGHTS,
  PREDICTION_LEARNING_MODEL_VERSION,
  PredictionLearningConfigurationError,
  validatePredictionLearningConfig,
} from "../src/services/prediction-learning/PredictionLearningConfig.ts";

function cloneConfig(overrides = {}) {
  return { ...DEFAULT_PREDICTION_LEARNING_CONFIG, ...overrides };
}

test("the default configuration is valid", () => {
  assert.doesNotThrow(() => validatePredictionLearningConfig(DEFAULT_PREDICTION_LEARNING_CONFIG));
});

test("modelVersion carries the documented provisional version string", () => {
  assert.equal(PREDICTION_LEARNING_MODEL_VERSION, "esoccer-prediction-learning-v1.0.0-provisional");
  assert.equal(DEFAULT_PREDICTION_LEARNING_CONFIG.modelVersion, PREDICTION_LEARNING_MODEL_VERSION);
});

test("a partial, valid override (only one field changed) is accepted", () => {
  const config = cloneConfig({ minimumRecordsPerProfile: 50 });
  assert.doesNotThrow(() => validatePredictionLearningConfig(config));
  assert.equal(config.minimumRecordsPerProfile, 50);
  assert.equal(config.minimumRecordsPerWindow, DEFAULT_PREDICTION_LEARNING_CONFIG.minimumRecordsPerWindow);
});

test("rejects an empty modelVersion", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ modelVersion: "" })), PredictionLearningConfigurationError);
});

test("rejects a negative or non-integer minimumRecordsPerProfile/PerWindow/ForDrift", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ minimumRecordsPerProfile: -1 })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ minimumRecordsPerProfile: 2.5 })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ minimumRecordsPerWindow: -1 })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ minimumRecordsForDrift: Number.NaN })), PredictionLearningConfigurationError);
});

test("accepts minimumRecords*/ of exactly zero", () => {
  assert.doesNotThrow(() =>
    validatePredictionLearningConfig(cloneConfig({ minimumRecordsPerProfile: 0, minimumRecordsPerWindow: 0, minimumRecordsForDrift: 0 })),
  );
});

test("rejects a negative or non-finite drift threshold (accuracy/brier/logLoss/confidence)", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ accuracyDriftThreshold: -0.1 })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ brierDriftThreshold: Number.NaN })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ logLossDriftThreshold: -1 })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ confidenceDriftThreshold: Number.POSITIVE_INFINITY })), PredictionLearningConfigurationError);
});

test("rejects a non-positive warningSeverityMultiplier", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ warningSeverityMultiplier: 0 })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ warningSeverityMultiplier: -1 })), PredictionLearningConfigurationError);
});

test("rejects criticalSeverityMultiplier that is not strictly greater than warningSeverityMultiplier", () => {
  assert.throws(
    () => validatePredictionLearningConfig(cloneConfig({ warningSeverityMultiplier: 2, criticalSeverityMultiplier: 2 })),
    PredictionLearningConfigurationError,
  );
  assert.throws(
    () => validatePredictionLearningConfig(cloneConfig({ warningSeverityMultiplier: 2, criticalSeverityMultiplier: 1 })),
    PredictionLearningConfigurationError,
  );
});

test("rejects confidenceBuckets with fewer than 2 boundaries, out of [0,100], not starting at 0, not ending at 100, or with gaps/overlaps", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ confidenceBuckets: [0] })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ confidenceBuckets: [0, 50, 150] })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ confidenceBuckets: [10, 50, 100] })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ confidenceBuckets: [0, 50, 90] })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ confidenceBuckets: [0, 50, 50, 100] })), PredictionLearningConfigurationError);
});

test("rejects an invalid decimalPlaces", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ decimalPlaces: -1 })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ decimalPlaces: 16 })), PredictionLearningConfigurationError);
});

test("rejects a negative or non-finite numericTolerance", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ numericTolerance: -0.1 })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ numericTolerance: Number.NaN })), PredictionLearningConfigurationError);
});

test("rejects an invalid invalidRecordPolicy", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ invalidRecordPolicy: "ignore" })), PredictionLearningConfigurationError);
});

test("accepts all three valid invalidRecordPolicy values", () => {
  for (const policy of ["reject", "skip", "collect"]) {
    assert.doesNotThrow(() => validatePredictionLearningConfig(cloneConfig({ invalidRecordPolicy: policy })));
  }
});

test("rejects an empty or unknown enabledDimensions", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ enabledDimensions: [] })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ enabledDimensions: ["NOT_A_REAL_DIMENSION"] })), PredictionLearningConfigurationError);
});

test("rejects a reliabilityWeights that is not an object (or is null)", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ reliabilityWeights: null })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ reliabilityWeights: "not-an-object" })), PredictionLearningConfigurationError);
});

test("rejects reliabilityWeights with a negative or non-finite component", () => {
  assert.throws(
    () => validatePredictionLearningConfig(cloneConfig({ reliabilityWeights: { ...DEFAULT_RELIABILITY_WEIGHTS, accuracy: -1 } })),
    PredictionLearningConfigurationError,
  );
  assert.throws(
    () => validatePredictionLearningConfig(cloneConfig({ reliabilityWeights: { ...DEFAULT_RELIABILITY_WEIGHTS, brierScore: Number.NaN } })),
    PredictionLearningConfigurationError,
  );
});

test("rejects reliabilityWeights that all sum to zero", () => {
  const allZero = { accuracy: 0, macroPrecision: 0, macroRecall: 0, brierScore: 0, logLoss: 0, sampleSize: 0, stability: 0 };
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ reliabilityWeights: allZero })), PredictionLearningConfigurationError);
});

test("accepts reliabilityWeights where only one component is non-zero", () => {
  const onlyAccuracy = { accuracy: 1, macroPrecision: 0, macroRecall: 0, brierScore: 0, logLoss: 0, sampleSize: 0, stability: 0 };
  assert.doesNotThrow(() => validatePredictionLearningConfig(cloneConfig({ reliabilityWeights: onlyAccuracy })));
});

test("rejects a non-positive reliabilityLogLossCap", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ reliabilityLogLossCap: 0 })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ reliabilityLogLossCap: -1 })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ reliabilityLogLossCap: Number.NaN })), PredictionLearningConfigurationError);
});

test("rejects a driftSeverityPenalty that is not an object, or with a component outside [0,1]", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ driftSeverityPenalty: null })), PredictionLearningConfigurationError);
  assert.throws(
    () => validatePredictionLearningConfig(cloneConfig({ driftSeverityPenalty: { INFO: -0.1, WARNING: 0.3, CRITICAL: 0.6 } })),
    PredictionLearningConfigurationError,
  );
  assert.throws(
    () => validatePredictionLearningConfig(cloneConfig({ driftSeverityPenalty: { INFO: 0.1, WARNING: 1.5, CRITICAL: 0.6 } })),
    PredictionLearningConfigurationError,
  );
});

test("rejects an insufficientSampleScoreCeiling outside [0, 100]", () => {
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ insufficientSampleScoreCeiling: -1 })), PredictionLearningConfigurationError);
  assert.throws(() => validatePredictionLearningConfig(cloneConfig({ insufficientSampleScoreCeiling: 101 })), PredictionLearningConfigurationError);
});

test("accepts an insufficientSampleScoreCeiling of exactly 0 or 100", () => {
  assert.doesNotThrow(() => validatePredictionLearningConfig(cloneConfig({ insufficientSampleScoreCeiling: 0 })));
  assert.doesNotThrow(() => validatePredictionLearningConfig(cloneConfig({ insufficientSampleScoreCeiling: 100 })));
});

test("DEFAULT_CONFIDENCE_BUCKETS is a valid, ready-to-use bucket definition", () => {
  assert.deepEqual(DEFAULT_CONFIDENCE_BUCKETS, [0, 20, 40, 60, 80, 100]);
  assert.doesNotThrow(() => validatePredictionLearningConfig(cloneConfig({ confidenceBuckets: DEFAULT_CONFIDENCE_BUCKETS })));
});
