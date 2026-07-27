import test from "node:test";
import assert from "node:assert/strict";
import { predictMatchOutcome } from "../src/services/prediction/MatchOutcomeProbabilityEngine.ts";
import {
  DEFAULT_PREDICTION_MODEL_CONFIG,
  DEFAULT_PREDICTION_MODEL_WEIGHTS,
  PredictionConfigurationError,
} from "../src/services/prediction/PredictionModelConfig.ts";

function emptyFormWindow(windowSize) {
  return {
    windowSize,
    matchesCount: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: 0,
    pointsPerGame: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    avgGoalsFor: 0,
    avgGoalsAgainst: 0,
  };
}

function formWindow(windowSize, { matchesCount = 10, pointsPerGame = 1.5, draws = 0, wins = 0, losses = 0 } = {}) {
  return {
    windowSize,
    matchesCount,
    wins,
    draws,
    losses,
    winRate: matchesCount ? wins / matchesCount : 0,
    pointsPerGame,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    avgGoalsFor: 0,
    avgGoalsAgainst: 0,
  };
}

function formSnapshot({ last5, last10, last20 } = {}) {
  return {
    last5: last5 ?? emptyFormWindow(5),
    last10: last10 ?? emptyFormWindow(10),
    last20: last20 ?? emptyFormWindow(20),
  };
}

function homeAwaySplit({ matchesCount = 10, winRate = 0.5 } = {}) {
  return { matchesCount, winRate, goalsFor: 0, goalsAgainst: 0, avgGoalsFor: 0, avgGoalsAgainst: 0, bothTeamsScored: 0, over25: 0 };
}

function homeAwaySnapshot({ home, away } = {}) {
  return { home: home ?? homeAwaySplit(), away: away ?? homeAwaySplit() };
}

function rating(value, matchesCount = 20) {
  return { playerId: "p", rating: value, matchesCount };
}

function momentum(momentumScore) {
  return { momentumScore, recentPointsPerGame: 0, baselinePointsPerGame: 0, recentWinRate: 0, baselineWinRate: 0 };
}

function strength(overallStrength) {
  return { attackStrength: overallStrength, defenseStrength: overallStrength, overallStrength };
}

function confidence(confidenceScore) {
  return { confidenceScore, breakdown: { matchesFactor: confidenceScore, h2hFactor: confidenceScore, formFactor: confidenceScore } };
}

function greenScore(score) {
  return { greenScore: score, classification: "BOM" };
}

function headToHead(playerAId, playerBId, { matchesCount, playerAWins, playerBWins }) {
  return {
    playerAId,
    playerBId,
    matchesCount,
    playerAWins,
    playerBWins,
    draws: matchesCount - playerAWins - playerBWins,
    playerAGoals: 0,
    playerBGoals: 0,
    over25Rate: 0,
    over35Rate: 0,
    bothTeamsScoredRate: 0,
    lastMatch: null,
    lastFiveMatches: [],
  };
}

function player(id, overrides = {}) {
  return {
    playerId: id,
    matchesCount: 20,
    rating: null,
    form: null,
    homeAway: null,
    momentum: null,
    strength: null,
    confidence: null,
    greenScore: null,
    ...overrides,
  };
}

function fullPlayer(id, { ratingValue, ppg, strengthValue, momentumValue, confidenceValue, greenScoreValue, matchesCount = 25 }) {
  return player(id, {
    matchesCount,
    rating: rating(ratingValue, matchesCount),
    form: formSnapshot({ last10: formWindow(10, { pointsPerGame: ppg, matchesCount: 10, wins: Math.round((ppg / 3) * 10) }) }),
    strength: strength(strengthValue),
    momentum: momentum(momentumValue),
    confidence: confidence(confidenceValue),
    greenScore: greenScore(greenScoreValue),
    homeAway: homeAwaySnapshot(),
  });
}

function sumProbabilities(prediction) {
  const { homeWin, draw, awayWin } = prediction.probabilities;
  return homeWin + draw + awayWin;
}

function assertValidPrediction(prediction) {
  assert.ok(Math.abs(sumProbabilities(prediction) - 1) <= Number.EPSILON, `sum=${sumProbabilities(prediction)}`);
  assert.ok(prediction.probabilities.homeWin >= 0 && prediction.probabilities.homeWin <= 1);
  assert.ok(prediction.probabilities.draw >= 0 && prediction.probabilities.draw <= 1);
  assert.ok(prediction.probabilities.awayWin >= 0 && prediction.probabilities.awayWin <= 1);
  assert.ok(["HOME_WIN", "DRAW", "AWAY_WIN"].includes(prediction.predictedOutcome));
  assert.equal(prediction.modelVersion, DEFAULT_PREDICTION_MODEL_CONFIG.modelVersion);
  assert.ok(prediction.topProbability >= prediction.probabilityMargin);
  assert.equal(prediction.featureTrace.length, 8);
}

test("a clearly superior home player yields HOME_WIN as the predicted outcome", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1900, ppg: 2.7, strengthValue: 90, momentumValue: 60, confidenceValue: 90, greenScoreValue: 90 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1300, ppg: 0.4, strengthValue: 25, momentumValue: -40, confidenceValue: 90, greenScoreValue: 25 }),
    headToHead: headToHead("away", "home", { matchesCount: 8, playerAWins: 1, playerBWins: 6 }),
  };
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  assert.equal(prediction.predictedOutcome, "HOME_WIN");
  assert.ok(prediction.probabilities.homeWin > prediction.probabilities.draw);
  assert.ok(prediction.probabilities.homeWin > prediction.probabilities.awayWin);
});

test("a clearly superior away player yields AWAY_WIN as the predicted outcome", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1300, ppg: 0.4, strengthValue: 25, momentumValue: -40, confidenceValue: 90, greenScoreValue: 25 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1900, ppg: 2.7, strengthValue: 90, momentumValue: 60, confidenceValue: 90, greenScoreValue: 90 }),
    headToHead: headToHead("away", "home", { matchesCount: 8, playerAWins: 6, playerBWins: 1 }),
  };
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  assert.equal(prediction.predictedOutcome, "AWAY_WIN");
  assert.ok(prediction.probabilities.awayWin > prediction.probabilities.draw);
  assert.ok(prediction.probabilities.awayWin > prediction.probabilities.homeWin);
});

test("evenly matched players yield a prediction dominated by the draw balance", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1550, ppg: 1.5, strengthValue: 55, momentumValue: 0, confidenceValue: 80, greenScoreValue: 55 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1550, ppg: 1.5, strengthValue: 55, momentumValue: 0, confidenceValue: 80, greenScoreValue: 55 }),
    headToHead: headToHead("away", "home", { matchesCount: 6, playerAWins: 3, playerBWins: 3 }),
  };
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  assert.equal(prediction.predictedOutcome, "DRAW");
  assert.ok(Math.abs(prediction.probabilities.homeWin - prediction.probabilities.awayWin) < 1e-9);
});

test("a scenario engineered for high draw tendency assigns the draw the largest share", () => {
  // Perfectly balanced across every axis, with a high historical draw rate.
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1500, ppg: 1.0, strengthValue: 50, momentumValue: 0, confidenceValue: 90, greenScoreValue: 50, matchesCount: 30 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, ppg: 1.0, strengthValue: 50, momentumValue: 0, confidenceValue: 90, greenScoreValue: 50, matchesCount: 30 }),
    headToHead: headToHead("away", "home", { matchesCount: 10, playerAWins: 5, playerBWins: 5 }),
  };
  request.homePlayer.form = formSnapshot({ last10: formWindow(10, { pointsPerGame: 1.0, matchesCount: 10, wins: 0, draws: 10 }) });
  request.awayPlayer.form = formSnapshot({ last10: formWindow(10, { pointsPerGame: 1.0, matchesCount: 10, wins: 0, draws: 10 }) });
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  assert.equal(prediction.predictedOutcome, "DRAW");
  assert.ok(prediction.probabilities.draw > prediction.probabilities.homeWin);
  assert.ok(prediction.probabilities.draw > prediction.probabilities.awayWin);
});

test("a small home advantage nudges probabilities without dominating the outcome", () => {
  const base = {
    homePlayer: fullPlayer("home", { ratingValue: 1520, ppg: 1.6, strengthValue: 52, momentumValue: 5, confidenceValue: 70, greenScoreValue: 52 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 70, greenScoreValue: 50 }),
    headToHead: null,
  };
  const prediction = predictMatchOutcome(base);
  assertValidPrediction(prediction);
  assert.ok(prediction.probabilities.homeWin > prediction.probabilities.awayWin);
  assert.ok(prediction.probabilities.homeWin - prediction.probabilities.awayWin < 0.3, "small advantage should not produce a landslide");
});

test("an extreme mismatch produces a heavily lopsided (but still valid) distribution", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 2000, ppg: 3, strengthValue: 100, momentumValue: 100, confidenceValue: 100, greenScoreValue: 100 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1000, ppg: 0, strengthValue: 0, momentumValue: -100, confidenceValue: 100, greenScoreValue: 0 }),
    headToHead: headToHead("away", "home", { matchesCount: 10, playerAWins: 0, playerBWins: 10 }),
  };
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  assert.equal(prediction.predictedOutcome, "HOME_WIN");
  // Every symmetric feature saturates at its extreme (normalizedValue = 1)
  // in this scenario, i.e. this is the ceiling home probability reachable
  // under the default (deliberately conservative) temperature of 4.
  assert.ok(prediction.probabilities.homeWin > 0.65);
  assert.ok(prediction.probabilities.homeWin > prediction.probabilities.draw);
  assert.ok(prediction.probabilities.homeWin > prediction.probabilities.awayWin);
});

test("all features available produces a fully AVAILABLE feature trace (except structurally-gated ones)", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, ppg: 2, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: headToHead("away", "home", { matchesCount: 4, playerAWins: 1, playerBWins: 2 }),
  };
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  const availabilities = Object.fromEntries(prediction.featureTrace.map((f) => [f.name, f.availability]));
  assert.equal(availabilities.ratingDifference, "AVAILABLE");
  assert.equal(availabilities.formDifference, "AVAILABLE");
  assert.equal(availabilities.strengthDifference, "AVAILABLE");
  assert.equal(availabilities.momentumDifference, "AVAILABLE");
  assert.equal(availabilities.homeAdvantage, "AVAILABLE");
  assert.equal(availabilities.headToHead, "AVAILABLE");
  assert.equal(availabilities.greenScoreDifference, "AVAILABLE");
  assert.equal(availabilities.drawBalance, "AVAILABLE");
});

test("only minimal features available still produces a valid, conservative prediction", () => {
  const request = {
    homePlayer: player("home", { matchesCount: 5, rating: rating(1550, 5) }),
    awayPlayer: player("away", { matchesCount: 5, rating: rating(1500, 5) }),
    headToHead: null,
  };
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  assert.equal(prediction.dataSufficiency.status, "INSUFFICIENT");
});

test("a debutant player (zero history) on one side yields a neutral prediction flagged INSUFFICIENT", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1700, ppg: 2.5, strengthValue: 80, momentumValue: 40, confidenceValue: 90, greenScoreValue: 80 }),
    awayPlayer: player("away", { matchesCount: 0 }),
    headToHead: null,
  };
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  assert.equal(prediction.dataSufficiency.status, "INSUFFICIENT");
  assert.ok(prediction.dataSufficiency.warnings.includes("away_player_debutant"));
  // No feature can be computed when one side is entirely unknown: neutral thirds.
  assert.ok(Math.abs(prediction.probabilities.homeWin - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(prediction.probabilities.draw - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(prediction.probabilities.awayWin - 1 / 3) <= Number.EPSILON);
});

test("both players are debutants: fully neutral prediction flagged INSUFFICIENT", () => {
  const request = {
    homePlayer: player("home", { matchesCount: 0 }),
    awayPlayer: player("away", { matchesCount: 0 }),
    headToHead: null,
  };
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  assert.equal(prediction.dataSufficiency.status, "INSUFFICIENT");
  assert.ok(prediction.dataSufficiency.warnings.includes("both_players_debutant"));
  assert.ok(Math.abs(prediction.probabilities.homeWin - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(prediction.probabilities.draw - 1 / 3) <= Number.EPSILON);
  assert.ok(Math.abs(prediction.probabilities.awayWin - 1 / 3) <= Number.EPSILON);
});

test("no head-to-head history is handled gracefully (headToHead feature MISSING, prediction still valid)", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, ppg: 2, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: null,
  };
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  const h2h = prediction.featureTrace.find((f) => f.name === "headToHead");
  assert.equal(h2h.availability, "MISSING");
  assert.ok(prediction.dataSufficiency.warnings.includes("no_head_to_head_history"));
});

test("missing home/away split data is handled gracefully (homeAdvantage feature MISSING)", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, ppg: 2, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: null,
  };
  request.homePlayer.homeAway = null;
  request.awayPlayer.homeAway = null;
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  const homeAdvantage = prediction.featureTrace.find((f) => f.name === "homeAdvantage");
  assert.equal(homeAdvantage.availability, "MISSING");
  assert.ok(prediction.dataSufficiency.warnings.includes("insufficient_home_away_split_data"));
});

test("inconsistent data (head-to-head referencing unrelated player ids) is handled without throwing", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, ppg: 2, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: headToHead("someone-else", "another-unrelated-id", { matchesCount: 5, playerAWins: 3, playerBWins: 2 }),
  };
  const prediction = predictMatchOutcome(request);
  assertValidPrediction(prediction);
  const h2h = prediction.featureTrace.find((f) => f.name === "headToHead");
  assert.equal(h2h.availability, "MISSING");
});

test("swapping which player is home/away swaps home/away win probabilities when no home/away split data is present", () => {
  // Home advantage is intentionally NOT swap-symmetric (it's tied to which
  // player actually plays at home in THIS match, see docs section 12), so
  // this test isolates the seven symmetric features by omitting homeAway.
  const alice = { ratingValue: 1700, ppg: 2.3, strengthValue: 75, momentumValue: 30, confidenceValue: 85, greenScoreValue: 78 };
  const bob = { ratingValue: 1450, ppg: 1.1, strengthValue: 45, momentumValue: -20, confidenceValue: 85, greenScoreValue: 40 };

  const original = predictMatchOutcome({
    homePlayer: fullPlayer("alice", alice),
    awayPlayer: fullPlayer("bob", bob),
    headToHead: headToHead("alice", "bob", { matchesCount: 6, playerAWins: 4, playerBWins: 2 }),
  });
  const swapped = predictMatchOutcome({
    homePlayer: fullPlayer("bob", bob),
    awayPlayer: fullPlayer("alice", alice),
    headToHead: headToHead("alice", "bob", { matchesCount: 6, playerAWins: 4, playerBWins: 2 }),
  });

  assert.ok(Math.abs(original.probabilities.homeWin - swapped.probabilities.awayWin) < 1e-9);
  assert.ok(Math.abs(original.probabilities.awayWin - swapped.probabilities.homeWin) < 1e-9);
  assert.ok(Math.abs(original.probabilities.draw - swapped.probabilities.draw) < 1e-9);
});

test("is deterministic for the same request and config", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, ppg: 2, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: headToHead("away", "home", { matchesCount: 4, playerAWins: 1, playerBWins: 2 }),
  };
  const fixedNow = () => new Date("2026-07-26T12:00:00.000Z");
  const first = predictMatchOutcome(request, DEFAULT_PREDICTION_MODEL_CONFIG, fixedNow);
  const second = predictMatchOutcome(request, DEFAULT_PREDICTION_MODEL_CONFIG, fixedNow);
  assert.deepEqual(first, second);
});

test("generatedAt reflects the injected clock and never influences the math", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, ppg: 2, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: null,
  };
  const first = predictMatchOutcome(request, DEFAULT_PREDICTION_MODEL_CONFIG, () => new Date("2020-01-01T00:00:00.000Z"));
  const second = predictMatchOutcome(request, DEFAULT_PREDICTION_MODEL_CONFIG, () => new Date("2030-06-15T08:30:00.000Z"));
  assert.equal(first.generatedAt, "2020-01-01T00:00:00.000Z");
  assert.equal(second.generatedAt, "2030-06-15T08:30:00.000Z");
  assert.deepEqual(first.probabilities, second.probabilities);
  assert.deepEqual(first.featureTrace, second.featureTrace);
});

test("a custom configuration changes the outcome in a predictable way", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1700, ppg: 2.3, strengthValue: 70, momentumValue: 20, confidenceValue: 85, greenScoreValue: 65 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 85, greenScoreValue: 50 }),
    headToHead: null,
  };
  const defaultPrediction = predictMatchOutcome(request);
  const flatConfig = {
    ...DEFAULT_PREDICTION_MODEL_CONFIG,
    temperature: 50,
  };
  const flattenedPrediction = predictMatchOutcome(request, flatConfig);
  // A much higher temperature must flatten the distribution toward uniform.
  const defaultSpread = defaultPrediction.probabilities.homeWin - defaultPrediction.probabilities.awayWin;
  const flattenedSpread = flattenedPrediction.probabilities.homeWin - flattenedPrediction.probabilities.awayWin;
  assert.ok(flattenedSpread < defaultSpread);
  assert.ok(flattenedSpread > 0);
});

test("a zero weight for a feature removes its influence entirely", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1900, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 85, greenScoreValue: 50 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1100, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 85, greenScoreValue: 50 }),
    headToHead: null,
  };
  const zeroRatingConfig = {
    ...DEFAULT_PREDICTION_MODEL_CONFIG,
    weights: { ...DEFAULT_PREDICTION_MODEL_WEIGHTS, ratingDifference: 0 },
  };
  const prediction = predictMatchOutcome(request, zeroRatingConfig);
  const ratingFeature = prediction.featureTrace.find((f) => f.name === "ratingDifference");
  assert.equal(ratingFeature.contribution, 0);
  assert.equal(ratingFeature.weight, 0);
});

test("an invalid configuration throws PredictionConfigurationError instead of silently producing a prediction", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, ppg: 2, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: null,
  };
  const invalidConfig = { ...DEFAULT_PREDICTION_MODEL_CONFIG, temperature: -1 };
  assert.throws(() => predictMatchOutcome(request, invalidConfig), PredictionConfigurationError);
});

test("never generates any betting-recommendation-shaped field", () => {
  const request = {
    homePlayer: fullPlayer("home", { ratingValue: 1600, ppg: 2, strengthValue: 60, momentumValue: 10, confidenceValue: 80, greenScoreValue: 60 }),
    awayPlayer: fullPlayer("away", { ratingValue: 1500, ppg: 1.5, strengthValue: 50, momentumValue: 0, confidenceValue: 80, greenScoreValue: 50 }),
    headToHead: null,
  };
  const prediction = predictMatchOutcome(request);
  const serialized = JSON.stringify(prediction).toLowerCase();
  for (const forbidden of ["stake", "kelly", "edge", " ev ", "recommendation", "bet", "odds"]) {
    assert.equal(serialized.includes(forbidden), false, `unexpected "${forbidden}" in prediction output`);
  }
});
