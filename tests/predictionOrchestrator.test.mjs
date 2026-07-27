import test from "node:test";
import assert from "node:assert/strict";
import { predictMatch, computeConfigurationHash } from "../src/services/prediction-orchestrator/PredictionOrchestrator.ts";
import {
  DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG,
} from "../src/services/prediction-orchestrator/PredictionOrchestratorConfig.ts";
import { PredictionOrchestratorConfigurationError } from "../src/services/prediction-orchestrator/PredictionOrchestratorConfig.ts";

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

function strongHome() {
  return fullPlayer("home", { ratingValue: 1700, avgGoalsFor: 2.6, avgGoalsAgainst: 0.7, strengthValue: 75, momentumValue: 30, confidenceValue: 90, greenScoreValue: 78 });
}
function weakAway() {
  return fullPlayer("away", { ratingValue: 1450, avgGoalsFor: 1.0, avgGoalsAgainst: 1.9, strengthValue: 40, momentumValue: -20, confidenceValue: 90, greenScoreValue: 38 });
}

const FIXED_NOW = () => new Date("2026-07-27T12:00:00.000Z");

function assertValidResult(result) {
  assert.equal(result.metadata.predictionModelVersion, result.prediction.modelVersion);
  assert.equal(result.metadata.goalDistributionModelVersion, result.goalDistribution.modelVersion);
  assert.ok(result.confidence >= 0 && result.confidence <= 100);
  assert.ok(result.greenScore.score >= 0 && result.greenScore.score <= 100);
  assert.ok(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"].includes(result.greenScore.category));
  assert.ok(Array.isArray(result.warnings));
  assert.ok(Array.isArray(result.explanation.topSignals));
  assert.equal(typeof result.metadata.configurationHash, "string");
  assert.equal(result.metadata.configurationHash.length, 64);
}

test("using the default config and default clock (no explicit now) produces a valid result with a real, current-ish timestamp", () => {
  const before = Date.now();
  const result = predictMatch({ homePlayer: strongHome(), awayPlayer: weakAway(), headToHead: null });
  const after = Date.now();
  assertValidResult(result);
  const generatedAtMs = new Date(result.metadata.generatedAt).getTime();
  assert.ok(generatedAtMs >= before && generatedAtMs <= after);
});

test("integration: a clearly superior home player produces a coherent, fully-populated result", () => {
  const result = predictMatch(
    { homePlayer: strongHome(), awayPlayer: weakAway(), headToHead: headToHead("away", "home", { matchesCount: 6, playerAGoals: 4, playerBGoals: 11, playerAWins: 1, playerBWins: 4 }) },
    DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG,
    FIXED_NOW,
  );
  assertValidResult(result);
  assert.equal(result.prediction.predictedOutcome, "HOME_WIN");
  assert.ok(result.goalDistribution.expectedGoals.home > result.goalDistribution.expectedGoals.away);
});

test("determinism: identical request/config/clock yields an identical result", () => {
  const request = { homePlayer: strongHome(), awayPlayer: weakAway(), headToHead: null };
  const first = predictMatch(request, DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, FIXED_NOW);
  const second = predictMatch(request, DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, FIXED_NOW);
  assert.deepEqual(first, second);
});

test("generatedAt reflects the injected clock consistently across prediction, goalDistribution, and metadata", () => {
  const request = { homePlayer: strongHome(), awayPlayer: weakAway(), headToHead: null };
  const result = predictMatch(request, DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, FIXED_NOW);
  assert.equal(result.prediction.generatedAt, "2026-07-27T12:00:00.000Z");
  assert.equal(result.goalDistribution.generatedAt, "2026-07-27T12:00:00.000Z");
  assert.equal(result.metadata.generatedAt, "2026-07-27T12:00:00.000Z");
});

test("configurationHash is stable for the same config and differs when the config changes", () => {
  const hashA = computeConfigurationHash(DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG);
  const hashB = computeConfigurationHash(DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG);
  assert.equal(hashA, hashB);

  const customConfig = { ...DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, modelVersion: "custom-version" };
  const hashC = computeConfigurationHash(customConfig);
  assert.notEqual(hashA, hashC);
});

test("configurationHash is independent of object key construction order", () => {
  const configA = { a: 1, b: 2, c: { x: 1, y: 2 } };
  const configB = { c: { y: 2, x: 1 }, b: 2, a: 1 };
  assert.equal(computeConfigurationHash(configA), computeConfigurationHash(configB));
});

test("metadata.configurationHash matches the current DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG hash", () => {
  const request = { homePlayer: strongHome(), awayPlayer: weakAway(), headToHead: null };
  const result = predictMatch(request, DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, FIXED_NOW);
  assert.equal(result.metadata.configurationHash, computeConfigurationHash(DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG));
});

test("does not mutate the input request", () => {
  const homePlayer = strongHome();
  const awayPlayer = weakAway();
  const h2h = headToHead("away", "home", { matchesCount: 4, playerAGoals: 3, playerBGoals: 6 });
  const request = { homePlayer, awayPlayer, headToHead: h2h };
  const snapshot = JSON.parse(JSON.stringify(request));

  predictMatch(request, DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, FIXED_NOW);

  assert.deepEqual(request, snapshot);
});

test("total absence of data on both sides still yields a valid, low-confidence result", () => {
  const request = { homePlayer: player("home", { matchesCount: 0 }), awayPlayer: player("away", { matchesCount: 0 }), headToHead: null };
  const result = predictMatch(request, DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, FIXED_NOW);
  assertValidResult(result);
  assert.equal(result.quality.combinedStatus, "INSUFFICIENT");
  assert.ok(result.confidence < 40);
  assert.equal(result.greenScore.category, "LOW");
});

test("an invalid configuration throws PredictionOrchestratorConfigurationError instead of silently producing a result", () => {
  const request = { homePlayer: strongHome(), awayPlayer: weakAway(), headToHead: null };
  const invalidConfig = { ...DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, greenScoreThresholds: { lowMax: 90, mediumMax: 50, highMax: 80 } };
  assert.throws(() => predictMatch(request, invalidConfig, FIXED_NOW), PredictionOrchestratorConfigurationError);
});

test("never generates any betting-recommendation-shaped field (Kelly, stake, EV, odds, bookmaker, ROI)", () => {
  const request = { homePlayer: strongHome(), awayPlayer: weakAway(), headToHead: null };
  const result = predictMatch(request, DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, FIXED_NOW);
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ["kelly", "stake", "expectedvalue", " ev ", "odds", "bookmaker", "roi", "bankroll", "recommendation"]) {
    assert.equal(serialized.includes(forbidden), false, `unexpected "${forbidden}" in orchestrator output`);
  }
});

test("PredictionResult carries the exact eight documented top-level fields", () => {
  const request = { homePlayer: strongHome(), awayPlayer: weakAway(), headToHead: null };
  const result = predictMatch(request, DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, FIXED_NOW);
  assert.deepEqual(
    Object.keys(result).sort(),
    ["confidence", "explanation", "goalDistribution", "greenScore", "metadata", "prediction", "quality", "warnings"].sort(),
  );
});

test("swapping which player is home/away does not crash and produces internally consistent output", () => {
  const swapped = predictMatch({ homePlayer: weakAway(), awayPlayer: strongHome(), headToHead: null }, DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, FIXED_NOW);
  assertValidResult(swapped);
  assert.equal(swapped.prediction.predictedOutcome, "AWAY_WIN");
});
