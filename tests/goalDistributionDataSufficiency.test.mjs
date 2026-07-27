import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGoalDistributionDataSufficiency } from "../src/services/goal-distribution/GoalDistributionDataSufficiency.ts";
import { DEFAULT_GOAL_DISTRIBUTION_CONFIG } from "../src/services/goal-distribution/GoalDistributionConfig.ts";

function homeAwaySplit({ matchesCount = 10 } = {}) {
  return { matchesCount, winRate: 0.5, goalsFor: 0, goalsAgainst: 0, avgGoalsFor: 1, avgGoalsAgainst: 1, bothTeamsScored: 0, over25: 0 };
}
function homeAwaySnapshot({ home, away } = {}) {
  return { home: home ?? homeAwaySplit(), away: away ?? homeAwaySplit() };
}
function confidence(confidenceScore) {
  return { confidenceScore, breakdown: { matchesFactor: confidenceScore, h2hFactor: confidenceScore, formFactor: confidenceScore } };
}
function headToHead(playerAId, playerBId, { matchesCount, playerAGoals = 0, playerBGoals = 0 }) {
  return { playerAId, playerBId, matchesCount, playerAWins: 0, playerBWins: 0, draws: matchesCount, playerAGoals, playerBGoals, over25Rate: 0, over35Rate: 0, bothTeamsScoredRate: 0, lastMatch: null, lastFiveMatches: [] };
}
function player(id, overrides = {}) {
  return { playerId: id, matchesCount: 20, rating: null, form: null, homeAway: null, momentum: null, strength: null, confidence: null, greenScore: null, goalsRates: null, ...overrides };
}

const CONFIG = DEFAULT_GOAL_DISTRIBUTION_CONFIG;

function evaluate(home, away, h2h, config = CONFIG) {
  return evaluateGoalDistributionDataSufficiency(home, away, h2h, config);
}

test("both players fully unknown (zero matches) is INSUFFICIENT with an explicit warning", () => {
  const result = evaluate(player("home", { matchesCount: 0 }), player("away", { matchesCount: 0 }), null);
  assert.equal(result.status, "INSUFFICIENT");
  assert.ok(result.warnings.includes("both_players_debutant"));
});

test("a debutant home player is INSUFFICIENT even if the away player has a rich history", () => {
  const result = evaluate(player("home", { matchesCount: 0 }), player("away", { matchesCount: 40, confidence: confidence(95) }), null);
  assert.equal(result.status, "INSUFFICIENT");
  assert.ok(result.warnings.includes("home_player_debutant"));
});

test("a debutant away player is INSUFFICIENT even if the home player has a rich history", () => {
  const result = evaluate(player("home", { matchesCount: 40, confidence: confidence(95) }), player("away", { matchesCount: 0 }), null);
  assert.equal(result.status, "INSUFFICIENT");
  assert.ok(result.warnings.includes("away_player_debutant"));
});

test("high confidence, full H2H and home/away sample yields STRONG", () => {
  const home = player("home", { matchesCount: 40, confidence: confidence(95), homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 10 }) }) });
  const away = player("away", { matchesCount: 40, confidence: confidence(95), homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 10 }) }) });
  const h2h = headToHead("away", "home", { matchesCount: 6, playerAGoals: 5, playerBGoals: 7 });
  const result = evaluate(home, away, h2h);
  assert.equal(result.status, "STRONG");
  assert.equal(result.warnings.length, 0);
});

test("missing head-to-head history caps status at SUFFICIENT even with strong confidence", () => {
  const home = player("home", { matchesCount: 40, confidence: confidence(95), homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 10 }) }) });
  const away = player("away", { matchesCount: 40, confidence: confidence(95), homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 10 }) }) });
  const result = evaluate(home, away, null);
  assert.equal(result.status, "SUFFICIENT");
  assert.ok(result.warnings.includes("no_head_to_head_history"));
});

test("when H2H is disabled by configuration, absent H2H is never flagged as a warning", () => {
  const home = player("home", { matchesCount: 40, confidence: confidence(95), homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 10 }) }) });
  const away = player("away", { matchesCount: 40, confidence: confidence(95), homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 10 }) }) });
  const disabledConfig = { ...CONFIG, headToHeadEnabled: false };
  const result = evaluate(home, away, null, disabledConfig);
  assert.equal(result.warnings.includes("no_head_to_head_history"), false);
});

test("missing home/away split data caps status at SUFFICIENT even with strong confidence and H2H", () => {
  const home = player("home", { matchesCount: 40, confidence: confidence(95) });
  const away = player("away", { matchesCount: 40, confidence: confidence(95) });
  const h2h = headToHead("away", "home", { matchesCount: 6, playerAGoals: 5, playerBGoals: 7 });
  const result = evaluate(home, away, h2h);
  assert.equal(result.status, "SUFFICIENT");
  assert.ok(result.warnings.includes("insufficient_home_away_split_data"));
});

test("missing confidence on either side is treated as the worst case, not assumed good", () => {
  const result = evaluate(player("home", { matchesCount: 40 }), player("away", { matchesCount: 40, confidence: confidence(95) }), null);
  assert.equal(result.status, "INSUFFICIENT");
  assert.ok(result.warnings.includes("home_confidence_unavailable"));
});

test("a moderate confidence score on both sides yields LIMITED", () => {
  const result = evaluate(player("home", { matchesCount: 5, confidence: confidence(30) }), player("away", { matchesCount: 5, confidence: confidence(35) }), null);
  assert.equal(result.status, "LIMITED");
});

test("invalid numeric indicator (NaN) caps status at LIMITED and adds an explicit warning", () => {
  const home = player("home", {
    matchesCount: 40,
    confidence: confidence(95),
    momentum: { momentumScore: Number.NaN, recentPointsPerGame: 0, baselinePointsPerGame: 0, recentWinRate: 0, baselineWinRate: 0 },
    homeAway: homeAwaySnapshot({ home: homeAwaySplit({ matchesCount: 10 }) }),
  });
  const away = player("away", { matchesCount: 40, confidence: confidence(95), homeAway: homeAwaySnapshot({ away: homeAwaySplit({ matchesCount: 10 }) }) });
  const h2h = headToHead("away", "home", { matchesCount: 6, playerAGoals: 5, playerBGoals: 7 });
  const result = evaluate(home, away, h2h);
  assert.equal(result.status, "LIMITED");
  assert.ok(result.warnings.includes("invalid_numeric_indicator_ignored"));
});

test("an invalid number inside goalsRates is also detected (even though goalsRates is unused in scoring)", () => {
  const home = player("home", {
    matchesCount: 40,
    confidence: confidence(95),
    goalsRates: { matchesCount: 10, over05: Number.NaN, over15: 0, over25: 0, over35: 0, over45: 0, over55: 0, bothTeamsScored: 0, cleanSheet: 0, failedToScore: 0 },
  });
  const away = player("away", { matchesCount: 40, confidence: confidence(95) });
  const result = evaluate(home, away, null);
  assert.ok(result.warnings.includes("invalid_numeric_indicator_ignored"));
});

test("reports raw sample sizes independent of status", () => {
  const home = player("home", { matchesCount: 7 });
  const away = player("away", { matchesCount: 12 });
  const h2h = headToHead("away", "home", { matchesCount: 3 });
  const result = evaluate(home, away, h2h);
  assert.equal(result.homeSampleSize, 7);
  assert.equal(result.awaySampleSize, 12);
  assert.equal(result.sampleSize, 7);
  assert.equal(result.headToHeadSampleSize, 3);
});

test("is deterministic for identical input", () => {
  const home = player("home", { matchesCount: 15, confidence: confidence(60) });
  const away = player("away", { matchesCount: 15, confidence: confidence(55) });
  assert.deepEqual(evaluate(home, away, null), evaluate(home, away, null));
});
