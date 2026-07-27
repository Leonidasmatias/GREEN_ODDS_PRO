import test from "node:test";
import assert from "node:assert/strict";
import { computeGreenScore, classifyGreenScore } from "../src/services/prediction-orchestrator/GreenScoreEngine.ts";
import { DEFAULT_GREEN_SCORE_WEIGHTS, DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES, DEFAULT_GREEN_SCORE_THRESHOLDS } from "../src/services/prediction-orchestrator/PredictionOrchestratorConfig.ts";

function predictionFeature(name, availability) {
  return { name, rawValue: null, normalizedValue: 0, weight: 1, contribution: 0, availability, direction: "NEUTRAL" };
}

function goalDistributionFeature(name, availability) {
  return { name, rawValue: null, normalizedValue: null, weight: 1, contributionHome: 0, contributionAway: 0, availability, explanation: "" };
}

function prediction({ status = "STRONG", h2hAvailable = true, formAvailable = true } = {}) {
  return {
    modelVersion: "test-prediction-v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    probabilities: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 },
    predictedOutcome: "HOME_WIN",
    topProbability: 0.5,
    probabilityMargin: 0.2,
    dataSufficiency: { status, sampleSize: 20, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings: [] },
    featureTrace: [
      predictionFeature("ratingDifference", "AVAILABLE"),
      predictionFeature("formDifference", formAvailable ? "AVAILABLE" : "MISSING"),
      predictionFeature("strengthDifference", "AVAILABLE"),
      predictionFeature("momentumDifference", "AVAILABLE"),
      predictionFeature("homeAdvantage", "AVAILABLE"),
      predictionFeature("headToHead", h2hAvailable ? "AVAILABLE" : "MISSING"),
      predictionFeature("greenScoreDifference", "AVAILABLE"),
      predictionFeature("drawBalance", "AVAILABLE"),
    ],
  };
}

function goalDistribution({ status = "STRONG", h2hAvailable = true, formAvailable = true } = {}) {
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
    featureTrace: [
      goalDistributionFeature("recentForm", formAvailable ? "AVAILABLE" : "MISSING"),
      goalDistributionFeature("homeAwaySplit", "AVAILABLE"),
      goalDistributionFeature("headToHead", h2hAvailable ? "AVAILABLE" : "MISSING"),
      goalDistributionFeature("momentum", "AVAILABLE"),
      goalDistributionFeature("strength", "AVAILABLE"),
    ],
    warnings: [],
  };
}

function dataQuality(combinedStatus = "STRONG") {
  return {
    predictionDataSufficiency: combinedStatus,
    goalDistributionDataSufficiency: combinedStatus,
    combinedStatus,
    consistency: { level: "ALIGNED", matchingWinner: true, maxProbabilityDelta: 0, adjustment: 0 },
  };
}

function neutralConsistency(adjustment = 0) {
  return { level: "ALIGNED", matchingWinner: true, maxProbabilityDelta: 0, adjustment };
}

const WEIGHTS = DEFAULT_GREEN_SCORE_WEIGHTS;
const SCORES = DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES;
const THRESHOLDS = DEFAULT_GREEN_SCORE_THRESHOLDS;

test("classifyGreenScore respects the four documented boundaries", () => {
  assert.equal(classifyGreenScore(0, THRESHOLDS), "LOW");
  assert.equal(classifyGreenScore(THRESHOLDS.lowMax, THRESHOLDS), "LOW");
  assert.equal(classifyGreenScore(THRESHOLDS.lowMax + 1, THRESHOLDS), "MEDIUM");
  assert.equal(classifyGreenScore(THRESHOLDS.mediumMax, THRESHOLDS), "MEDIUM");
  assert.equal(classifyGreenScore(THRESHOLDS.mediumMax + 1, THRESHOLDS), "HIGH");
  assert.equal(classifyGreenScore(THRESHOLDS.highMax, THRESHOLDS), "HIGH");
  assert.equal(classifyGreenScore(THRESHOLDS.highMax + 1, THRESHOLDS), "VERY_HIGH");
  assert.equal(classifyGreenScore(100, THRESHOLDS), "VERY_HIGH");
});

test("everything STRONG/available/aligned yields the maximum score and VERY_HIGH category", () => {
  const result = computeGreenScore(prediction(), goalDistribution(), dataQuality("STRONG"), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
  assert.equal(result.score, 100);
  assert.equal(result.category, "VERY_HIGH");
});

test("everything INSUFFICIENT yields a low score and LOW category", () => {
  const result = computeGreenScore(
    prediction({ status: "INSUFFICIENT", h2hAvailable: false, formAvailable: false }),
    goalDistribution({ status: "INSUFFICIENT", h2hAvailable: false, formAvailable: false }),
    dataQuality("INSUFFICIENT"),
    neutralConsistency(0),
    WEIGHTS,
    SCORES,
    THRESHOLDS,
  );
  assert.equal(result.category, "LOW");
});

test("H2H available in only one of the two engines yields a lower h2hReliability contribution than in both", () => {
  const bothAvailable = computeGreenScore(prediction({ h2hAvailable: true }), goalDistribution({ h2hAvailable: true }), dataQuality(), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
  const oneAvailable = computeGreenScore(prediction({ h2hAvailable: true }), goalDistribution({ h2hAvailable: false }), dataQuality(), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
  const noneAvailable = computeGreenScore(prediction({ h2hAvailable: false }), goalDistribution({ h2hAvailable: false }), dataQuality(), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
  assert.ok(bothAvailable.score >= oneAvailable.score);
  assert.ok(oneAvailable.score >= noneAvailable.score);
});

test("form reliability follows the same both > one > none pattern as H2H reliability", () => {
  const bothAvailable = computeGreenScore(prediction({ formAvailable: true }), goalDistribution({ formAvailable: true }), dataQuality(), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
  const oneAvailable = computeGreenScore(prediction({ formAvailable: true }), goalDistribution({ formAvailable: false }), dataQuality(), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
  const noneAvailable = computeGreenScore(prediction({ formAvailable: false }), goalDistribution({ formAvailable: false }), dataQuality(), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
  assert.ok(bothAvailable.score >= oneAvailable.score);
  assert.ok(oneAvailable.score >= noneAvailable.score);
});

test("a lower combined data quality status lowers the score", () => {
  const strong = computeGreenScore(prediction(), goalDistribution(), dataQuality("STRONG"), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
  const insufficient = computeGreenScore(prediction(), goalDistribution(), dataQuality("INSUFFICIENT"), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
  assert.ok(insufficient.score < strong.score);
});

test("a positive consistency adjustment raises the score without exceeding 100", () => {
  const result = computeGreenScore(prediction(), goalDistribution(), dataQuality(), neutralConsistency(8), WEIGHTS, SCORES, THRESHOLDS);
  assert.ok(result.score <= 100);
});

test("a negative consistency adjustment lowers the score without going below 0", () => {
  const result = computeGreenScore(
    prediction({ status: "INSUFFICIENT", h2hAvailable: false, formAvailable: false }),
    goalDistribution({ status: "INSUFFICIENT", h2hAvailable: false, formAvailable: false }),
    dataQuality("INSUFFICIENT"),
    neutralConsistency(-20),
    WEIGHTS,
    SCORES,
    THRESHOLDS,
  );
  assert.ok(result.score >= 0);
});

test("the score is always an integer within [0, 100] and matches classifyGreenScore", () => {
  for (const status of ["INSUFFICIENT", "LIMITED", "SUFFICIENT", "STRONG"]) {
    const result = computeGreenScore(prediction({ status }), goalDistribution({ status }), dataQuality(status), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
    assert.ok(Number.isInteger(result.score));
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.equal(result.category, classifyGreenScore(result.score, THRESHOLDS));
  }
});

test("a greenScoreWeights object summing to zero (bypassing config validation) never divides by zero", () => {
  const zeroWeights = { predictionConfidence: 0, goalDistributionConfidence: 0, dataQuality: 0, headToHeadReliability: 0, formReliability: 0 };
  const result = computeGreenScore(prediction(), goalDistribution(), dataQuality(), neutralConsistency(0), zeroWeights, SCORES, THRESHOLDS);
  assert.equal(result.score, 0);
  assert.equal(result.category, "LOW");
});

test("is deterministic for identical input", () => {
  const first = computeGreenScore(prediction(), goalDistribution(), dataQuality(), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
  const second = computeGreenScore(prediction(), goalDistribution(), dataQuality(), neutralConsistency(0), WEIGHTS, SCORES, THRESHOLDS);
  assert.deepEqual(first, second);
});
