import test from "node:test";
import assert from "node:assert/strict";
import { aggregate } from "../src/services/prediction-orchestrator/PredictionAggregator.ts";
import { DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG } from "../src/services/prediction-orchestrator/PredictionOrchestratorConfig.ts";

function prediction({ status = "STRONG", warnings = [], predictedOutcome = "HOME_WIN", homeWin = 0.6, draw = 0.25, awayWin = 0.15 } = {}) {
  return {
    modelVersion: "test-prediction-v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    probabilities: { homeWin, draw, awayWin },
    predictedOutcome,
    topProbability: Math.max(homeWin, draw, awayWin),
    probabilityMargin: 0.1,
    dataSufficiency: { status, sampleSize: 20, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings },
    featureTrace: Array.from({ length: 8 }, (_, i) => ({
      name: `f${i}`,
      rawValue: null,
      normalizedValue: 0.1,
      weight: 1,
      contribution: 0.1,
      availability: "AVAILABLE",
      direction: "FAVORS_HOME",
    })),
  };
}

function goalDistribution({
  status = "STRONG",
  warnings = [],
  engineWarnings = [],
  homeWin = 0.55,
  draw = 0.25,
  awayWin = 0.2,
  expectedGoals = { home: 1.8, away: 1.1, total: 2.9 },
  topExactScores = [{ homeGoals: 2, awayGoals: 1, totalGoals: 3, probability: 0.12 }],
  overUnder = [{ line: 2.5, over: 0.55, under: 0.45 }],
  bothTeamsToScore = { yes: 0.55, no: 0.45 },
} = {}) {
  return {
    modelVersion: "test-goal-distribution-v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    expectedGoals,
    homeGoalDistribution: [],
    awayGoalDistribution: [],
    exactScores: [],
    mostLikelyScore: topExactScores[0] ?? { homeGoals: 1, awayGoals: 1, totalGoals: 2, probability: 0.15 },
    topExactScores,
    topExactScoresAggregateProbability: 0.5,
    overUnder,
    bothTeamsToScore,
    scoreDerivedOutcomeProbabilities: { homeWin, draw, awayWin },
    dataSufficiency: { status, sampleSize: 20, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings },
    featureTrace: Array.from({ length: 5 }, (_, i) => ({
      name: `g${i}`,
      rawValue: null,
      normalizedValue: null,
      weight: 1,
      contributionHome: 0.1,
      contributionAway: 0,
      availability: "AVAILABLE",
      explanation: "",
    })),
    warnings: engineWarnings,
  };
}

const CONFIG = DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG;

test("winner and outcomeProbabilities always come from the Prediction Engine, never the Goal Distribution derived result", () => {
  const result = aggregate(
    prediction({ predictedOutcome: "HOME_WIN", homeWin: 0.6, draw: 0.25, awayWin: 0.15 }),
    goalDistribution({ homeWin: 0.2, draw: 0.2, awayWin: 0.6 }),
    CONFIG,
  );
  assert.equal(result.winner, "HOME_WIN");
  assert.deepEqual(result.outcomeProbabilities, { homeWin: 0.6, draw: 0.25, awayWin: 0.15 });
});

test("expectedGoals, exactScores, bothTeamsToScore, and overUnder are passed through from the Goal Distribution Engine unchanged", () => {
  const gd = goalDistribution();
  const result = aggregate(prediction(), gd, CONFIG);
  assert.deepEqual(result.expectedGoals, gd.expectedGoals);
  assert.deepEqual(result.exactScores, gd.topExactScores);
  assert.deepEqual(result.bothTeamsToScore, gd.bothTeamsToScore);
  assert.deepEqual(result.overUnder, gd.overUnder);
});

test("modelVersions carries all three model versions correctly", () => {
  const result = aggregate(prediction(), goalDistribution(), CONFIG);
  assert.equal(result.modelVersions.prediction, "test-prediction-v1");
  assert.equal(result.modelVersions.goalDistribution, "test-goal-distribution-v1");
  assert.equal(result.modelVersions.orchestrator, CONFIG.modelVersion);
});

test("dataQuality.combinedStatus is the more conservative of the two engines' statuses", () => {
  const result = aggregate(prediction({ status: "STRONG" }), goalDistribution({ status: "LIMITED" }), CONFIG);
  assert.equal(result.dataQuality.predictionDataSufficiency, "STRONG");
  assert.equal(result.dataQuality.goalDistributionDataSufficiency, "LIMITED");
  assert.equal(result.dataQuality.combinedStatus, "LIMITED");
});

test("warnings merge both engines' dataSufficiency warnings and the Goal Distribution engine-level warnings, deduplicated", () => {
  const result = aggregate(
    prediction({ warnings: ["no_head_to_head_history"] }),
    goalDistribution({ warnings: ["no_head_to_head_history"], engineWarnings: ["fallback_conservative_baseline_applied"] }),
    CONFIG,
  );
  assert.ok(result.warnings.includes("no_head_to_head_history"));
  assert.ok(result.warnings.includes("fallback_conservative_baseline_applied"));
  assert.equal(result.warnings.filter((w) => w === "no_head_to_head_history").length, 1);
});

test("a MAJOR_DIVERGENCE between the two engines adds the cross_model_major_divergence warning", () => {
  const result = aggregate(
    prediction({ predictedOutcome: "HOME_WIN", homeWin: 0.8, draw: 0.1, awayWin: 0.1 }),
    goalDistribution({ homeWin: 0.2, draw: 0.2, awayWin: 0.6 }),
    CONFIG,
  );
  assert.ok(result.warnings.includes("cross_model_major_divergence"));
});

test("no divergence never adds the cross_model_major_divergence warning", () => {
  const result = aggregate(
    prediction({ predictedOutcome: "HOME_WIN", homeWin: 0.6, draw: 0.25, awayWin: 0.15 }),
    goalDistribution({ homeWin: 0.58, draw: 0.24, awayWin: 0.18 }),
    CONFIG,
  );
  assert.equal(result.warnings.includes("cross_model_major_divergence"), false);
});

test("confidence and greenScore are always within [0, 100]", () => {
  const result = aggregate(prediction(), goalDistribution(), CONFIG);
  assert.ok(result.confidence >= 0 && result.confidence <= 100);
  assert.ok(result.greenScore.score >= 0 && result.greenScore.score <= 100);
  assert.ok(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"].includes(result.greenScore.category));
});

test("is deterministic for identical input", () => {
  const first = aggregate(prediction(), goalDistribution(), CONFIG);
  const second = aggregate(prediction(), goalDistribution(), CONFIG);
  assert.deepEqual(first, second);
});
