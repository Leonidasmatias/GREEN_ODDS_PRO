import test from "node:test";
import assert from "node:assert/strict";
import { buildExpectedGoalsFeatures, orientHeadToHeadGoals } from "../src/services/goal-distribution/ExpectedGoalsFeatureBuilder.ts";
import { DEFAULT_GOAL_DISTRIBUTION_CONFIG } from "../src/services/goal-distribution/GoalDistributionConfig.ts";

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

function formWindow(windowSize, { matchesCount = 10, avgGoalsFor = 1.5, avgGoalsAgainst = 1.0 } = {}) {
  return {
    windowSize,
    matchesCount,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: 0,
    pointsPerGame: 0,
    goalsFor: avgGoalsFor * matchesCount,
    goalsAgainst: avgGoalsAgainst * matchesCount,
    goalDifference: (avgGoalsFor - avgGoalsAgainst) * matchesCount,
    avgGoalsFor,
    avgGoalsAgainst,
  };
}

function formSnapshot({ last5, last10, last20 } = {}) {
  return {
    last5: last5 ?? emptyFormWindow(5),
    last10: last10 ?? emptyFormWindow(10),
    last20: last20 ?? emptyFormWindow(20),
  };
}

function homeAwaySplit({ matchesCount = 10, avgGoalsFor = 1.5, avgGoalsAgainst = 1.0 } = {}) {
  return { matchesCount, winRate: 0, goalsFor: avgGoalsFor * matchesCount, goalsAgainst: avgGoalsAgainst * matchesCount, avgGoalsFor, avgGoalsAgainst, bothTeamsScored: 0, over25: 0 };
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

function headToHead(playerAId, playerBId, { matchesCount, playerAGoals, playerBGoals }) {
  return {
    playerAId,
    playerBId,
    matchesCount,
    playerAWins: 0,
    playerBWins: 0,
    draws: matchesCount,
    playerAGoals,
    playerBGoals,
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
    goalsRates: null,
    ...overrides,
  };
}

function findFeature(features, name) {
  const feature = features.find((f) => f.name === name);
  assert.ok(feature, `feature ${name} not found`);
  return feature;
}

const CONFIG = DEFAULT_GOAL_DISTRIBUTION_CONFIG;

test("returns exactly the five documented features, in fixed order", () => {
  const features = buildExpectedGoalsFeatures(player("home"), player("away"), null, CONFIG);
  assert.deepEqual(
    features.map((f) => f.name),
    ["recentForm", "homeAwaySplit", "headToHead", "momentum", "strength"],
  );
});

test("recentForm: blends attack and opponent-defense rates and is AVAILABLE when both sides have form", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 2.0, avgGoalsAgainst: 1.0 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 1.0, avgGoalsAgainst: 2.0 }) }) });
  const feature = findFeature(buildExpectedGoalsFeatures(home, away, null, CONFIG), "recentForm");
  assert.equal(feature.availability, "AVAILABLE");
  assert.ok(feature.contributionHome > feature.contributionAway);
});

test("recentForm: MISSING when either side lacks form data", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10) }) });
  const away = player("away");
  const feature = findFeature(buildExpectedGoalsFeatures(home, away, null, CONFIG), "recentForm");
  assert.equal(feature.availability, "MISSING");
  assert.equal(feature.contributionHome, 0);
  assert.equal(feature.contributionAway, 0);
});

test("recentForm: a zero-match window is MISSING, not treated as zero goals", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 0, avgGoalsFor: 0, avgGoalsAgainst: 0 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 10, avgGoalsFor: 1.5, avgGoalsAgainst: 1.5 }) }) });
  const feature = findFeature(buildExpectedGoalsFeatures(home, away, null, CONFIG), "recentForm");
  assert.equal(feature.availability, "MISSING");
});

test("recentForm: small samples are shrunk toward the conservative baseline, large samples trust the observed rate more", () => {
  const bigSampleHome = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 100, avgGoalsFor: 5, avgGoalsAgainst: 0 }) }) });
  const smallSampleHome = player("home2", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 1, avgGoalsFor: 5, avgGoalsAgainst: 0 }) }) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 20, avgGoalsFor: 1, avgGoalsAgainst: 1 }) }) });

  const bigFeature = findFeature(buildExpectedGoalsFeatures(bigSampleHome, away, null, CONFIG), "recentForm");
  const smallFeature = findFeature(buildExpectedGoalsFeatures(smallSampleHome, away, null, CONFIG), "recentForm");

  // Same observed rate (5 goals/match), but the 1-match sample must be
  // pulled much closer to the conservative baseline than the 100-match one.
  assert.ok(bigFeature.contributionHome > smallFeature.contributionHome);
});

test("homeAwaySplit: AVAILABLE when both sides meet the minimum sample size", () => {
  const home = player("home", { homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 10, avgGoalsFor: 2.5, avgGoalsAgainst: 0.5 }) }) });
  const away = player("away", { homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 10, avgGoalsFor: 0.5, avgGoalsAgainst: 2.0 }) }) });
  const feature = findFeature(buildExpectedGoalsFeatures(home, away, null, CONFIG), "homeAwaySplit");
  assert.equal(feature.availability, "AVAILABLE");
  assert.ok(feature.contributionHome > feature.contributionAway);
});

test("homeAwaySplit: NOT_APPLICABLE (not MISSING) when sample is below the configured minimum", () => {
  const home = player("home", { homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 1 }) }) });
  const away = player("away", { homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 1 }) }) });
  const feature = findFeature(buildExpectedGoalsFeatures(home, away, null, CONFIG), "homeAwaySplit");
  assert.equal(feature.availability, "NOT_APPLICABLE");
  assert.equal(feature.contributionHome, 0);
});

test("homeAwaySplit: MISSING when homeAway snapshot is entirely absent", () => {
  const feature = findFeature(buildExpectedGoalsFeatures(player("home"), player("away"), null, CONFIG), "homeAwaySplit");
  assert.equal(feature.availability, "MISSING");
});

test("orientHeadToHeadGoals: reorients a canonical A/B pair to home/away regardless of storage order", () => {
  const h2h = headToHead("away", "home", { matchesCount: 4, playerAGoals: 3, playerBGoals: 9 });
  const oriented = orientHeadToHeadGoals(h2h, "home", "away");
  assert.equal(oriented.homeGoalsAverage, 9 / 4);
  assert.equal(oriented.awayGoalsAverage, 3 / 4);
});

test("orientHeadToHeadGoals: mismatched participant ids are treated as unavailable, never thrown", () => {
  const h2h = headToHead("stranger-a", "stranger-b", { matchesCount: 4, playerAGoals: 1, playerBGoals: 2 });
  assert.equal(orientHeadToHeadGoals(h2h, "home", "away"), null);
});

test("orientHeadToHeadGoals: zero matches is treated as unavailable", () => {
  const h2h = headToHead("home", "away", { matchesCount: 0, playerAGoals: 0, playerBGoals: 0 });
  assert.equal(orientHeadToHeadGoals(h2h, "home", "away"), null);
});

test("headToHead feature: AVAILABLE and reflects each side's average goals in the head-to-head history", () => {
  const h2h = headToHead("home", "away", { matchesCount: 5, playerAGoals: 12, playerBGoals: 3 });
  const feature = findFeature(buildExpectedGoalsFeatures(player("home"), player("away"), h2h, CONFIG), "headToHead");
  assert.equal(feature.availability, "AVAILABLE");
  assert.ok(feature.contributionHome > feature.contributionAway);
});

test("headToHead feature: MISSING when there is no head-to-head history", () => {
  const feature = findFeature(buildExpectedGoalsFeatures(player("home"), player("away"), null, CONFIG), "headToHead");
  assert.equal(feature.availability, "MISSING");
});

test("headToHead feature: NOT_APPLICABLE when disabled by configuration, even with rich H2H history", () => {
  const h2h = headToHead("home", "away", { matchesCount: 10, playerAGoals: 20, playerBGoals: 5 });
  const disabledConfig = { ...CONFIG, headToHeadEnabled: false };
  const feature = findFeature(buildExpectedGoalsFeatures(player("home"), player("away"), h2h, disabledConfig), "headToHead");
  assert.equal(feature.availability, "NOT_APPLICABLE");
  assert.equal(feature.contributionHome, 0);
});

test("momentum: AVAILABLE and favors the side with better momentum, capped at maxMomentumGoalsAdjustment", () => {
  const home = player("home", { momentum: momentum(100) });
  const away = player("away", { momentum: momentum(-100) });
  const feature = findFeature(buildExpectedGoalsFeatures(home, away, null, CONFIG), "momentum");
  assert.equal(feature.availability, "AVAILABLE");
  assert.equal(feature.contributionHome, CONFIG.maxMomentumGoalsAdjustment);
  assert.equal(feature.contributionAway, -CONFIG.maxMomentumGoalsAdjustment);
});

test("momentum: MISSING when either side lacks momentum data", () => {
  const feature = findFeature(buildExpectedGoalsFeatures(player("home"), player("away"), null, CONFIG), "momentum");
  assert.equal(feature.availability, "MISSING");
});

test("strength: AVAILABLE and favors the side with better attack vs opponent defense, capped at maxStrengthGoalsAdjustment", () => {
  const home = player("home", { strength: strength(100, 100) });
  const away = player("away", { strength: strength(0, 0) });
  const feature = findFeature(buildExpectedGoalsFeatures(home, away, null, CONFIG), "strength");
  assert.equal(feature.availability, "AVAILABLE");
  assert.equal(feature.contributionHome, CONFIG.maxStrengthGoalsAdjustment);
  assert.equal(feature.contributionAway, -CONFIG.maxStrengthGoalsAdjustment);
});

test("strength: MISSING when either side lacks strength data", () => {
  const feature = findFeature(buildExpectedGoalsFeatures(player("home"), player("away"), null, CONFIG), "strength");
  assert.equal(feature.availability, "MISSING");
});

test("NaN in a numeric field is treated as MISSING, never propagated as NaN", () => {
  const home = player("home", { momentum: { momentumScore: Number.NaN, recentPointsPerGame: 0, baselinePointsPerGame: 0, recentWinRate: 0, baselineWinRate: 0 } });
  const away = player("away", { momentum: momentum(10) });
  const feature = findFeature(buildExpectedGoalsFeatures(home, away, null, CONFIG), "momentum");
  assert.equal(feature.availability, "MISSING");
  assert.equal(Number.isNaN(feature.contributionHome), false);
});

test("is deterministic for identical input", () => {
  const home = player("home", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 15, avgGoalsFor: 2, avgGoalsAgainst: 1 }) }), strength: strength(70), momentum: momentum(20) });
  const away = player("away", { form: formSnapshot({ last10: formWindow(10, { matchesCount: 15, avgGoalsFor: 1, avgGoalsAgainst: 2 }) }), strength: strength(40), momentum: momentum(-5) });
  const h2h = headToHead("away", "home", { matchesCount: 3, playerAGoals: 2, playerBGoals: 5 });
  const first = buildExpectedGoalsFeatures(home, away, h2h, CONFIG);
  const second = buildExpectedGoalsFeatures(home, away, h2h, CONFIG);
  assert.deepEqual(first, second);
});
