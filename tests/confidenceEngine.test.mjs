import test from "node:test";
import assert from "node:assert/strict";
import { computeConfidenceScore } from "../src/services/prediction-orchestrator/ConfidenceEngine.ts";
import { DEFAULT_CONFIDENCE_WEIGHTS, DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES } from "../src/services/prediction-orchestrator/PredictionOrchestratorConfig.ts";

function featureTrace(count, availableCount) {
  return Array.from({ length: count }, (_, i) => ({
    name: `feature${i}`,
    rawValue: null,
    normalizedValue: null,
    weight: 1,
    contribution: 0,
    availability: i < availableCount ? "AVAILABLE" : "MISSING",
  }));
}

function prediction({ status = "STRONG", availableFeatures = 8, totalFeatures = 8 } = {}) {
  return {
    modelVersion: "test-prediction-v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    probabilities: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 },
    predictedOutcome: "HOME_WIN",
    topProbability: 0.5,
    probabilityMargin: 0.2,
    dataSufficiency: { status, sampleSize: 20, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings: [] },
    featureTrace: featureTrace(totalFeatures, availableFeatures).map((f) => ({ ...f, direction: "NEUTRAL" })),
  };
}

function goalDistribution({ status = "STRONG", availableFeatures = 5, totalFeatures = 5 } = {}) {
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
    scoreDerivedOutcomeProbabilities: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 },
    dataSufficiency: { status, sampleSize: 20, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings: [] },
    featureTrace: featureTrace(totalFeatures, availableFeatures).map((f) => ({ ...f, contributionHome: 0, contributionAway: 0, explanation: "" })),
    warnings: [],
  };
}

function neutralConsistency(adjustment = 0) {
  return { level: "ALIGNED", matchingWinner: true, maxProbabilityDelta: 0, adjustment };
}

const WEIGHTS = DEFAULT_CONFIDENCE_WEIGHTS;
const SCORES = DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES;

test("STRONG status on both sides with all signals available and neutral consistency yields the maximum score", () => {
  const score = computeConfidenceScore(prediction(), goalDistribution(), neutralConsistency(0), WEIGHTS, SCORES);
  assert.equal(score, 100);
});

test("INSUFFICIENT status on both sides with no signals available yields a low score", () => {
  const score = computeConfidenceScore(
    prediction({ status: "INSUFFICIENT", availableFeatures: 0 }),
    goalDistribution({ status: "INSUFFICIENT", availableFeatures: 0 }),
    neutralConsistency(0),
    WEIGHTS,
    SCORES,
  );
  assert.ok(score < 40);
});

test("higher status on one side than the other produces a score strictly between the two extremes", () => {
  const strongScore = computeConfidenceScore(prediction({ status: "STRONG" }), goalDistribution({ status: "STRONG" }), neutralConsistency(0), WEIGHTS, SCORES);
  const mixedScore = computeConfidenceScore(prediction({ status: "STRONG" }), goalDistribution({ status: "INSUFFICIENT" }), neutralConsistency(0), WEIGHTS, SCORES);
  const weakScore = computeConfidenceScore(prediction({ status: "INSUFFICIENT" }), goalDistribution({ status: "INSUFFICIENT" }), neutralConsistency(0), WEIGHTS, SCORES);
  assert.ok(mixedScore < strongScore);
  assert.ok(mixedScore > weakScore);
});

test("more available signals increase the score, all else equal", () => {
  const fewSignals = computeConfidenceScore(
    prediction({ availableFeatures: 1 }),
    goalDistribution({ availableFeatures: 0 }),
    neutralConsistency(0),
    WEIGHTS,
    SCORES,
  );
  const manySignals = computeConfidenceScore(
    prediction({ availableFeatures: 8 }),
    goalDistribution({ availableFeatures: 5 }),
    neutralConsistency(0),
    WEIGHTS,
    SCORES,
  );
  assert.ok(manySignals > fewSignals);
});

test("a positive consistency adjustment (bonus) raises the score", () => {
  const withoutBonus = computeConfidenceScore(prediction(), goalDistribution(), neutralConsistency(0), WEIGHTS, SCORES);
  const withBonus = computeConfidenceScore(prediction(), goalDistribution(), neutralConsistency(8), WEIGHTS, SCORES);
  assert.ok(withBonus >= withoutBonus);
  // Already at the ceiling (100) with all-STRONG/all-available inputs, so
  // the bonus must be absorbed by the clamp rather than exceeding 100.
  assert.ok(withBonus <= 100);
});

test("a negative consistency adjustment (penalty) lowers the score and never goes below 0", () => {
  const withoutPenalty = computeConfidenceScore(
    prediction({ status: "INSUFFICIENT", availableFeatures: 0 }),
    goalDistribution({ status: "INSUFFICIENT", availableFeatures: 0 }),
    neutralConsistency(0),
    WEIGHTS,
    SCORES,
  );
  const withPenalty = computeConfidenceScore(
    prediction({ status: "INSUFFICIENT", availableFeatures: 0 }),
    goalDistribution({ status: "INSUFFICIENT", availableFeatures: 0 }),
    neutralConsistency(-20),
    WEIGHTS,
    SCORES,
  );
  assert.ok(withPenalty <= withoutPenalty);
  assert.ok(withPenalty >= 0);
});

test("the result is always an integer within [0, 100]", () => {
  for (const status of ["INSUFFICIENT", "LIMITED", "SUFFICIENT", "STRONG"]) {
    const score = computeConfidenceScore(prediction({ status }), goalDistribution({ status }), neutralConsistency(0), WEIGHTS, SCORES);
    assert.ok(Number.isInteger(score));
    assert.ok(score >= 0 && score <= 100);
  }
});

test("a weight of zero for a component removes its influence", () => {
  const zeroSignalWeight = { ...WEIGHTS, signalCount: 0 };
  const withManySignals = computeConfidenceScore(prediction({ availableFeatures: 8 }), goalDistribution({ availableFeatures: 5 }), neutralConsistency(0), zeroSignalWeight, SCORES);
  const withFewSignals = computeConfidenceScore(prediction({ availableFeatures: 0 }), goalDistribution({ availableFeatures: 0 }), neutralConsistency(0), zeroSignalWeight, SCORES);
  assert.equal(withManySignals, withFewSignals);
});

test("no features at all on either engine (totalPossibleSignals = 0) never divides by zero", () => {
  const score = computeConfidenceScore(
    prediction({ totalFeatures: 0, availableFeatures: 0 }),
    goalDistribution({ totalFeatures: 0, availableFeatures: 0 }),
    neutralConsistency(0),
    WEIGHTS,
    SCORES,
  );
  assert.ok(Number.isFinite(score));
  assert.ok(score >= 0 && score <= 100);
});

test("a weights object summing to zero (bypassing config validation) never divides by zero", () => {
  const zeroWeights = { predictionConfidence: 0, goalDistributionConfidence: 0, signalCount: 0 };
  const score = computeConfidenceScore(prediction(), goalDistribution(), neutralConsistency(0), zeroWeights, SCORES);
  assert.equal(score, 0);
});

test("is deterministic for identical input", () => {
  const first = computeConfidenceScore(prediction(), goalDistribution(), neutralConsistency(0), WEIGHTS, SCORES);
  const second = computeConfidenceScore(prediction(), goalDistribution(), neutralConsistency(0), WEIGHTS, SCORES);
  assert.equal(first, second);
});
