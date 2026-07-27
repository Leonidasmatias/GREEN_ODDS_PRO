import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG,
  DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES,
  DEFAULT_CONSISTENCY_THRESHOLDS,
  DEFAULT_CONSISTENCY_ADJUSTMENTS,
  DEFAULT_CONFIDENCE_WEIGHTS,
  DEFAULT_GREEN_SCORE_WEIGHTS,
  DEFAULT_GREEN_SCORE_THRESHOLDS,
  DEFAULT_EXPLANATION_CONFIG,
  PREDICTION_ORCHESTRATOR_MODEL_VERSION,
  PredictionOrchestratorConfigurationError,
  validatePredictionOrchestratorConfig,
} from "../src/services/prediction-orchestrator/PredictionOrchestratorConfig.ts";
import { DEFAULT_PREDICTION_MODEL_CONFIG } from "../src/services/prediction/index.ts";
import { DEFAULT_GOAL_DISTRIBUTION_CONFIG } from "../src/services/goal-distribution/index.ts";

function cloneConfig(overrides = {}) {
  return {
    ...DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG,
    ...overrides,
    predictionConfig: overrides.predictionConfig ?? DEFAULT_PREDICTION_MODEL_CONFIG,
    goalDistributionConfig: overrides.goalDistributionConfig ?? DEFAULT_GOAL_DISTRIBUTION_CONFIG,
    dataSufficiencyStatusScores: { ...DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES, ...(overrides.dataSufficiencyStatusScores ?? {}) },
    consistencyThresholds: { ...DEFAULT_CONSISTENCY_THRESHOLDS, ...(overrides.consistencyThresholds ?? {}) },
    consistencyAdjustments: { ...DEFAULT_CONSISTENCY_ADJUSTMENTS, ...(overrides.consistencyAdjustments ?? {}) },
    confidenceWeights: { ...DEFAULT_CONFIDENCE_WEIGHTS, ...(overrides.confidenceWeights ?? {}) },
    greenScoreWeights: { ...DEFAULT_GREEN_SCORE_WEIGHTS, ...(overrides.greenScoreWeights ?? {}) },
    greenScoreThresholds: { ...DEFAULT_GREEN_SCORE_THRESHOLDS, ...(overrides.greenScoreThresholds ?? {}) },
    explanation: { ...DEFAULT_EXPLANATION_CONFIG, ...(overrides.explanation ?? {}) },
  };
}

test("the default configuration is valid", () => {
  assert.doesNotThrow(() => validatePredictionOrchestratorConfig(DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG));
});

test("modelVersion carries the documented provisional version string", () => {
  assert.equal(PREDICTION_ORCHESTRATOR_MODEL_VERSION, "esoccer-orchestrator-v1.0.0-provisional");
  assert.equal(DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG.modelVersion, PREDICTION_ORCHESTRATOR_MODEL_VERSION);
});

test("rejects an empty modelVersion", () => {
  assert.throws(() => validatePredictionOrchestratorConfig(cloneConfig({ modelVersion: "" })), PredictionOrchestratorConfigurationError);
});

test("rejects an invalid nested predictionConfig, wrapping the Sprint 4.1 error", () => {
  const invalidPredictionConfig = { ...DEFAULT_PREDICTION_MODEL_CONFIG, temperature: -1 };
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ predictionConfig: invalidPredictionConfig })),
    (error) => error instanceof PredictionOrchestratorConfigurationError && error.message.includes("predictionConfig inválido"),
  );
});

test("rejects an invalid nested goalDistributionConfig, wrapping the Sprint 4.2 error", () => {
  const invalidGoalDistributionConfig = { ...DEFAULT_GOAL_DISTRIBUTION_CONFIG, minLambda: -1 };
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ goalDistributionConfig: invalidGoalDistributionConfig })),
    (error) => error instanceof PredictionOrchestratorConfigurationError && error.message.includes("goalDistributionConfig inválido"),
  );
});

test("rejects a dataSufficiencyStatusScores value outside [0, 100]", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ dataSufficiencyStatusScores: { STRONG: 150 } })),
    PredictionOrchestratorConfigurationError,
  );
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ dataSufficiencyStatusScores: { INSUFFICIENT: -1 } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects a NaN or Infinite dataSufficiencyStatusScores value", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ dataSufficiencyStatusScores: { LIMITED: Number.NaN } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects dataSufficiencyStatusScores out of ascending order", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ dataSufficiencyStatusScores: { LIMITED: 80, SUFFICIENT: 70 } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects an out-of-range consistencyThresholds.alignedThreshold", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ consistencyThresholds: { alignedThreshold: -0.1 } })),
    PredictionOrchestratorConfigurationError,
  );
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ consistencyThresholds: { alignedThreshold: 1.5 } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects majorDivergenceThreshold <= alignedThreshold", () => {
  assert.throws(
    () =>
      validatePredictionOrchestratorConfig(
        cloneConfig({ consistencyThresholds: { alignedThreshold: 0.2, majorDivergenceThreshold: 0.1 } }),
      ),
    PredictionOrchestratorConfigurationError,
  );
  assert.throws(
    () =>
      validatePredictionOrchestratorConfig(
        cloneConfig({ consistencyThresholds: { alignedThreshold: 0.2, majorDivergenceThreshold: 0.2 } }),
      ),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects majorDivergenceThreshold above 1", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ consistencyThresholds: { majorDivergenceThreshold: 1.1 } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects a negative consistencyAdjustments value", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ consistencyAdjustments: { alignedBonus: -1 } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects majorDivergencePenalty smaller than minorDivergencePenalty", () => {
  assert.throws(
    () =>
      validatePredictionOrchestratorConfig(
        cloneConfig({ consistencyAdjustments: { minorDivergencePenalty: 20, majorDivergencePenalty: 5 } }),
      ),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects a negative confidenceWeights value", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ confidenceWeights: { signalCount: -0.1 } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects confidenceWeights summing to zero", () => {
  assert.throws(
    () =>
      validatePredictionOrchestratorConfig(
        cloneConfig({ confidenceWeights: { predictionConfidence: 0, goalDistributionConfidence: 0, signalCount: 0 } }),
      ),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects a negative greenScoreWeights value", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ greenScoreWeights: { dataQuality: -0.1 } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects greenScoreWeights summing to zero", () => {
  assert.throws(
    () =>
      validatePredictionOrchestratorConfig(
        cloneConfig({
          greenScoreWeights: {
            predictionConfidence: 0,
            goalDistributionConfidence: 0,
            dataQuality: 0,
            headToHeadReliability: 0,
            formReliability: 0,
          },
        }),
      ),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects greenScoreThresholds out of ascending order", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ greenScoreThresholds: { lowMax: 70, mediumMax: 60 } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects a greenScoreThresholds value outside [0, 100]", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ greenScoreThresholds: { highMax: 150 } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects an invalid explanation.topSignalsCount", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ explanation: { topSignalsCount: 0 } })),
    PredictionOrchestratorConfigurationError,
  );
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ explanation: { topSignalsCount: 2.5 } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects a non-positive or non-finite explanation.lowScoringTotalGoalsThreshold", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ explanation: { lowScoringTotalGoalsThreshold: 0 } })),
    PredictionOrchestratorConfigurationError,
  );
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ explanation: { lowScoringTotalGoalsThreshold: Number.NaN } })),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects highScoringTotalGoalsThreshold <= lowScoringTotalGoalsThreshold", () => {
  assert.throws(
    () =>
      validatePredictionOrchestratorConfig(
        cloneConfig({ explanation: { lowScoringTotalGoalsThreshold: 3, highScoringTotalGoalsThreshold: 2 } }),
      ),
    PredictionOrchestratorConfigurationError,
  );
});

test("rejects a non-positive explanation.magnitudeReferenceScale", () => {
  assert.throws(
    () => validatePredictionOrchestratorConfig(cloneConfig({ explanation: { magnitudeReferenceScale: 0 } })),
    PredictionOrchestratorConfigurationError,
  );
});
