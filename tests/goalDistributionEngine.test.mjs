import test from "node:test";
import assert from "node:assert/strict";
import { predictGoalDistribution } from "../src/services/goal-distribution/GoalDistributionEngine.ts";
import {
  DEFAULT_GOAL_DISTRIBUTION_CONFIG,
  GoalDistributionConfigurationError,
} from "../src/services/goal-distribution/GoalDistributionConfig.ts";
import { predictMatchOutcome, DEFAULT_PREDICTION_MODEL_CONFIG } from "../src/services/prediction/index.ts";

function emptyFormWindow(windowSize) {
  return { windowSize, matchesCount: 0, wins: 0, draws: 0, losses: 0, winRate: 0, pointsPerGame: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, avgGoalsFor: 0, avgGoalsAgainst: 0 };
}
function formWindow(windowSize, { matchesCount = 10, avgGoalsFor = 1.5, avgGoalsAgainst = 1.0, wins = 0, draws = 0, losses = 0 } = {}) {
  return { windowSize, matchesCount, wins, draws, losses, winRate: matchesCount ? wins / matchesCount : 0, pointsPerGame: matchesCount ? (wins * 3 + draws) / matchesCount : 0, goalsFor: avgGoalsFor * matchesCount, goalsAgainst: avgGoalsAgainst * matchesCount, goalDifference: (avgGoalsFor - avgGoalsAgainst) * matchesCount, avgGoalsFor, avgGoalsAgainst };
}
function formSnapshot({ last5, last10, last20 } = {}) {
  return { last5: last5 ?? emptyFormWindow(5), last10: last10 ?? emptyFormWindow(10), last20: last20 ?? emptyFormWindow(20) };
}
function homeAwaySplit({ matchesCount = 10, avgGoalsFor = 1.5, avgGoalsAgainst = 1.0 } = {}) {
  return { matchesCount, winRate: 0.5, goalsFor: avgGoalsFor * matchesCount, goalsAgainst: avgGoalsAgainst * matchesCount, avgGoalsFor, avgGoalsAgainst, bothTeamsScored: 0, over25: 0 };
}
function homeAwaySnapshot({ home, away } = {}) {
  return { home: home ?? homeAwaySplit(), away: away ?? homeAwaySplit() };
}
function momentum(momentumScore) {
  return { momentumScore, recentPointsPerGame: 0, baselinePointsPerGame: 0, recentWinRate: 0, baselineWinRate: 0 };
}
function strength(attackStrength, defenseStrength = attackStrength) {
  return { attackStrength, defenseStrength, overallStrength: (attackStrength + defenseStrength) / 2 };
}
function confidence(confidenceScore) {
  return { confidenceScore, breakdown: { matchesFactor: confidenceScore, h2hFactor: confidenceScore, formFactor: confidenceScore } };
}
function greenScore(score) {
  return { greenScore: score, classification: "BOM" };
}
function rating(value, matchesCount = 20) {
  return { playerId: "p", rating: value, matchesCount };
}
function headToHead(playerAId, playerBId, { matchesCount, playerAGoals = 0, playerBGoals = 0, playerAWins = 0, playerBWins = 0 }) {
  return { playerAId, playerBId, matchesCount, playerAWins, playerBWins, draws: matchesCount - playerAWins - playerBWins, playerAGoals, playerBGoals, over25Rate: 0, over35Rate: 0, bothTeamsScoredRate: 0, lastMatch: null, lastFiveMatches: [] };
}
function player(id, overrides = {}) {
  return { playerId: id, matchesCount: 20, rating: null, form: null, homeAway: null, momentum: null, strength: null, confidence: null, greenScore: null, goalsRates: null, ...overrides };
}

function fullPlayer(id, { ratingValue, avgGoalsFor, avgGoalsAgainst, strengthValue, momentumValue, confidenceValue, greenScoreValue, matchesCount = 25 }) {
  return player(id, {
    matchesCount,
    rating: rating(ratingValue, matchesCount),
    form: formSnapshot({ last10: formWindow(10, { matchesCount: 10, avgGoalsFor, avgGoalsAgainst }) }),
    homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 10, avgGoalsFor, avgGoalsAgainst }), away: homeAwaySplit({ matchesCount: 10, avgGoalsFor, avgGoalsAgainst }) }),
    strength: strength(strengthValue),
    momentum: momentum(momentumValue),
    confidence: confidence(confidenceValue),
    greenScore: greenScore(greenScoreValue),
  });
}

const CONFIG = DEFAULT_GOAL_DISTRIBUTION_CONFIG;

function assertValidPrediction(prediction) {
  assert.equal(prediction.modelVersion, CONFIG.modelVersion);
  assert.ok(Number.isFinite(prediction.expectedGoals.home) && prediction.expectedGoals.home > 0);
  assert.ok(Number.isFinite(prediction.expectedGoals.away) && prediction.expectedGoals.away > 0);
  assert.equal(prediction.expectedGoals.total, prediction.expectedGoals.home + prediction.expectedGoals.away);

  const matrixSum = prediction.exactScores.reduce((sum, s) => sum + s.probability, 0);
  assert.ok(Math.abs(matrixSum - 1) < 1e-9);

  for (const line of prediction.overUnder) {
    assert.ok(Math.abs(line.over + line.under - 1) <= Number.EPSILON);
  }
  assert.ok(Math.abs(prediction.bothTeamsToScore.yes + prediction.bothTeamsToScore.no - 1) <= Number.EPSILON);
  const { homeWin, draw, awayWin } = prediction.scoreDerivedOutcomeProbabilities;
  assert.ok(Math.abs(homeWin + draw + awayWin - 1) <= Number.EPSILON);

  assert.equal(prediction.featureTrace.length, 5);
  assert.equal(prediction.topExactScores.length, Math.min(CONFIG.defaultTopExactScores, prediction.exactScores.length));
  assert.ok(prediction.topExactScoresAggregateProbability > 0 && prediction.topExactScoresAggregateProbability <= 1);
  assert.deepEqual(prediction.mostLikelyScore, prediction.topExactScores[0]);
}

test("determinism: identical request/config yields an identical prediction", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, avgGoalsFor: 2.1, avgGoalsAgainst: 1.0, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, avgGoalsFor: 1.2, avgGoalsAgainst: 1.4, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: headToHead("away", "home", { matchesCount: 4, playerAGoals: 3, playerBGoals: 6 }),
  };
  const fixedNow = () => new Date("2026-07-27T00:00:00.000Z");
  const first = predictGoalDistribution(request, CONFIG, fixedNow);
  const second = predictGoalDistribution(request, CONFIG, fixedNow);
  assert.deepEqual(first, second);
});

test("generatedAt reflects the injected clock and never influences the math", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, avgGoalsFor: 2, avgGoalsAgainst: 1, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, avgGoalsFor: 1.5, avgGoalsAgainst: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: null,
  };
  const first = predictGoalDistribution(request, CONFIG, () => new Date("2020-01-01T00:00:00.000Z"));
  const second = predictGoalDistribution(request, CONFIG, () => new Date("2030-06-15T08:30:00.000Z"));
  assert.equal(first.generatedAt, "2020-01-01T00:00:00.000Z");
  assert.equal(second.generatedAt, "2030-06-15T08:30:00.000Z");
  assert.deepEqual(first.expectedGoals, second.expectedGoals);
  assert.deepEqual(first.exactScores, second.exactScores);
  assert.deepEqual(first.featureTrace, second.featureTrace);
});

test("full response shape and invariants hold for a data-rich scenario", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1700, avgGoalsFor: 2.6, avgGoalsAgainst: 0.7, strengthValue: 75, momentumValue: 30, confidenceValue: 90, greenScoreValue: 78 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1450, avgGoalsFor: 1.0, avgGoalsAgainst: 1.9, strengthValue: 40, momentumValue: -20, confidenceValue: 90, greenScoreValue: 38 }),
    headToHead: headToHead("away", "home", { matchesCount: 6, playerAGoals: 4, playerBGoals: 11 }),
  };
  const prediction = predictGoalDistribution(request);
  assertValidPrediction(prediction);
  assert.ok(prediction.expectedGoals.home > prediction.expectedGoals.away);
  assert.ok(prediction.scoreDerivedOutcomeProbabilities.homeWin > prediction.scoreDerivedOutcomeProbabilities.awayWin);
  assert.equal(prediction.dataSufficiency.status, "STRONG");
});

test("total absence of data on both sides yields a valid, neutral, INSUFFICIENT-flagged prediction", () => {
  const prediction = predictGoalDistribution({ homePlayer: player("home", { matchesCount: 0 }), awayPlayer: player("away", { matchesCount: 0 }), headToHead: null });
  assertValidPrediction(prediction);
  assert.equal(prediction.dataSufficiency.status, "INSUFFICIENT");
  assert.equal(prediction.expectedGoals.home, CONFIG.fallbackBaseGoalsPerPlayer);
  assert.equal(prediction.expectedGoals.away, CONFIG.fallbackBaseGoalsPerPlayer);
  assert.ok(Math.abs(prediction.scoreDerivedOutcomeProbabilities.homeWin - prediction.scoreDerivedOutcomeProbabilities.awayWin) < 1e-9);
  assert.ok(prediction.warnings.includes("fallback_conservative_baseline_applied"));
});

test("warnings and dataSufficiency.warnings are complementary, never duplicated", () => {
  const prediction = predictGoalDistribution({ homePlayer: player("home", { matchesCount: 0 }), awayPlayer: player("away", { matchesCount: 0 }), headToHead: null });
  const overlap = prediction.warnings.filter((w) => prediction.dataSufficiency.warnings.includes(w));
  assert.equal(overlap.length, 0);
});

test("feature trace exposes name/weight/contribution/availability/explanation for every feature", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, avgGoalsFor: 2, avgGoalsAgainst: 1, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, avgGoalsFor: 1.5, avgGoalsAgainst: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: null,
  };
  const prediction = predictGoalDistribution(request);
  for (const feature of prediction.featureTrace) {
    assert.equal(typeof feature.name, "string");
    assert.equal(typeof feature.weight, "number");
    assert.equal(typeof feature.contributionHome, "number");
    assert.equal(typeof feature.contributionAway, "number");
    assert.ok(["AVAILABLE", "MISSING", "NOT_APPLICABLE"].includes(feature.availability));
    assert.equal(typeof feature.explanation, "string");
    assert.ok(feature.explanation.length > 0);
  }
});

test("never mutates the input request", () => {
  const homePlayer = fullPlayer("home", { ratingValue: 1600, avgGoalsFor: 2, avgGoalsAgainst: 1, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 });
  const awayPlayer = fullPlayer("away", { ratingValue: 1500, avgGoalsFor: 1.5, avgGoalsAgainst: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 });
  const headToHeadInput = headToHead("away", "home", { matchesCount: 4, playerAGoals: 3, playerBGoals: 6 });
  const request = { homePlayer, awayPlayer, headToHead: headToHeadInput };
  const snapshot = JSON.parse(JSON.stringify(request));

  predictGoalDistribution(request);

  assert.deepEqual(request, snapshot);
});

test("predictionContext (Sprint 4.1) is never read: varying it never changes any numeric output", () => {
  const homePlayerGoal = fullPlayer("home", { ratingValue: 1600, avgGoalsFor: 2, avgGoalsAgainst: 1, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 });
  const awayPlayerGoal = fullPlayer("away", { ratingValue: 1500, avgGoalsFor: 1.5, avgGoalsAgainst: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 });

  const withoutContext = predictGoalDistribution({ homePlayer: homePlayerGoal, awayPlayer: awayPlayerGoal, headToHead: null });

  const homePlayer1X2 = player("home", { matchesCount: 20, rating: rating(1600, 20), strength: strength(60), momentum: momentum(10), confidence: confidence(80), greenScore: greenScore(60) });
  const awayPlayer1X2 = player("away", { matchesCount: 20, rating: rating(1500, 20), strength: strength(50), momentum: momentum(0), confidence: confidence(80), greenScore: greenScore(50) });
  const predictionContext = predictMatchOutcome(
    { homePlayer: homePlayer1X2, awayPlayer: awayPlayer1X2, headToHead: null },
    DEFAULT_PREDICTION_MODEL_CONFIG,
    () => new Date("2026-01-01T00:00:00.000Z"),
  );

  const withContext = predictGoalDistribution({ homePlayer: homePlayerGoal, awayPlayer: awayPlayerGoal, headToHead: null, predictionContext });

  assert.deepEqual(withoutContext.expectedGoals, withContext.expectedGoals);
  assert.deepEqual(withoutContext.exactScores, withContext.exactScores);
  assert.deepEqual(withoutContext.overUnder, withContext.overUnder);
  assert.deepEqual(withoutContext.bothTeamsToScore, withContext.bothTeamsToScore);
  assert.deepEqual(withoutContext.scoreDerivedOutcomeProbabilities, withContext.scoreDerivedOutcomeProbabilities);
  assert.deepEqual(withoutContext.featureTrace, withContext.featureTrace);
});

test("scoreDerivedOutcomeProbabilities (this sprint) and predictMatchOutcome (Sprint 4.1) are computed independently and never blended", () => {
  const homePlayerGoal = fullPlayer("home", { ratingValue: 1700, avgGoalsFor: 2.6, avgGoalsAgainst: 0.7, strengthValue: 75, momentumValue: 30, confidenceValue: 90, greenScoreValue: 78 });
  const awayPlayerGoal = fullPlayer("away", { ratingValue: 1450, avgGoalsFor: 1.0, avgGoalsAgainst: 1.9, strengthValue: 40, momentumValue: -20, confidenceValue: 90, greenScoreValue: 38 });
  const goalPrediction = predictGoalDistribution({ homePlayer: homePlayerGoal, awayPlayer: awayPlayerGoal, headToHead: null });

  const homePlayer1X2 = player("home", { matchesCount: 25, rating: rating(1700, 25), strength: strength(75), momentum: momentum(30), confidence: confidence(90), greenScore: greenScore(78) });
  const awayPlayer1X2 = player("away", { matchesCount: 25, rating: rating(1450, 25), strength: strength(40), momentum: momentum(-20), confidence: confidence(90), greenScore: greenScore(38) });
  const outcomePrediction = predictMatchOutcome({ homePlayer: homePlayer1X2, awayPlayer: awayPlayer1X2, headToHead: null });

  // Both should agree directionally (home favored), but they are two
  // independent models with different formulas — their exact numeric
  // values are not required (and not expected) to match.
  assert.ok(goalPrediction.scoreDerivedOutcomeProbabilities.homeWin > goalPrediction.scoreDerivedOutcomeProbabilities.awayWin);
  assert.equal(outcomePrediction.predictedOutcome, "HOME_WIN");
  assert.notEqual(goalPrediction.modelVersion, outcomePrediction.modelVersion);
});

test("an invalid configuration throws GoalDistributionConfigurationError instead of silently producing a prediction", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, avgGoalsFor: 2, avgGoalsAgainst: 1, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, avgGoalsFor: 1.5, avgGoalsAgainst: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: null,
  };
  const invalidConfig = { ...CONFIG, minLambda: -1 };
  assert.throws(() => predictGoalDistribution(request, invalidConfig), GoalDistributionConfigurationError);
});

test("never generates any betting-recommendation-shaped field (EV, Kelly, stake, recommendation)", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, avgGoalsFor: 2, avgGoalsAgainst: 1, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, avgGoalsFor: 1.5, avgGoalsAgainst: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: null,
  };
  const prediction = predictGoalDistribution(request);
  const serialized = JSON.stringify(prediction).toLowerCase();
  for (const forbidden of ["stake", "kelly", "edge", "recommendation", "bankroll"]) {
    assert.equal(serialized.includes(forbidden), false, `unexpected "${forbidden}" in prediction output`);
  }
});
