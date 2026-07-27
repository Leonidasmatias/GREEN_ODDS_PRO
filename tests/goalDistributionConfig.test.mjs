import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GOAL_DISTRIBUTION_CONFIG,
  DEFAULT_GOAL_DISTRIBUTION_WEIGHTS,
  DEFAULT_GOAL_DISTRIBUTION_DATA_SUFFICIENCY_THRESHOLDS,
  DEFAULT_GOAL_DISTRIBUTION_SHRINKAGE,
  DEFAULT_OVER_UNDER_LINES,
  GOAL_DISTRIBUTION_MODEL_VERSION,
  GoalDistributionConfigurationError,
  validateGoalDistributionConfig,
} from "../src/services/goal-distribution/GoalDistributionConfig.ts";

function cloneConfig(overrides = {}) {
  return {
    ...DEFAULT_GOAL_DISTRIBUTION_CONFIG,
    ...overrides,
    weights: { ...DEFAULT_GOAL_DISTRIBUTION_WEIGHTS, ...(overrides.weights ?? {}) },
    dataSufficiencyThresholds: { ...DEFAULT_GOAL_DISTRIBUTION_DATA_SUFFICIENCY_THRESHOLDS, ...(overrides.dataSufficiencyThresholds ?? {}) },
    shrinkage: { ...DEFAULT_GOAL_DISTRIBUTION_SHRINKAGE, ...(overrides.shrinkage ?? {}) },
    overUnderLines: overrides.overUnderLines ?? [...DEFAULT_OVER_UNDER_LINES],
  };
}

test("the default configuration is valid", () => {
  assert.doesNotThrow(() => validateGoalDistributionConfig(DEFAULT_GOAL_DISTRIBUTION_CONFIG));
});

test("modelVersion carries the documented provisional version string", () => {
  assert.equal(GOAL_DISTRIBUTION_MODEL_VERSION, "esoccer-goal-distribution-v1.0.0-provisional");
  assert.equal(DEFAULT_GOAL_DISTRIBUTION_CONFIG.modelVersion, GOAL_DISTRIBUTION_MODEL_VERSION);
});

test("rejects an empty modelVersion", () => {
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ modelVersion: "" })), GoalDistributionConfigurationError);
});

test("rejects a negative weight", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ weights: { recentForm: -0.1 } })),
    GoalDistributionConfigurationError,
  );
});

test("rejects a NaN weight", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ weights: { momentum: Number.NaN } })),
    GoalDistributionConfigurationError,
  );
});

test("rejects an Infinity weight", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ weights: { strength: Number.POSITIVE_INFINITY } })),
    GoalDistributionConfigurationError,
  );
});

test("accepts a weight of exactly zero (disabling a feature is valid)", () => {
  assert.doesNotThrow(() => validateGoalDistributionConfig(cloneConfig({ weights: { momentum: 0 } })));
});

test("rejects minLambda <= 0", () => {
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ minLambda: 0 })), GoalDistributionConfigurationError);
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ minLambda: -1 })), GoalDistributionConfigurationError);
});

test("rejects maxLambda <= minLambda", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ minLambda: 2, maxLambda: 2 })),
    GoalDistributionConfigurationError,
  );
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ minLambda: 2, maxLambda: 1 })),
    GoalDistributionConfigurationError,
  );
});

test("rejects an invalid maxGoalsPerPlayer", () => {
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ maxGoalsPerPlayer: 0 })), GoalDistributionConfigurationError);
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ maxGoalsPerPlayer: -5 })), GoalDistributionConfigurationError);
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ maxGoalsPerPlayer: 3.5 })), GoalDistributionConfigurationError);
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ maxGoalsPerPlayer: Number.NaN })), GoalDistributionConfigurationError);
});

test("rejects an invalid defaultTopExactScores (non-positive, non-integer, or exceeding total possible scores)", () => {
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ defaultTopExactScores: 0 })), GoalDistributionConfigurationError);
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ defaultTopExactScores: 2.5 })), GoalDistributionConfigurationError);
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ maxGoalsPerPlayer: 2, defaultTopExactScores: 100 })),
    GoalDistributionConfigurationError,
  );
});

test("rejects a non-finite Over/Under line", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ overUnderLines: [2.5, Number.NaN] })),
    GoalDistributionConfigurationError,
  );
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ overUnderLines: [2.5, Number.POSITIVE_INFINITY] })),
    GoalDistributionConfigurationError,
  );
});

test("rejects an Over/Under line that does not end in .5 (integer or .25 lines)", () => {
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ overUnderLines: [2] })), GoalDistributionConfigurationError);
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ overUnderLines: [2.25] })), GoalDistributionConfigurationError);
});

test("rejects duplicate Over/Under lines", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ overUnderLines: [2.5, 2.5] })),
    GoalDistributionConfigurationError,
  );
});

test("rejects an empty overUnderLines array", () => {
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ overUnderLines: [] })), GoalDistributionConfigurationError);
});

test("rejects a NaN or negative individual data sufficiency threshold", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ dataSufficiencyThresholds: { minHomeAwaySampleSize: Number.NaN } })),
    GoalDistributionConfigurationError,
  );
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ dataSufficiencyThresholds: { minHomeAwaySampleSize: -1 } })),
    GoalDistributionConfigurationError,
  );
});

test("rejects data sufficiency thresholds out of ascending order", () => {
  assert.throws(
    () =>
      validateGoalDistributionConfig(
        cloneConfig({ dataSufficiencyThresholds: { minConfidenceForLimited: 60, minConfidenceForSufficient: 50 } }),
      ),
    GoalDistributionConfigurationError,
  );
});

test("rejects a minConfidenceForStrong above 100", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ dataSufficiencyThresholds: { minConfidenceForStrong: 150 } })),
    GoalDistributionConfigurationError,
  );
});

test("rejects an invalid shrinkage.fullConfidenceSampleSize", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ shrinkage: { fullConfidenceSampleSize: 0 } })),
    GoalDistributionConfigurationError,
  );
});

test("rejects an invalid shrinkage.conservativeBaselineGoalsPerMatch", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ shrinkage: { conservativeBaselineGoalsPerMatch: 0 } })),
    GoalDistributionConfigurationError,
  );
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ shrinkage: { conservativeBaselineGoalsPerMatch: -1 } })),
    GoalDistributionConfigurationError,
  );
});

test("rejects headToHeadEnabled that is not a boolean", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ headToHeadEnabled: "yes" })),
    GoalDistributionConfigurationError,
  );
});

test("rejects a NaN or negative maxHeadToHeadWeight", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ maxHeadToHeadWeight: Number.NaN })),
    GoalDistributionConfigurationError,
  );
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ maxHeadToHeadWeight: -0.1 })),
    GoalDistributionConfigurationError,
  );
});

test("rejects weights.headToHead exceeding maxHeadToHeadWeight", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ weights: { headToHead: 0.9 }, maxHeadToHeadWeight: 0.6 })),
    GoalDistributionConfigurationError,
  );
});

test("rejects a non-finite or negative fallbackBaseGoalsPerPlayer", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ fallbackBaseGoalsPerPlayer: 0 })),
    GoalDistributionConfigurationError,
  );
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ fallbackBaseGoalsPerPlayer: Number.NaN })),
    GoalDistributionConfigurationError,
  );
});

test("rejects negative momentum/strength adjustment caps", () => {
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ maxMomentumGoalsAdjustment: -0.1 })),
    GoalDistributionConfigurationError,
  );
  assert.throws(
    () => validateGoalDistributionConfig(cloneConfig({ maxStrengthGoalsAdjustment: -0.1 })),
    GoalDistributionConfigurationError,
  );
});

test("rejects a normalizationTolerance outside (0, 1]", () => {
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ normalizationTolerance: 0 })), GoalDistributionConfigurationError);
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ normalizationTolerance: -1 })), GoalDistributionConfigurationError);
  assert.throws(() => validateGoalDistributionConfig(cloneConfig({ normalizationTolerance: 1.5 })), GoalDistributionConfigurationError);
});
