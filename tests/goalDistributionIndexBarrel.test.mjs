import test from "node:test";
import assert from "node:assert/strict";
import * as GoalDistributionEngine from "../src/services/goal-distribution/index.ts";

test("the public barrel (index.ts) re-exports the full consumer-facing API", () => {
  assert.equal(typeof GoalDistributionEngine.predictGoalDistribution, "function");
  assert.equal(typeof GoalDistributionEngine.computeExpectedGoals, "function");
  assert.equal(typeof GoalDistributionEngine.buildExpectedGoalsFeatures, "function");
  assert.equal(typeof GoalDistributionEngine.orientHeadToHeadGoals, "function");
  assert.equal(typeof GoalDistributionEngine.evaluateGoalDistributionDataSufficiency, "function");
  assert.equal(typeof GoalDistributionEngine.poissonProbability, "function");
  assert.equal(typeof GoalDistributionEngine.buildPoissonDistribution, "function");
  assert.equal(typeof GoalDistributionEngine.sanitizeLambda, "function");
  assert.equal(typeof GoalDistributionEngine.buildScoreMatrix, "function");
  assert.equal(typeof GoalDistributionEngine.extractExactScores, "function");
  assert.equal(typeof GoalDistributionEngine.rankExactScores, "function");
  assert.equal(typeof GoalDistributionEngine.computeOverUnder, "function");
  assert.equal(typeof GoalDistributionEngine.computeGoalLineProbability, "function");
  assert.equal(typeof GoalDistributionEngine.computeBothTeamsToScore, "function");
  assert.equal(typeof GoalDistributionEngine.computeScoreDerivedOutcomeProbabilities, "function");
  assert.equal(typeof GoalDistributionEngine.validateGoalDistributionConfig, "function");
  assert.equal(typeof GoalDistributionEngine.GoalDistributionConfigurationError, "function");
  assert.equal(GoalDistributionEngine.GOAL_DISTRIBUTION_MODEL_VERSION, "esoccer-goal-distribution-v1.0.0-provisional");
  assert.equal(typeof GoalDistributionEngine.DEFAULT_GOAL_DISTRIBUTION_CONFIG, "object");
  assert.equal(typeof GoalDistributionEngine.DEFAULT_GOAL_DISTRIBUTION_WEIGHTS, "object");
  assert.equal(typeof GoalDistributionEngine.DEFAULT_GOAL_DISTRIBUTION_DATA_SUFFICIENCY_THRESHOLDS, "object");
  assert.equal(typeof GoalDistributionEngine.DEFAULT_GOAL_DISTRIBUTION_SHRINKAGE, "object");
  assert.ok(Array.isArray(GoalDistributionEngine.DEFAULT_OVER_UNDER_LINES));
});

test("predictGoalDistribution imported from the barrel behaves identically to the direct module import", async () => {
  const { predictGoalDistribution: direct } = await import("../src/services/goal-distribution/GoalDistributionEngine.ts");
  const request = {
    homePlayer: { playerId: "home", matchesCount: 0, rating: null, form: null, homeAway: null, momentum: null, strength: null, confidence: null, greenScore: null, goalsRates: null },
    awayPlayer: { playerId: "away", matchesCount: 0, rating: null, form: null, homeAway: null, momentum: null, strength: null, confidence: null, greenScore: null, goalsRates: null },
    headToHead: null,
  };
  const fixedNow = () => new Date("2026-07-27T00:00:00.000Z");
  assert.deepEqual(
    GoalDistributionEngine.predictGoalDistribution(request, GoalDistributionEngine.DEFAULT_GOAL_DISTRIBUTION_CONFIG, fixedNow),
    direct(request, GoalDistributionEngine.DEFAULT_GOAL_DISTRIBUTION_CONFIG, fixedNow),
  );
});
