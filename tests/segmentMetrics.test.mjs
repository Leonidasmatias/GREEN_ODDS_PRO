import test from "node:test";
import assert from "node:assert/strict";
import { computeEvaluationMetrics, computeSegmentEvaluations, toOutcomeProbabilityPair } from "../src/services/prediction-evaluation/SegmentMetrics.ts";
import { DEFAULT_PREDICTION_EVALUATION_CONFIG } from "../src/services/prediction-evaluation/PredictionEvaluationConfig.ts";

function predictionResult({ homeWin, draw, awayWin, predictedOutcome, confidence = 70, greenScoreValue = 60, greenScoreCategory = "HIGH" }) {
  return {
    prediction: { probabilities: { homeWin, draw, awayWin }, predictedOutcome, topProbability: Math.max(homeWin, draw, awayWin) },
    confidence,
    greenScore: { score: greenScoreValue, category: greenScoreCategory },
  };
}

function record(matchId, {
  homeWin = 0.6,
  draw = 0.25,
  awayWin = 0.15,
  predictedOutcome = "HOME_WIN",
  actualOutcome = "HOME_WIN",
  confidence = 70,
  greenScoreCategory = "HIGH",
  homePlayerId = "home",
  awayPlayerId = "away",
  virtualTeamHome = null,
  virtualTeamAway = null,
  league = null,
  period = null,
  sequenceKey = null,
  homeGoals = null,
  awayGoals = null,
} = {}) {
  return {
    snapshot: {
      matchId,
      homePlayerId,
      awayPlayerId,
      virtualTeamHome,
      virtualTeamAway,
      league,
      period,
      sequenceKey,
      result: predictionResult({ homeWin, draw, awayWin, predictedOutcome, confidence, greenScoreCategory }),
    },
    actual: { matchId, outcome: actualOutcome, homeGoals, awayGoals },
  };
}

const CONFIG = DEFAULT_PREDICTION_EVALUATION_CONFIG;

test("computeEvaluationMetrics returns all-zero (never NaN) for an empty list", () => {
  const metrics = computeEvaluationMetrics([]);
  assert.equal(metrics.totalRecords, 0);
  assert.equal(metrics.accuracy, 0);
  assert.equal(metrics.brierScore, 0);
  assert.equal(metrics.logLoss, 0);
  assert.equal(metrics.macroPrecision, 0);
  assert.equal(metrics.macroRecall, 0);
});

test("computeEvaluationMetrics: a single perfect (probability 1/0) correct prediction yields brierScore 0", () => {
  const pair = toOutcomeProbabilityPair(record("m1", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" }));
  const metrics = computeEvaluationMetrics([pair]);
  assert.equal(metrics.brierScore, 0);
  assert.equal(metrics.accuracy, 1);
});

test("computeEvaluationMetrics: a single fully-confident wrong prediction yields brierScore 2 and finite logLoss", () => {
  const pair = toOutcomeProbabilityPair(record("m1", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "AWAY_WIN" }));
  const metrics = computeEvaluationMetrics([pair]);
  assert.equal(metrics.brierScore, 2);
  assert.ok(Number.isFinite(metrics.logLoss));
  assert.ok(metrics.logLoss > 10);
});

test("computeEvaluationMetrics never produces NaN or Infinity even with extreme probability inputs", () => {
  const pair = toOutcomeProbabilityPair(record("m1", { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN", actualOutcome: "DRAW" }));
  const metrics = computeEvaluationMetrics([pair]);
  for (const value of Object.values(metrics)) {
    if (typeof value === "number") assert.ok(Number.isFinite(value));
  }
});

test("computeEvaluationMetrics: a tie in probabilities (1/3 each) resolves via the HOME_WIN>DRAW>AWAY_WIN tie-break", () => {
  const pair = toOutcomeProbabilityPair(record("m1", { homeWin: 1 / 3, draw: 1 / 3, awayWin: 1 / 3, actualOutcome: "HOME_WIN" }));
  const metrics = computeEvaluationMetrics([pair]);
  assert.equal(metrics.correct, 1);
});

test("computeEvaluationMetrics macroPrecision/macroRecall are 1 when every prediction is correct across all three classes", () => {
  const pairs = [
    toOutcomeProbabilityPair(record("m1", { homeWin: 0.8, draw: 0.1, awayWin: 0.1, predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" })),
    toOutcomeProbabilityPair(record("m2", { homeWin: 0.1, draw: 0.8, awayWin: 0.1, predictedOutcome: "DRAW", actualOutcome: "DRAW" })),
    toOutcomeProbabilityPair(record("m3", { homeWin: 0.1, draw: 0.1, awayWin: 0.8, predictedOutcome: "AWAY_WIN", actualOutcome: "AWAY_WIN" })),
  ];
  const metrics = computeEvaluationMetrics(pairs);
  assert.equal(metrics.macroPrecision, 1);
  assert.equal(metrics.macroRecall, 1);
});

test("computeEvaluationMetrics macroPrecision/macroRecall treat a class with zero support/predictions as 0, not NaN (macro average always spans all 3 classes)", () => {
  const pairs = [
    toOutcomeProbabilityPair(record("m1", { predictedOutcome: "HOME_WIN", actualOutcome: "HOME_WIN" })),
    toOutcomeProbabilityPair(record("m2", { homeWin: 0.1, draw: 0.8, awayWin: 0.1, predictedOutcome: "DRAW", actualOutcome: "DRAW" })),
  ];
  const metrics = computeEvaluationMetrics(pairs);
  assert.ok(Math.abs(metrics.macroPrecision - 2 / 3) < 1e-9);
  assert.ok(Math.abs(metrics.macroRecall - 2 / 3) < 1e-9);
});

test("computeEvaluationMetrics averageConfidence ignores null confidence (benchmarks) without dividing by zero", () => {
  const pairs = [{ matchId: "m1", probabilities: { homeWin: 1, draw: 0, awayWin: 0 }, confidence: null, actualOutcome: "HOME_WIN" }];
  const metrics = computeEvaluationMetrics(pairs);
  assert.equal(metrics.averageConfidence, 0);
  assert.ok(Number.isFinite(metrics.averageConfidence));
});

test("segments: PLAYER groups each match under both the home and away player", () => {
  const records = [record("m1", { homePlayerId: "alice", awayPlayerId: "bob" }), record("m2", { homePlayerId: "carol", awayPlayerId: "bob" })];
  const segments = computeSegmentEvaluations(records, CONFIG);
  const bobSegment = segments.find((s) => s.segment.type === "PLAYER" && s.segment.key === "bob");
  assert.ok(bobSegment);
  assert.equal(bobSegment.metrics.totalRecords, 2);
});

test("segments: VIRTUAL_TEAM groups each match under both its home and away virtual team, excluding null teams", () => {
  const records = [
    record("m1", { virtualTeamHome: "Bologna", virtualTeamAway: "Roma" }),
    record("m2", { virtualTeamHome: "Juventus", virtualTeamAway: "Roma" }),
    record("m3", { virtualTeamHome: null, virtualTeamAway: null }),
  ];
  const segments = computeSegmentEvaluations(records, CONFIG);
  const romaSegment = segments.find((s) => s.segment.type === "VIRTUAL_TEAM" && s.segment.key === "Roma");
  assert.ok(romaSegment);
  assert.equal(romaSegment.metrics.totalRecords, 2);
  const virtualTeamSegments = segments.filter((s) => s.segment.type === "VIRTUAL_TEAM");
  assert.deepEqual(virtualTeamSegments.map((s) => s.segment.key), ["Bologna", "Juventus", "Roma"]);
});

test("segments: LEAGUE excludes records with a null league", () => {
  const records = [record("m1", { league: "league-a" }), record("m2", { league: null })];
  const segments = computeSegmentEvaluations(records, CONFIG);
  const leagueSegments = segments.filter((s) => s.segment.type === "LEAGUE");
  assert.equal(leagueSegments.length, 1);
  assert.equal(leagueSegments[0].segment.key, "league-a");
});

test("segments: CONFIDENCE_BUCKET assigns records to the correct bucket using config.confidenceBuckets", () => {
  const records = [record("m1", { confidence: 15 }), record("m2", { confidence: 85 })];
  const segments = computeSegmentEvaluations(records, CONFIG);
  const lowBucket = segments.find((s) => s.segment.type === "CONFIDENCE_BUCKET" && s.segment.key === "0-20");
  const highBucket = segments.find((s) => s.segment.type === "CONFIDENCE_BUCKET" && s.segment.key === "80-100");
  assert.equal(lowBucket.metrics.totalRecords, 1);
  assert.equal(highBucket.metrics.totalRecords, 1);
});

test("segments: CONFIDENCE_BUCKET excludes a record whose confidence falls outside every configured bucket, never fabricating a label", () => {
  const records = [record("m1", { confidence: 150 })];
  const segments = computeSegmentEvaluations(records, CONFIG);
  const confidenceSegments = segments.filter((s) => s.segment.type === "CONFIDENCE_BUCKET");
  assert.equal(confidenceSegments.reduce((sum, s) => sum + s.metrics.totalRecords, 0), 0);
});

test("segments: GREEN_SCORE always reports all four categories, even with zero sample (never fabricated data)", () => {
  const records = [record("m1", { greenScoreCategory: "HIGH" })];
  const segments = computeSegmentEvaluations(records, CONFIG);
  const greenScoreSegments = segments.filter((s) => s.segment.type === "GREEN_SCORE");
  assert.equal(greenScoreSegments.length, 4);
  const lowSegment = greenScoreSegments.find((s) => s.segment.key === "LOW");
  assert.equal(lowSegment.metrics.totalRecords, 0);
  assert.equal(lowSegment.status, "EMPTY");
});

test("segments below the configured minimum sample are flagged INSUFFICIENT_SAMPLE with a warning", () => {
  const records = [record("m1", { league: "small-league" })];
  const config = { ...CONFIG, minRecordsPerSegment: 5 };
  const segments = computeSegmentEvaluations(records, config);
  const smallLeague = segments.find((s) => s.segment.type === "LEAGUE" && s.segment.key === "small-league");
  assert.equal(smallLeague.status, "INSUFFICIENT_SAMPLE");
  assert.ok(smallLeague.warnings.some((w) => w.code === "SEGMENT_INSUFFICIENT_SAMPLE"));
});

test("segments meeting the minimum sample are OK with no warnings", () => {
  const records = Array.from({ length: 5 }, (_, i) => record(`m${i}`, { league: "big-league" }));
  const config = { ...CONFIG, minRecordsPerSegment: 5 };
  const segments = computeSegmentEvaluations(records, config);
  const bigLeague = segments.find((s) => s.segment.type === "LEAGUE" && s.segment.key === "big-league");
  assert.equal(bigLeague.status, "OK");
  assert.equal(bigLeague.warnings.length, 0);
});

test("segments: HOME_AWAY splits by predicted outcome into HOME/AWAY/NEUTRAL", () => {
  const records = [
    record("m1", { predictedOutcome: "HOME_WIN" }),
    record("m2", { predictedOutcome: "AWAY_WIN" }),
    record("m3", { predictedOutcome: "DRAW" }),
  ];
  const segments = computeSegmentEvaluations(records, CONFIG);
  const homeAway = segments.filter((s) => s.segment.type === "HOME_AWAY");
  assert.equal(homeAway.length, 3);
  assert.equal(homeAway.find((s) => s.segment.key === "HOME").metrics.totalRecords, 1);
  assert.equal(homeAway.find((s) => s.segment.key === "AWAY").metrics.totalRecords, 1);
  assert.equal(homeAway.find((s) => s.segment.key === "NEUTRAL").metrics.totalRecords, 1);
});

test("segments: OBSERVED_GOALS_BUCKET excludes records with null goals and never fabricates a bucket", () => {
  const records = [record("m1", { homeGoals: 2, awayGoals: 1 }), record("m2", { homeGoals: null, awayGoals: null })];
  const segments = computeSegmentEvaluations(records, CONFIG);
  const goalsSegments = segments.filter((s) => s.segment.type === "OBSERVED_GOALS_BUCKET");
  assert.equal(goalsSegments.length, 1);
  assert.equal(goalsSegments[0].segment.key, "3");
});

test("segments: OBSERVED_GOALS_BUCKET caps at 4+ for high-scoring matches", () => {
  const records = [record("m1", { homeGoals: 3, awayGoals: 4 })];
  const segments = computeSegmentEvaluations(records, CONFIG);
  const bucket = segments.find((s) => s.segment.type === "OBSERVED_GOALS_BUCKET");
  assert.equal(bucket.segment.key, "4+");
});

test("only enabled segment types are computed", () => {
  const records = [record("m1", { league: "league-a" })];
  const config = { ...CONFIG, enabledSegments: ["LEAGUE"] };
  const segments = computeSegmentEvaluations(records, config);
  assert.ok(segments.every((s) => s.segment.type === "LEAGUE"));
});

test("segment ordering is deterministic: fixed segment-type order, alphabetical key order within a type", () => {
  const records = [record("m1", { league: "zeta" }), record("m2", { league: "alpha" })];
  const segments = computeSegmentEvaluations(records, CONFIG).filter((s) => s.segment.type === "LEAGUE");
  assert.deepEqual(segments.map((s) => s.segment.key), ["alpha", "zeta"]);
});

test("is deterministic for identical input", () => {
  const records = [record("m1", { league: "a" }), record("m2", { league: "b" })];
  assert.deepEqual(computeSegmentEvaluations(records, CONFIG), computeSegmentEvaluations(records, CONFIG));
  assert.deepEqual(computeEvaluationMetrics(records.map(toOutcomeProbabilityPair)), computeEvaluationMetrics(records.map(toOutcomeProbabilityPair)));
});
