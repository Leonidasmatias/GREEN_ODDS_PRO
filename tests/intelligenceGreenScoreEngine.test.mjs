import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateGreenScore,
  classifyGreenScore,
  GREEN_SCORE_THRESHOLDS,
} from "../src/services/intelligence/GreenScoreEngine.ts";

function strength(overallStrength) {
  return { attackStrength: overallStrength, defenseStrength: overallStrength, overallStrength };
}

function momentum(momentumScore) {
  return {
    momentumScore,
    recentPointsPerGame: 1.5,
    baselinePointsPerGame: 1.5,
    recentWinRate: 0.5,
    baselineWinRate: 0.5,
  };
}

function goalsRates(bothTeamsScored, over25) {
  return {
    matchesCount: 10,
    over05: 0.9,
    over15: 0.8,
    over25,
    over35: 0.3,
    over45: 0.1,
    over55: 0.05,
    bothTeamsScored,
    cleanSheet: 0.2,
    failedToScore: 0.1,
  };
}

function confidence(confidenceScore) {
  return { confidenceScore, breakdown: { matchesFactor: confidenceScore, h2hFactor: confidenceScore, formFactor: confidenceScore } };
}

function h2h(matchesCount, playerAWins) {
  return {
    playerAId: "player-a",
    playerBId: "player-b",
    matchesCount,
    playerAWins,
    playerBWins: matchesCount - playerAWins,
    draws: 0,
    playerAGoals: 0,
    playerBGoals: 0,
    over25Rate: 0,
    over35Rate: 0,
    bothTeamsScoredRate: 0,
    lastMatch: null,
    lastFiveMatches: [],
  };
}

test("classifyGreenScore respects the four documented boundaries", () => {
  assert.equal(classifyGreenScore(0), "FRACO");
  assert.equal(classifyGreenScore(GREEN_SCORE_THRESHOLDS.FRACO_MAX), "FRACO");
  assert.equal(classifyGreenScore(GREEN_SCORE_THRESHOLDS.FRACO_MAX + 1), "REGULAR");
  assert.equal(classifyGreenScore(GREEN_SCORE_THRESHOLDS.REGULAR_MAX), "REGULAR");
  assert.equal(classifyGreenScore(GREEN_SCORE_THRESHOLDS.REGULAR_MAX + 1), "BOM");
  assert.equal(classifyGreenScore(GREEN_SCORE_THRESHOLDS.BOM_MAX), "BOM");
  assert.equal(classifyGreenScore(GREEN_SCORE_THRESHOLDS.BOM_MAX + 1), "EXCELENTE");
  assert.equal(classifyGreenScore(100), "EXCELENTE");
});

test("every component maxed out (with H2H available) yields a green score of 100 / EXCELENTE", () => {
  const result = calculateGreenScore({
    strength: strength(100),
    momentum: momentum(100),
    headToHead: h2h(10, 10),
    goalsRates: goalsRates(1, 1),
    confidence: confidence(100),
  });
  assert.equal(result.greenScore, 100);
  assert.equal(result.classification, "EXCELENTE");
});

test("every component at its floor yields a green score of 0 / FRACO", () => {
  const result = calculateGreenScore({
    strength: strength(0),
    momentum: momentum(-100),
    headToHead: h2h(10, 0),
    goalsRates: goalsRates(0, 0),
    confidence: confidence(0),
  });
  assert.equal(result.greenScore, 0);
  assert.equal(result.classification, "FRACO");
});

test("no H2H history (null) redistributes its weight and still reaches 100 when every other component is maxed", () => {
  const result = calculateGreenScore({
    strength: strength(100),
    momentum: momentum(100),
    headToHead: null,
    goalsRates: goalsRates(1, 1),
    confidence: confidence(100),
  });
  assert.equal(result.greenScore, 100);
});

test("an H2H record with zero matches is treated the same as no H2H history at all", () => {
  const withNull = calculateGreenScore({
    strength: strength(72),
    momentum: momentum(20),
    headToHead: null,
    goalsRates: goalsRates(0.4, 0.6),
    confidence: confidence(65),
  });
  const withEmptyH2H = calculateGreenScore({
    strength: strength(72),
    momentum: momentum(20),
    headToHead: h2h(0, 0),
    goalsRates: goalsRates(0.4, 0.6),
    confidence: confidence(65),
  });
  assert.equal(withNull.greenScore, withEmptyH2H.greenScore);
  assert.equal(withNull.classification, withEmptyH2H.classification);
});

test("green score is always an integer within 0..100 and matches classifyGreenScore", () => {
  const result = calculateGreenScore({
    strength: strength(58),
    momentum: momentum(-12),
    headToHead: h2h(4, 3),
    goalsRates: goalsRates(0.55, 0.45),
    confidence: confidence(70),
  });
  assert.equal(Number.isInteger(result.greenScore), true);
  assert.ok(result.greenScore >= 0 && result.greenScore <= 100);
  assert.equal(result.classification, classifyGreenScore(result.greenScore));
});
