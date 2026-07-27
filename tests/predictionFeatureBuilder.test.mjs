import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionFeatures, orientHeadToHead } from "../src/services/prediction/PredictionFeatureBuilder.ts";
import { DEFAULT_PREDICTION_MODEL_CONFIG } from "../src/services/prediction/PredictionModelConfig.ts";

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

function findFeature(features, name) {
  const feature = features.find((f) => f.name === name);
  assert.ok(feature, `feature ${name} not found`);
  return feature;
}

const CONFIG = DEFAULT_PREDICTION_MODEL_CONFIG;

test("returns exactly the eight documented features, in fixed order", () => {
  const features = buildPredictionFeatures(
    { homePlayer: player("home"), awayPlayer: player("away"), headToHead: null },
    CONFIG,
  );
  assert.deepEqual(
    features.map((f) => f.name),
    [
      "ratingDifference",
      "formDifference",
      "strengthDifference",
      "momentumDifference",
      "homeAdvantage",
      "headToHead",
      "greenScoreDifference",
      "drawBalance",
    ],
  );
});

test("ratingDifference: higher home rating favors home and is available", () => {
  const request = {
    homePlayer: player("home", { rating: rating(1700) }),
    awayPlayer: player("away", { rating: rating(1500) }),
    headToHead: null,
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "ratingDifference");
  assert.equal(feature.availability, "AVAILABLE");
  assert.equal(feature.direction, "FAVORS_HOME");
  assert.ok(feature.normalizedValue > 0 && feature.normalizedValue <= 1);
  assert.equal(feature.rawValue, 200);
});

test("ratingDifference: missing rating on either side is MISSING, never fabricated", () => {
  const request = {
    homePlayer: player("home", { rating: rating(1700) }),
    awayPlayer: player("away", { rating: null }),
    headToHead: null,
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "ratingDifference");
  assert.equal(feature.availability, "MISSING");
  assert.equal(feature.contribution, 0);
  assert.equal(feature.direction, "NEUTRAL");
});

test("ratingDifference: NaN rating value is treated as MISSING, not propagated as NaN", () => {
  const request = {
    homePlayer: player("home", { rating: rating(Number.NaN) }),
    awayPlayer: player("away", { rating: rating(1500) }),
    headToHead: null,
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "ratingDifference");
  assert.equal(feature.availability, "MISSING");
  assert.equal(Number.isNaN(feature.contribution), false);
});

test("formDifference: uses the configured form window and favors the side with a better points-per-game", () => {
  const request = {
    homePlayer: player("home", { form: formSnapshot({ last10: formWindow(10, { pointsPerGame: 2.4 }) }) }),
    awayPlayer: player("away", { form: formSnapshot({ last10: formWindow(10, { pointsPerGame: 0.6 }) }) }),
    headToHead: null,
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "formDifference");
  assert.equal(feature.availability, "AVAILABLE");
  assert.equal(feature.direction, "FAVORS_HOME");
});

test("formDifference: zero-match window is MISSING, not treated as 0 form", () => {
  const request = {
    homePlayer: player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 0, pointsPerGame: 0 }) }) }),
    awayPlayer: player("away", { form: formSnapshot({ last10: formWindow(10, { pointsPerGame: 1 }) }) }),
    headToHead: null,
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "formDifference");
  assert.equal(feature.availability, "MISSING");
});

test("strengthDifference: uses overallStrength and favors the stronger side", () => {
  const request = {
    homePlayer: player("home", { strength: strength(80) }),
    awayPlayer: player("away", { strength: strength(20) }),
    headToHead: null,
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "strengthDifference");
  assert.equal(feature.availability, "AVAILABLE");
  assert.equal(feature.direction, "FAVORS_HOME");
  assert.equal(feature.rawValue, 60);
});

test("momentumDifference: favors the side with better momentum", () => {
  const request = {
    homePlayer: player("home", { momentum: momentum(-80) }),
    awayPlayer: player("away", { momentum: momentum(80) }),
    headToHead: null,
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "momentumDifference");
  assert.equal(feature.availability, "AVAILABLE");
  assert.equal(feature.direction, "FAVORS_AWAY");
});

test("homeAdvantage: available and favors home when both sides meet the minimum sample size", () => {
  const request = {
    homePlayer: player("home", { homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 10, winRate: 0.8 }) }) }),
    awayPlayer: player("away", { homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 10, winRate: 0.2 }) }) }),
    headToHead: null,
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "homeAdvantage");
  assert.equal(feature.availability, "AVAILABLE");
  assert.equal(feature.direction, "FAVORS_HOME");
});

test("homeAdvantage: NOT_APPLICABLE (not MISSING) when sample size is below the configured minimum", () => {
  const request = {
    homePlayer: player("home", { homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 1, winRate: 1 }) }) }),
    awayPlayer: player("away", { homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 1, winRate: 0 }) }) }),
    headToHead: null,
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "homeAdvantage");
  assert.equal(feature.availability, "NOT_APPLICABLE");
  assert.equal(feature.contribution, 0);
});

test("homeAdvantage: MISSING (not NOT_APPLICABLE) when homeAway snapshot is entirely absent", () => {
  const request = { homePlayer: player("home"), awayPlayer: player("away"), headToHead: null };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "homeAdvantage");
  assert.equal(feature.availability, "MISSING");
});

test("orientHeadToHead: reorients a canonical A/B pair to home/away regardless of storage order", () => {
  const h2h = headToHead("away", "home", { matchesCount: 4, playerAWins: 1, playerBWins: 3 });
  const oriented = orientHeadToHead(h2h, "home", "away");
  assert.equal(oriented.homeWins, 3);
  assert.equal(oriented.awayWins, 1);
  assert.equal(oriented.matchesCount, 4);
});

test("orientHeadToHead: mismatched participant ids are treated as unavailable, never thrown", () => {
  const h2h = headToHead("someone-else", "another-player", { matchesCount: 4, playerAWins: 1, playerBWins: 3 });
  const oriented = orientHeadToHead(h2h, "home", "away");
  assert.equal(oriented, null);
});

test("orientHeadToHead: zero matches is treated as unavailable", () => {
  const h2h = headToHead("home", "away", { matchesCount: 0, playerAWins: 0, playerBWins: 0 });
  assert.equal(orientHeadToHead(h2h, "home", "away"), null);
});

test("headToHead feature: favors home when home has won more of the H2H", () => {
  const request = {
    homePlayer: player("home"),
    awayPlayer: player("away"),
    headToHead: headToHead("home", "away", { matchesCount: 5, playerAWins: 4, playerBWins: 1 }),
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "headToHead");
  assert.equal(feature.availability, "AVAILABLE");
  assert.equal(feature.direction, "FAVORS_HOME");
});

test("greenScoreDifference: favors the side with the higher Green Score", () => {
  const request = {
    homePlayer: player("home", { greenScore: greenScore(30) }),
    awayPlayer: player("away", { greenScore: greenScore(90) }),
    headToHead: null,
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "greenScoreDifference");
  assert.equal(feature.availability, "AVAILABLE");
  assert.equal(feature.direction, "FAVORS_AWAY");
});

test("drawBalance: NOT_APPLICABLE when no sub-signal is available (both players fully unknown)", () => {
  const request = { homePlayer: player("home"), awayPlayer: player("away"), headToHead: null };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "drawBalance");
  assert.equal(feature.availability, "NOT_APPLICABLE");
  assert.equal(feature.contribution, 0);
});

test("drawBalance: close ratings yield a high balance score; far-apart ratings yield a low one", () => {
  const close = {
    homePlayer: player("home", { rating: rating(1505) }),
    awayPlayer: player("away", { rating: rating(1500) }),
    headToHead: null,
  };
  const far = {
    homePlayer: player("home", { rating: rating(1900) }),
    awayPlayer: player("away", { rating: rating(1100) }),
    headToHead: null,
  };
  const closeFeature = findFeature(buildPredictionFeatures(close, CONFIG), "drawBalance");
  const farFeature = findFeature(buildPredictionFeatures(far, CONFIG), "drawBalance");
  assert.equal(closeFeature.availability, "AVAILABLE");
  assert.equal(farFeature.availability, "AVAILABLE");
  assert.ok(closeFeature.normalizedValue > farFeature.normalizedValue);
  assert.equal(closeFeature.direction, "FAVORS_DRAW");
});

test("drawBalance: uses whichever sub-signals are available when some indicators are missing", () => {
  const request = {
    homePlayer: player("home", { rating: rating(1500) }),
    awayPlayer: player("away", { rating: rating(1500) }),
    headToHead: null,
  };
  const feature = findFeature(buildPredictionFeatures(request, CONFIG), "drawBalance");
  assert.equal(feature.availability, "AVAILABLE");
  assert.ok(feature.normalizedValue > 0.9);
});

test("is deterministic for identical input", () => {
  const request = {
    homePlayer: player("home", { rating: rating(1650), strength: strength(70), momentum: momentum(20) }),
    awayPlayer: player("away", { rating: rating(1500), strength: strength(50), momentum: momentum(-10) }),
    headToHead: headToHead("away", "home", { matchesCount: 3, playerAWins: 1, playerBWins: 2 }),
  };
  const first = buildPredictionFeatures(request, CONFIG);
  const second = buildPredictionFeatures(request, CONFIG);
  assert.deepEqual(first, second);
});
