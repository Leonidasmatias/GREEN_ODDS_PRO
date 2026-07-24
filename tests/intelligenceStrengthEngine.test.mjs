import test from "node:test";
import assert from "node:assert/strict";
import { calculateStrength } from "../src/services/intelligence/StrengthEngine.ts";

function form(overrides = {}) {
  return {
    windowSize: 10,
    matchesCount: 10,
    wins: 5,
    draws: 2,
    losses: 3,
    winRate: 0.5,
    pointsPerGame: 1.5,
    goalsFor: 15,
    goalsAgainst: 12,
    goalDifference: 3,
    avgGoalsFor: 1.5,
    avgGoalsAgainst: 1.2,
    ...overrides,
  };
}

function homeAway(overrides = {}) {
  return {
    matchesCount: 10,
    winRate: 0.5,
    goalsFor: 15,
    goalsAgainst: 12,
    avgGoalsFor: 1.5,
    avgGoalsAgainst: 1.2,
    bothTeamsScored: 0.5,
    over25: 0.5,
    ...overrides,
  };
}

function momentum(overrides = {}) {
  return {
    momentumScore: 0,
    recentPointsPerGame: 1.5,
    baselinePointsPerGame: 1.5,
    recentWinRate: 0.5,
    baselineWinRate: 0.5,
    ...overrides,
  };
}

test("all three strength indicators always stay within 0..100", () => {
  const extremeLow = calculateStrength({
    rating: 500,
    form: form({ avgGoalsFor: 0, avgGoalsAgainst: 5, pointsPerGame: 0 }),
    homeAway: homeAway({ winRate: 0 }),
    momentum: momentum({ momentumScore: -100 }),
  });
  const extremeHigh = calculateStrength({
    rating: 2500,
    form: form({ avgGoalsFor: 5, avgGoalsAgainst: 0, pointsPerGame: 3 }),
    homeAway: homeAway({ winRate: 1 }),
    momentum: momentum({ momentumScore: 100 }),
  });
  for (const result of [extremeLow, extremeHigh]) {
    assert.ok(result.attackStrength >= 0 && result.attackStrength <= 100);
    assert.ok(result.defenseStrength >= 0 && result.defenseStrength <= 100);
    assert.ok(result.overallStrength >= 0 && result.overallStrength <= 100);
  }
});

test("a higher rating alone increases overall strength, all else equal", () => {
  const low = calculateStrength({ rating: 1300, form: form(), homeAway: homeAway(), momentum: momentum() });
  const high = calculateStrength({ rating: 1700, form: form(), homeAway: homeAway(), momentum: momentum() });
  assert.ok(high.overallStrength > low.overallStrength);
});

test("higher avgGoalsFor increases attack strength but not defense strength", () => {
  const base = calculateStrength({
    rating: 1500,
    form: form({ avgGoalsFor: 1 }),
    homeAway: homeAway(),
    momentum: momentum(),
  });
  const moreAttack = calculateStrength({
    rating: 1500,
    form: form({ avgGoalsFor: 2.8 }),
    homeAway: homeAway(),
    momentum: momentum(),
  });
  assert.ok(moreAttack.attackStrength > base.attackStrength);
  assert.equal(moreAttack.defenseStrength, base.defenseStrength);
});

test("higher avgGoalsAgainst decreases defense strength but not attack strength", () => {
  const base = calculateStrength({
    rating: 1500,
    form: form({ avgGoalsAgainst: 0.5 }),
    homeAway: homeAway(),
    momentum: momentum(),
  });
  const leakier = calculateStrength({
    rating: 1500,
    form: form({ avgGoalsAgainst: 2.8 }),
    homeAway: homeAway(),
    momentum: momentum(),
  });
  assert.ok(leakier.defenseStrength < base.defenseStrength);
  assert.equal(leakier.attackStrength, base.attackStrength);
});

test("zero-match (empty) form and home/away input does not crash and stays bounded", () => {
  const result = calculateStrength({
    rating: 1500,
    form: form({ matchesCount: 0, wins: 0, draws: 0, losses: 0, winRate: 0, pointsPerGame: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, avgGoalsFor: 0, avgGoalsAgainst: 0 }),
    homeAway: homeAway({ matchesCount: 0, winRate: 0, goalsFor: 0, goalsAgainst: 0, avgGoalsFor: 0, avgGoalsAgainst: 0, bothTeamsScored: 0, over25: 0 }),
    momentum: momentum({ momentumScore: 0 }),
  });
  assert.ok(Number.isFinite(result.attackStrength));
  assert.ok(Number.isFinite(result.defenseStrength));
  assert.ok(Number.isFinite(result.overallStrength));
  assert.ok(result.attackStrength >= 0 && result.attackStrength <= 100);
  assert.ok(result.defenseStrength >= 0 && result.defenseStrength <= 100);
  assert.ok(result.overallStrength >= 0 && result.overallStrength <= 100);
});

test("results are always whole numbers (rounded)", () => {
  const result = calculateStrength({ rating: 1613, form: form({ avgGoalsFor: 1.73 }), homeAway: homeAway(), momentum: momentum({ momentumScore: 37 }) });
  assert.equal(Number.isInteger(result.attackStrength), true);
  assert.equal(Number.isInteger(result.defenseStrength), true);
  assert.equal(Number.isInteger(result.overallStrength), true);
});
