import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDataSufficiency } from "../src/services/prediction/PredictionDataSufficiency.ts";
import { buildPredictionFeatures } from "../src/services/prediction/PredictionFeatureBuilder.ts";
import { DEFAULT_PREDICTION_MODEL_CONFIG } from "../src/services/prediction/PredictionModelConfig.ts";

function homeAwaySplit({ matchesCount = 10, winRate = 0.5 } = {}) {
  return { matchesCount, winRate, goalsFor: 0, goalsAgainst: 0, avgGoalsFor: 0, avgGoalsAgainst: 0, bothTeamsScored: 0, over25: 0 };
}

function homeAwaySnapshot({ home, away } = {}) {
  return { home: home ?? homeAwaySplit(), away: away ?? homeAwaySplit() };
}

function rating(value, matchesCount = 20) {
  return { playerId: "p", rating: value, matchesCount };
}

function confidence(confidenceScore) {
  return { confidenceScore, breakdown: { matchesFactor: confidenceScore, h2hFactor: confidenceScore, formFactor: confidenceScore } };
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

function evaluate(request) {
  const featureTrace = buildPredictionFeatures(request, DEFAULT_PREDICTION_MODEL_CONFIG);
  return evaluateDataSufficiency(request, featureTrace, DEFAULT_PREDICTION_MODEL_CONFIG);
}

test("both players fully unknown (zero matches) is INSUFFICIENT with an explicit warning", () => {
  const request = {
    homePlayer: player("home", { matchesCount: 0 }),
    awayPlayer: player("away", { matchesCount: 0 }),
    headToHead: null,
  };
  const result = evaluate(request);
  assert.equal(result.status, "INSUFFICIENT");
  assert.ok(result.warnings.includes("both_players_debutant"));
});

test("a debutant home player (zero matches) is INSUFFICIENT even if the away player has a rich history", () => {
  const request = {
    homePlayer: player("home", { matchesCount: 0 }),
    awayPlayer: player("away", { matchesCount: 40, confidence: confidence(95) }),
    headToHead: null,
  };
  const result = evaluate(request);
  assert.equal(result.status, "INSUFFICIENT");
  assert.ok(result.warnings.includes("home_player_debutant"));
});

test("a debutant away player (zero matches) is INSUFFICIENT even if the home player has a rich history", () => {
  const request = {
    homePlayer: player("home", { matchesCount: 40, confidence: confidence(95) }),
    awayPlayer: player("away", { matchesCount: 0 }),
    headToHead: null,
  };
  const result = evaluate(request);
  assert.equal(result.status, "INSUFFICIENT");
  assert.ok(result.warnings.includes("away_player_debutant"));
});

test("high confidence on both sides, full H2H and home/away sample yields STRONG", () => {
  const request = {
    homePlayer: player("home", {
      matchesCount: 40,
      confidence: confidence(95),
      homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 10 }) }),
    }),
    awayPlayer: player("away", {
      matchesCount: 40,
      confidence: confidence(95),
      homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 10 }) }),
    }),
    headToHead: headToHead("away", "home", { matchesCount: 6, playerAWins: 2, playerBWins: 4 }),
  };
  const result = evaluate(request);
  assert.equal(result.status, "STRONG");
  assert.equal(result.warnings.length, 0);
});

test("missing head-to-head history caps status at SUFFICIENT even with strong confidence", () => {
  const request = {
    homePlayer: player("home", {
      matchesCount: 40,
      confidence: confidence(95),
      homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 10 }) }),
    }),
    awayPlayer: player("away", {
      matchesCount: 40,
      confidence: confidence(95),
      homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 10 }) }),
    }),
    headToHead: null,
  };
  const result = evaluate(request);
  assert.equal(result.status, "SUFFICIENT");
  assert.ok(result.warnings.includes("no_head_to_head_history"));
});

test("missing home/away split data caps status at SUFFICIENT even with strong confidence and H2H", () => {
  const request = {
    homePlayer: player("home", { matchesCount: 40, confidence: confidence(95) }),
    awayPlayer: player("away", { matchesCount: 40, confidence: confidence(95) }),
    headToHead: headToHead("away", "home", { matchesCount: 6, playerAWins: 2, playerBWins: 4 }),
  };
  const result = evaluate(request);
  assert.equal(result.status, "SUFFICIENT");
  assert.ok(result.warnings.includes("insufficient_home_away_split_data"));
});

test("missing confidence on either side is treated as the worst case, not assumed good", () => {
  const request = {
    homePlayer: player("home", { matchesCount: 40 }),
    awayPlayer: player("away", { matchesCount: 40, confidence: confidence(95) }),
    headToHead: null,
  };
  const result = evaluate(request);
  assert.equal(result.status, "INSUFFICIENT");
  assert.ok(result.warnings.includes("home_confidence_unavailable"));
});

test("a moderate confidence score (both sides) yields LIMITED", () => {
  const request = {
    homePlayer: player("home", { matchesCount: 5, confidence: confidence(30) }),
    awayPlayer: player("away", { matchesCount: 5, confidence: confidence(35) }),
    headToHead: null,
  };
  const result = evaluate(request);
  assert.equal(result.status, "LIMITED");
});

test("invalid numeric indicator (NaN) caps status at LIMITED and adds an explicit warning", () => {
  const request = {
    homePlayer: player("home", {
      matchesCount: 40,
      confidence: confidence(95),
      rating: rating(Number.NaN),
      homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 10 }) }),
    }),
    awayPlayer: player("away", {
      matchesCount: 40,
      confidence: confidence(95),
      homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 10 }) }),
    }),
    headToHead: headToHead("away", "home", { matchesCount: 6, playerAWins: 2, playerBWins: 4 }),
  };
  const result = evaluate(request);
  assert.equal(result.status, "LIMITED");
  assert.ok(result.warnings.includes("invalid_numeric_indicator_ignored"));
});

test("conflicting indicators produce an explicit warning without silently upgrading confidence", () => {
  // rating and strength both favor home; momentum and greenScore both favor
  // away — a genuine disagreement between at least two features per side.
  const request = {
    homePlayer: player("home", {
      matchesCount: 40,
      confidence: confidence(95),
      rating: rating(1900),
      strength: { attackStrength: 90, defenseStrength: 90, overallStrength: 90 },
      momentum: { momentumScore: -90, recentPointsPerGame: 0, baselinePointsPerGame: 3, recentWinRate: 0, baselineWinRate: 1 },
      greenScore: { greenScore: 5, classification: "FRACO" },
      homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 10 }) }),
    }),
    awayPlayer: player("away", {
      matchesCount: 40,
      confidence: confidence(95),
      rating: rating(1100),
      strength: { attackStrength: 10, defenseStrength: 10, overallStrength: 10 },
      momentum: { momentumScore: 90, recentPointsPerGame: 3, baselinePointsPerGame: 0, recentWinRate: 1, baselineWinRate: 0 },
      greenScore: { greenScore: 95, classification: "EXCELENTE" },
      homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 10 }) }),
    }),
    headToHead: headToHead("away", "home", { matchesCount: 6, playerAWins: 2, playerBWins: 4 }),
  };
  const result = evaluate(request);
  assert.ok(result.warnings.includes("conflicting_indicators"));
});

test("reports raw sample sizes independent of status", () => {
  const request = {
    homePlayer: player("home", { matchesCount: 7 }),
    awayPlayer: player("away", { matchesCount: 12 }),
    headToHead: headToHead("away", "home", { matchesCount: 3, playerAWins: 1, playerBWins: 2 }),
  };
  const result = evaluate(request);
  assert.equal(result.homeSampleSize, 7);
  assert.equal(result.awaySampleSize, 12);
  assert.equal(result.sampleSize, 7);
  assert.equal(result.headToHeadSampleSize, 3);
});

test("is deterministic for identical input", () => {
  const request = {
    homePlayer: player("home", { matchesCount: 15, confidence: confidence(60) }),
    awayPlayer: player("away", { matchesCount: 15, confidence: confidence(55) }),
    headToHead: null,
  };
  assert.deepEqual(evaluate(request), evaluate(request));
});
