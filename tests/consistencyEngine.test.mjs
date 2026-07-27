import test from "node:test";
import assert from "node:assert/strict";
import { evaluateConsistency } from "../src/services/prediction-orchestrator/ConsistencyEngine.ts";
import {
  DEFAULT_CONSISTENCY_THRESHOLDS,
  DEFAULT_CONSISTENCY_ADJUSTMENTS,
} from "../src/services/prediction-orchestrator/PredictionOrchestratorConfig.ts";

function matchOutcomePrediction(predictedOutcome, { homeWin, draw, awayWin }) {
  return {
    modelVersion: "test-prediction-v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    probabilities: { homeWin, draw, awayWin },
    predictedOutcome,
    topProbability: Math.max(homeWin, draw, awayWin),
    probabilityMargin: 0,
    dataSufficiency: { status: "STRONG", sampleSize: 20, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings: [] },
    featureTrace: [],
  };
}

function goalDistributionPrediction({ homeWin, draw, awayWin }) {
  return {
    modelVersion: "test-goal-distribution-v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    expectedGoals: { home: 1.5, away: 1.2, total: 2.7 },
    homeGoalDistribution: [],
    awayGoalDistribution: [],
    exactScores: [],
    mostLikelyScore: { homeGoals: 1, awayGoals: 1, totalGoals: 2, probability: 0.15 },
    topExactScores: [],
    topExactScoresAggregateProbability: 0.5,
    overUnder: [],
    bothTeamsToScore: { yes: 0.5, no: 0.5 },
    scoreDerivedOutcomeProbabilities: { homeWin, draw, awayWin },
    dataSufficiency: { status: "STRONG", sampleSize: 20, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings: [] },
    featureTrace: [],
    warnings: [],
  };
}

const THRESHOLDS = DEFAULT_CONSISTENCY_THRESHOLDS;
const ADJUSTMENTS = DEFAULT_CONSISTENCY_ADJUSTMENTS;

test("mission example: Prediction Home 80% vs Goal Distribution Away 60% -> MAJOR_DIVERGENCE with a penalty", () => {
  const prediction = matchOutcomePrediction("HOME_WIN", { homeWin: 0.8, draw: 0.1, awayWin: 0.1 });
  const goalDistribution = goalDistributionPrediction({ homeWin: 0.2, draw: 0.2, awayWin: 0.6 });
  const result = evaluateConsistency(prediction, goalDistribution, THRESHOLDS, ADJUSTMENTS);
  assert.equal(result.level, "MAJOR_DIVERGENCE");
  assert.equal(result.matchingWinner, false);
  assert.equal(result.adjustment, -ADJUSTMENTS.majorDivergencePenalty);
  assert.ok(result.adjustment < 0);
});

test("mission example: Prediction Home 61% vs Goal Distribution Home 59% -> ALIGNED with a bonus", () => {
  const prediction = matchOutcomePrediction("HOME_WIN", { homeWin: 0.61, draw: 0.2, awayWin: 0.19 });
  const goalDistribution = goalDistributionPrediction({ homeWin: 0.59, draw: 0.21, awayWin: 0.2 });
  const result = evaluateConsistency(prediction, goalDistribution, THRESHOLDS, ADJUSTMENTS);
  assert.equal(result.level, "ALIGNED");
  assert.equal(result.matchingWinner, true);
  assert.equal(result.adjustment, ADJUSTMENTS.alignedBonus);
  assert.ok(result.adjustment > 0);
});

test("same winner but a large probability gap: ALIGNED with no bonus (adjustment = 0), never penalized", () => {
  const prediction = matchOutcomePrediction("HOME_WIN", { homeWin: 0.8, draw: 0.1, awayWin: 0.1 });
  const goalDistribution = goalDistributionPrediction({ homeWin: 0.55, draw: 0.25, awayWin: 0.2 });
  const result = evaluateConsistency(prediction, goalDistribution, THRESHOLDS, ADJUSTMENTS);
  assert.equal(result.level, "ALIGNED");
  assert.equal(result.matchingWinner, true);
  assert.equal(result.adjustment, 0);
});

test("different winners but a small probability gap -> MINOR_DIVERGENCE with a smaller penalty than MAJOR_DIVERGENCE", () => {
  const prediction = matchOutcomePrediction("HOME_WIN", { homeWin: 0.34, draw: 0.33, awayWin: 0.33 });
  const goalDistribution = goalDistributionPrediction({ homeWin: 0.32, draw: 0.34, awayWin: 0.34 });
  const result = evaluateConsistency(prediction, goalDistribution, THRESHOLDS, ADJUSTMENTS);
  assert.equal(result.matchingWinner, false);
  assert.equal(result.level, "MINOR_DIVERGENCE");
  assert.equal(result.adjustment, -ADJUSTMENTS.minorDivergencePenalty);
  assert.ok(Math.abs(result.adjustment) < ADJUSTMENTS.majorDivergencePenalty);
});

test("maxProbabilityDelta reflects the worst mismatch across all three components, not just homeWin", () => {
  // homeWin matches closely, but draw/awayWin diverge sharply.
  const prediction = matchOutcomePrediction("DRAW", { homeWin: 0.3, draw: 0.4, awayWin: 0.3 });
  const goalDistribution = goalDistributionPrediction({ homeWin: 0.31, draw: 0.09, awayWin: 0.6 });
  const result = evaluateConsistency(prediction, goalDistribution, THRESHOLDS, ADJUSTMENTS);
  assert.ok(Math.abs(result.maxProbabilityDelta - 0.31) < 1e-9);
});

test("a delta clearly at/under the alignedThreshold is treated as ALIGNED with a bonus", () => {
  // draw and awayWin are held identical between the two models so the
  // only delta is on homeWin (0.60 vs 0.564), placed a comfortable margin
  // below alignedThreshold (0.05) to avoid floating-point boundary
  // ambiguity while still exercising the "<=" (inclusive) branch.
  const prediction = matchOutcomePrediction("HOME_WIN", { homeWin: 0.6, draw: 0.25, awayWin: 0.15 });
  const goalDistribution = goalDistributionPrediction({ homeWin: 0.564, draw: 0.25, awayWin: 0.186 });
  const result = evaluateConsistency(prediction, goalDistribution, THRESHOLDS, ADJUSTMENTS);
  assert.ok(result.maxProbabilityDelta <= THRESHOLDS.alignedThreshold);
  assert.equal(result.level, "ALIGNED");
  assert.equal(result.adjustment, ADJUSTMENTS.alignedBonus);
});

test("a delta clearly at/over the majorDivergenceThreshold, with different winners, is MAJOR_DIVERGENCE", () => {
  const prediction = matchOutcomePrediction("HOME_WIN", { homeWin: 0.5, draw: 0.3, awayWin: 0.2 });
  const goalDistribution = goalDistributionPrediction({ homeWin: 0.34, draw: 0.3, awayWin: 0.36 });
  const result = evaluateConsistency(prediction, goalDistribution, THRESHOLDS, ADJUSTMENTS);
  assert.ok(result.maxProbabilityDelta >= THRESHOLDS.majorDivergenceThreshold);
  assert.equal(result.matchingWinner, false);
  assert.equal(result.level, "MAJOR_DIVERGENCE");
  assert.equal(result.adjustment, -ADJUSTMENTS.majorDivergencePenalty);
});

test("is deterministic for identical input", () => {
  const prediction = matchOutcomePrediction("AWAY_WIN", { homeWin: 0.2, draw: 0.2, awayWin: 0.6 });
  const goalDistribution = goalDistributionPrediction({ homeWin: 0.25, draw: 0.25, awayWin: 0.5 });
  const first = evaluateConsistency(prediction, goalDistribution, THRESHOLDS, ADJUSTMENTS);
  const second = evaluateConsistency(prediction, goalDistribution, THRESHOLDS, ADJUSTMENTS);
  assert.deepEqual(first, second);
});
