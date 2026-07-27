import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionExplanation } from "../src/services/prediction-orchestrator/PredictionExplanation.ts";
import { DEFAULT_EXPLANATION_CONFIG } from "../src/services/prediction-orchestrator/PredictionOrchestratorConfig.ts";

function predictionFeature(name, { availability = "AVAILABLE", normalizedValue = 0, contribution = 0 } = {}) {
  return { name, rawValue: null, normalizedValue, weight: 1, contribution, availability, direction: "NEUTRAL" };
}

function goalDistributionFeature(name, { availability = "AVAILABLE", contributionHome = 0, contributionAway = 0 } = {}) {
  return { name, rawValue: null, normalizedValue: null, weight: 1, contributionHome, contributionAway, availability, explanation: "" };
}

function prediction(features) {
  return {
    modelVersion: "test-prediction-v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    probabilities: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 },
    predictedOutcome: "HOME_WIN",
    topProbability: 0.5,
    probabilityMargin: 0.2,
    dataSufficiency: { status: "STRONG", sampleSize: 20, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings: [] },
    featureTrace: features,
  };
}

function goalDistribution(features, expectedGoals = { home: 1.5, away: 1.2, total: 2.7 }) {
  return {
    modelVersion: "test-goal-distribution-v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    expectedGoals,
    homeGoalDistribution: [],
    awayGoalDistribution: [],
    exactScores: [],
    mostLikelyScore: { homeGoals: 1, awayGoals: 1, totalGoals: 2, probability: 0.15 },
    topExactScores: [],
    topExactScoresAggregateProbability: 0.5,
    overUnder: [],
    bothTeamsToScore: { yes: 0.5, no: 0.5 },
    scoreDerivedOutcomeProbabilities: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 },
    dataSufficiency: { status: "STRONG", sampleSize: 20, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings: [] },
    featureTrace: features,
    warnings: [],
  };
}

const CONFIG = DEFAULT_EXPLANATION_CONFIG;

test("never produces a natural-language string: every signal is a closed set of structured fields", () => {
  const result = buildPredictionExplanation(
    prediction([predictionFeature("ratingDifference", { normalizedValue: 0.5, contribution: 0.5 })]),
    goalDistribution([]),
    CONFIG,
  );
  for (const signal of result.topSignals) {
    assert.equal(typeof signal.type, "string");
    assert.equal(typeof signal.source, "string");
    assert.equal(typeof signal.favors, "string");
    assert.equal(typeof signal.magnitude, "number");
    assert.deepEqual(Object.keys(signal).sort(), ["favors", "magnitude", "source", "type"]);
  }
});

test("an AVAILABLE, positive-contribution prediction feature produces a HOME-favoring signal", () => {
  const result = buildPredictionExplanation(
    prediction([predictionFeature("ratingDifference", { normalizedValue: 0.6, contribution: 0.6 })]),
    goalDistribution([]),
    CONFIG,
  );
  const signal = result.topSignals.find((s) => s.type === "RATING_ADVANTAGE");
  assert.ok(signal);
  assert.equal(signal.source, "PREDICTION_ENGINE");
  assert.equal(signal.favors, "HOME");
  assert.ok(Math.abs(signal.magnitude - 0.6) < 1e-9);
});

test("a negative-contribution prediction feature produces an AWAY-favoring signal", () => {
  const result = buildPredictionExplanation(
    prediction([predictionFeature("formDifference", { normalizedValue: -0.4, contribution: -0.4 })]),
    goalDistribution([]),
    CONFIG,
  );
  const signal = result.topSignals.find((s) => s.type === "FORM_ADVANTAGE");
  assert.ok(signal);
  assert.equal(signal.favors, "AWAY");
});

test("a prediction feature entirely absent from featureTrace never produces a signal (defensive, never thrown)", () => {
  const result = buildPredictionExplanation(prediction([]), goalDistribution([]), CONFIG);
  assert.equal(result.topSignals.length, 0);
});

test("a goal-distribution feature entirely absent from featureTrace never produces a signal (defensive, never thrown)", () => {
  const result = buildPredictionExplanation(prediction([]), goalDistribution([]), CONFIG);
  assert.equal(result.topSignals.length, 0);
});

test("an AVAILABLE prediction feature with a null normalizedValue (defensive edge case) never produces a signal", () => {
  const result = buildPredictionExplanation(
    prediction([predictionFeature("ratingDifference", { availability: "AVAILABLE", normalizedValue: null })]),
    goalDistribution([]),
    CONFIG,
  );
  assert.equal(result.topSignals.length, 0);
});

test("a MISSING or NOT_APPLICABLE prediction feature never produces a signal", () => {
  const result = buildPredictionExplanation(
    prediction([
      predictionFeature("ratingDifference", { availability: "MISSING", normalizedValue: null }),
      predictionFeature("homeAdvantage", { availability: "NOT_APPLICABLE", normalizedValue: null }),
    ]),
    goalDistribution([]),
    CONFIG,
  );
  assert.equal(result.topSignals.length, 0);
  assert.equal(result.totalSignalsConsidered, 0);
});

test("a zero-contribution (NEUTRAL) prediction feature never produces a signal", () => {
  const result = buildPredictionExplanation(
    prediction([predictionFeature("strengthDifference", { normalizedValue: 0, contribution: 0 })]),
    goalDistribution([]),
    CONFIG,
  );
  assert.equal(result.topSignals.length, 0);
});

test("a nonzero normalizedValue with a zero contribution (e.g. from a zero-weight feature: contribution = weight * normalizedValue) never produces a signal", () => {
  // Unlike goal-distribution features (where `favors` and `magnitude` both
  // derive from the same `rawDelta`), prediction features derive
  // `magnitude` from `normalizedValue` and `favors` from `contribution` —
  // two independent fields. A caller-configured weight of 0 zeroes
  // contribution while normalizedValue stays meaningful, which is the
  // only way this engine reaches its `favors === "NEUTRAL"` branch
  // without also short-circuiting on the magnitude check first.
  const result = buildPredictionExplanation(
    prediction([predictionFeature("momentumDifference", { normalizedValue: 0.5, contribution: 0 })]),
    goalDistribution([]),
    CONFIG,
  );
  assert.equal(result.topSignals.length, 0);
});

test("a goal-distribution feature with contributionHome > contributionAway favors HOME, scaled by magnitudeReferenceScale", () => {
  const result = buildPredictionExplanation(
    prediction([]),
    goalDistribution([goalDistributionFeature("recentForm", { contributionHome: 2.0, contributionAway: 1.0 })]),
    CONFIG,
  );
  const signal = result.topSignals.find((s) => s.type === "GOAL_EXPECTATION_ADVANTAGE");
  assert.ok(signal);
  assert.equal(signal.source, "GOAL_DISTRIBUTION_ENGINE");
  assert.equal(signal.favors, "HOME");
  assert.ok(Math.abs(signal.magnitude - Math.min(1, 1.0 / CONFIG.magnitudeReferenceScale)) < 1e-9);
});

test("a goal-distribution feature with contributionAway > contributionHome favors AWAY", () => {
  const result = buildPredictionExplanation(
    prediction([]),
    goalDistribution([goalDistributionFeature("homeAwaySplit", { contributionHome: 0.5, contributionAway: 1.5 })]),
    CONFIG,
  );
  const signal = result.topSignals.find((s) => s.type === "GOAL_EXPECTATION_ADVANTAGE");
  assert.ok(signal);
  assert.equal(signal.favors, "AWAY");
});

test("equal contributionHome/contributionAway never produces a signal (no direction)", () => {
  const result = buildPredictionExplanation(
    prediction([]),
    goalDistribution([goalDistributionFeature("momentum", { contributionHome: 0.3, contributionAway: 0.3 })]),
    CONFIG,
  );
  assert.equal(result.topSignals.length, 0);
});

test("expectedGoals.total above the configured threshold produces a HIGH_SCORING_TREND signal", () => {
  const result = buildPredictionExplanation(
    prediction([]),
    goalDistribution([], { home: 2.5, away: 2.0, total: 4.5 }),
    CONFIG,
  );
  const signal = result.topSignals.find((s) => s.type === "HIGH_SCORING_TREND");
  assert.ok(signal);
  assert.equal(signal.favors, "NEUTRAL");
  assert.equal(signal.source, "GOAL_DISTRIBUTION_ENGINE");
});

test("expectedGoals.total below the configured threshold produces a LOW_SCORING_TREND signal", () => {
  const result = buildPredictionExplanation(
    prediction([]),
    goalDistribution([], { home: 0.5, away: 0.4, total: 0.9 }),
    CONFIG,
  );
  const signal = result.topSignals.find((s) => s.type === "LOW_SCORING_TREND");
  assert.ok(signal);
});

test("expectedGoals.total between the thresholds produces neither scoring-trend signal", () => {
  const result = buildPredictionExplanation(prediction([]), goalDistribution([], { home: 1.2, away: 1.0, total: 2.2 }), CONFIG);
  assert.equal(result.topSignals.some((s) => s.type === "HIGH_SCORING_TREND" || s.type === "LOW_SCORING_TREND"), false);
});

test("topSignals is ordered by descending magnitude and capped at topSignalsCount", () => {
  const features = [
    predictionFeature("ratingDifference", { normalizedValue: 0.9, contribution: 0.9 }),
    predictionFeature("formDifference", { normalizedValue: 0.1, contribution: 0.1 }),
    predictionFeature("strengthDifference", { normalizedValue: 0.5, contribution: 0.5 }),
    predictionFeature("momentumDifference", { normalizedValue: 0.3, contribution: 0.3 }),
    predictionFeature("homeAdvantage", { normalizedValue: 0.2, contribution: 0.2 }),
    predictionFeature("headToHead", { normalizedValue: 0.7, contribution: 0.7 }),
    predictionFeature("greenScoreDifference", { normalizedValue: 0.05, contribution: 0.05 }),
  ];
  const result = buildPredictionExplanation(prediction(features), goalDistribution([]), { ...CONFIG, topSignalsCount: 3 });
  assert.equal(result.topSignals.length, 3);
  const magnitudes = result.topSignals.map((s) => s.magnitude);
  assert.deepEqual(magnitudes, [...magnitudes].sort((a, b) => b - a));
  assert.ok(Math.abs(magnitudes[0] - 0.9) < 1e-9);
  assert.equal(result.totalSignalsConsidered, 7);
});

test("all available features and both engines together produce the full candidate set", () => {
  const predictionFeatures = [
    predictionFeature("ratingDifference", { normalizedValue: 0.5, contribution: 0.5 }),
    predictionFeature("formDifference", { normalizedValue: 0.3, contribution: 0.3 }),
    predictionFeature("strengthDifference", { normalizedValue: 0.4, contribution: 0.4 }),
    predictionFeature("momentumDifference", { normalizedValue: 0.2, contribution: 0.2 }),
    predictionFeature("homeAdvantage", { normalizedValue: 0.1, contribution: 0.1 }),
    predictionFeature("headToHead", { normalizedValue: 0.6, contribution: 0.6 }),
    predictionFeature("greenScoreDifference", { normalizedValue: 0.35, contribution: 0.35 }),
    predictionFeature("drawBalance", { normalizedValue: 0.8, contribution: 0.8 }),
  ];
  const goalDistributionFeatures = [
    goalDistributionFeature("recentForm", { contributionHome: 2.0, contributionAway: 1.0 }),
    goalDistributionFeature("homeAwaySplit", { contributionHome: 1.8, contributionAway: 1.2 }),
    goalDistributionFeature("headToHead", { contributionHome: 1.5, contributionAway: 0.5 }),
    goalDistributionFeature("momentum", { contributionHome: 0.3, contributionAway: 0.1 }),
    goalDistributionFeature("strength", { contributionHome: 0.4, contributionAway: 0.2 }),
  ];
  const result = buildPredictionExplanation(
    prediction(predictionFeatures),
    goalDistribution(goalDistributionFeatures, { home: 2, away: 1.8, total: 3.8 }),
    { ...CONFIG, topSignalsCount: 20 },
  );
  // drawBalance is intentionally excluded (no home/away direction).
  assert.equal(result.totalSignalsConsidered, 7 + 5 + 1);
});

test("is deterministic for identical input", () => {
  const features = [predictionFeature("ratingDifference", { normalizedValue: 0.5, contribution: 0.5 })];
  const first = buildPredictionExplanation(prediction(features), goalDistribution([]), CONFIG);
  const second = buildPredictionExplanation(prediction(features), goalDistribution([]), CONFIG);
  assert.deepEqual(first, second);
});
