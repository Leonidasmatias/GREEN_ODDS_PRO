import test from "node:test";
import assert from "node:assert/strict";
import { computeExpectedGoals } from "../src/services/goal-distribution/ExpectedGoalsEngine.ts";
import { DEFAULT_GOAL_DISTRIBUTION_CONFIG } from "../src/services/goal-distribution/GoalDistributionConfig.ts";

function emptyFormWindow(windowSize) {
  return { windowSize, matchesCount: 0, wins: 0, draws: 0, losses: 0, winRate: 0, pointsPerGame: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, avgGoalsFor: 0, avgGoalsAgainst: 0 };
}

function formWindow(windowSize, { matchesCount = 10, avgGoalsFor = 1.5, avgGoalsAgainst = 1.0 } = {}) {
  return { windowSize, matchesCount, wins: 0, draws: 0, losses: 0, winRate: 0, pointsPerGame: 0, goalsFor: avgGoalsFor * matchesCount, goalsAgainst: avgGoalsAgainst * matchesCount, goalDifference: 0, avgGoalsFor, avgGoalsAgainst };
}

function formSnapshot({ last5, last10, last20 } = {}) {
  return { last5: last5 ?? emptyFormWindow(5), last10: last10 ?? emptyFormWindow(10), last20: last20 ?? emptyFormWindow(20) };
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
    goalsRates: null,
    ...overrides,
  };
}

const CONFIG = DEFAULT_GOAL_DISTRIBUTION_CONFIG;

test("evenly matched players (identical form) yield equal expected goals for both sides", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 1.5, avgGoalsAgainst: 1.5 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 1.5, avgGoalsAgainst: 1.5 }) }) });
  const { expectedGoals } = computeExpectedGoals(home, away, null, CONFIG);
  assert.ok(Math.abs(expectedGoals.home - expectedGoals.away) < 1e-9);
});

test("a clearly stronger attacking home player yields higher expected goals for the home side", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 3.0, avgGoalsAgainst: 0.5 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 1.0, avgGoalsAgainst: 1.0 }) }) });
  const { expectedGoals } = computeExpectedGoals(home, away, null, CONFIG);
  assert.ok(expectedGoals.home > expectedGoals.away);
});

test("both expectedGoals are always finite and strictly positive", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 10, avgGoalsAgainst: 0 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 0, avgGoalsAgainst: 10 }) }) });
  const { expectedGoals } = computeExpectedGoals(home, away, null, CONFIG);
  assert.ok(Number.isFinite(expectedGoals.home) && expectedGoals.home > 0);
  assert.ok(Number.isFinite(expectedGoals.away) && expectedGoals.away > 0);
  assert.ok(expectedGoals.home <= CONFIG.maxLambda);
  assert.ok(expectedGoals.away >= CONFIG.minLambda);
});

test("total is always the sum of home and away", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 2, avgGoalsAgainst: 1 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 1, avgGoalsAgainst: 2 }) }) });
  const { expectedGoals } = computeExpectedGoals(home, away, null, CONFIG);
  assert.equal(expectedGoals.total, expectedGoals.home + expectedGoals.away);
});

test("no head-to-head history: expected goals still computed from other available features", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 2, avgGoalsAgainst: 1 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 1, avgGoalsAgainst: 1 }) }) });
  const { expectedGoals, warnings } = computeExpectedGoals(home, away, null, CONFIG);
  assert.ok(Number.isFinite(expectedGoals.home));
  assert.equal(warnings.includes("fallback_conservative_baseline_applied"), false);
});

test("no home/away split data: expected goals still computed from other available features", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 2, avgGoalsAgainst: 1 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 1, avgGoalsAgainst: 1 }) }) });
  const { expectedGoals } = computeExpectedGoals(home, away, null, CONFIG);
  assert.ok(Number.isFinite(expectedGoals.home) && Number.isFinite(expectedGoals.away));
});

test("small sample with shrinkage produces a lower expected-goals estimate than a large sample with the same observed rate", () => {
  const smallSampleHome = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 1, avgGoalsFor: 5, avgGoalsAgainst: 0 }) }) });
  const bigSampleHome = player("home2", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 100, avgGoalsFor: 5, avgGoalsAgainst: 0 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 1, avgGoalsAgainst: 1 }) }) });

  const smallResult = computeExpectedGoals(smallSampleHome, away, null, CONFIG);
  const bigResult = computeExpectedGoals(bigSampleHome, away, null, CONFIG);
  assert.ok(bigResult.expectedGoals.home > smallResult.expectedGoals.home);
});

test("a debutant player (no signals) on one side falls back to the conservative baseline, since every feature needs both sides", () => {
  // Every one of the five features blends BOTH players' data (e.g.
  // recentForm = home attack + away defense); a total debutant on one
  // side makes every feature MISSING/NOT_APPLICABLE regardless of how
  // much history the other side has — the engine cannot fabricate the
  // missing side's contribution, so it conservatively falls back.
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 2, avgGoalsAgainst: 1 }) }) });
  const away = player("away", { matchesCount: 0 });
  const { expectedGoals, warnings, featureTrace } = computeExpectedGoals(home, away, null, CONFIG);
  assert.ok(Number.isFinite(expectedGoals.home) && expectedGoals.home > 0);
  assert.ok(Number.isFinite(expectedGoals.away) && expectedGoals.away > 0);
  assert.equal(expectedGoals.home, CONFIG.fallbackBaseGoalsPerPlayer);
  assert.equal(expectedGoals.away, CONFIG.fallbackBaseGoalsPerPlayer);
  assert.ok(warnings.includes("fallback_conservative_baseline_applied"));
  assert.ok(featureTrace.every((feature) => feature.availability !== "AVAILABLE"));
});

test("both players are total debutants: falls back to the conservative baseline for both sides, flagged with a warning", () => {
  const { expectedGoals, warnings } = computeExpectedGoals(player("home", { matchesCount: 0 }), player("away", { matchesCount: 0 }), null, CONFIG);
  assert.equal(expectedGoals.home, CONFIG.fallbackBaseGoalsPerPlayer);
  assert.equal(expectedGoals.away, CONFIG.fallbackBaseGoalsPerPlayer);
  assert.ok(warnings.includes("fallback_conservative_baseline_applied"));
});

test("extreme observed values are clamped into [minLambda, maxLambda]", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 50, avgGoalsFor: 500, avgGoalsAgainst: 0 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 50, avgGoalsFor: 0, avgGoalsAgainst: 500 }) }) });
  const { expectedGoals } = computeExpectedGoals(home, away, null, CONFIG);
  assert.ok(expectedGoals.home <= CONFIG.maxLambda);
  assert.ok(expectedGoals.away >= CONFIG.minLambda);
});

test("NaN/Infinity in a signal never leaks into expectedGoals", () => {
  const home = player("home", {
    form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: Number.NaN, avgGoalsAgainst: 1 }) }),
    momentum: { momentumScore: Number.POSITIVE_INFINITY, recentPointsPerGame: 0, baselinePointsPerGame: 0, recentWinRate: 0, baselineWinRate: 0 },
  });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 1, avgGoalsAgainst: 1 }) }) });
  const { expectedGoals } = computeExpectedGoals(home, away, null, CONFIG);
  assert.ok(Number.isFinite(expectedGoals.home));
  assert.ok(Number.isFinite(expectedGoals.away));
});

test("is deterministic for identical input", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 15, avgGoalsFor: 2, avgGoalsAgainst: 1 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 15, avgGoalsFor: 1, avgGoalsAgainst: 2 }) }) });
  const first = computeExpectedGoals(home, away, null, CONFIG);
  const second = computeExpectedGoals(home, away, null, CONFIG);
  assert.deepEqual(first, second);
});
