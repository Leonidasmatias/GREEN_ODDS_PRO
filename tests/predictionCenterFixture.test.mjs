import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PREDICTION_CENTER_FIXTURE, buildPredictionCenterFixture } from "../src/data/predictionCenter.fixture.ts";

const FIXTURE_SOURCE_PATH = fileURLToPath(new URL("../src/data/predictionCenter.fixture.ts", import.meta.url));

test("the fixture is a non-empty array of PredictionSnapshot", () => {
  assert.ok(Array.isArray(PREDICTION_CENTER_FIXTURE));
  assert.ok(PREDICTION_CENTER_FIXTURE.length > 0);
});

test("every snapshot carries full match identity (matchId, players, virtual teams, league, period, sequenceKey)", () => {
  for (const snapshot of PREDICTION_CENTER_FIXTURE) {
    assert.equal(typeof snapshot.matchId, "string");
    assert.ok(snapshot.matchId.length > 0);
    assert.equal(typeof snapshot.homePlayerId, "string");
    assert.equal(typeof snapshot.awayPlayerId, "string");
    assert.equal(typeof snapshot.virtualTeamHome, "string");
    assert.equal(typeof snapshot.virtualTeamAway, "string");
    assert.equal(typeof snapshot.league, "string");
    assert.equal(typeof snapshot.period, "string");
    assert.equal(typeof snapshot.sequenceKey, "number");
  }
});

test("matchId is unique across every snapshot in the fixture", () => {
  const ids = PREDICTION_CENTER_FIXTURE.map((snapshot) => snapshot.matchId);
  assert.equal(new Set(ids).size, ids.length);
});

test("every snapshot's result is a real PredictionResult produced by predictMatch (not hand-assembled)", () => {
  for (const snapshot of PREDICTION_CENTER_FIXTURE) {
    const { result } = snapshot;
    assert.equal(typeof result.confidence, "number");
    assert.ok(result.confidence >= 0 && result.confidence <= 100);
    assert.ok(result.greenScore.score >= 0 && result.greenScore.score <= 100);
    assert.ok(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"].includes(result.greenScore.category));
    assert.equal(typeof result.metadata.orchestratorModelVersion, "string");
    assert.equal(typeof result.metadata.generatedAt, "string");
    assert.ok(Array.isArray(result.warnings));
    assert.ok(Array.isArray(result.explanation.topSignals));
    assert.equal(typeof result.explanation.totalSignalsConsidered, "number");
  }
});

test("outcome probabilities always sum to 1 (real engine output, never fabricated)", () => {
  for (const { result } of PREDICTION_CENTER_FIXTURE) {
    const { homeWin, draw, awayWin } = result.prediction.probabilities;
    assert.ok(Math.abs(homeWin + draw + awayWin - 1) <= 1e-9);
  }
});

test("every snapshot's goalDistribution includes the essential markets: Over 1.5, Over 2.5, and BTTS", () => {
  for (const { result } of PREDICTION_CENTER_FIXTURE) {
    const over15 = result.goalDistribution.overUnder.find((entry) => entry.line === 1.5);
    const over25 = result.goalDistribution.overUnder.find((entry) => entry.line === 2.5);
    assert.ok(over15, "expected an Over/Under entry for line 1.5");
    assert.ok(over25, "expected an Over/Under entry for line 2.5");
    assert.ok(over15.over >= 0 && over15.over <= 1);
    assert.ok(over25.over >= 0 && over25.over <= 1);
    assert.ok(result.goalDistribution.bothTeamsToScore.yes >= 0 && result.goalDistribution.bothTeamsToScore.yes <= 1);
    assert.ok(Number.isFinite(result.goalDistribution.mostLikelyScore.homeGoals));
    assert.ok(Number.isFinite(result.goalDistribution.mostLikelyScore.awayGoals));
  }
});

test("quality/consistency are present and structurally valid for every snapshot", () => {
  for (const { result } of PREDICTION_CENTER_FIXTURE) {
    assert.ok(["INSUFFICIENT", "LIMITED", "SUFFICIENT", "STRONG"].includes(result.quality.combinedStatus));
    assert.ok(["ALIGNED", "MINOR_DIVERGENCE", "MAJOR_DIVERGENCE"].includes(result.quality.consistency.level));
    assert.equal(typeof result.quality.consistency.matchingWinner, "boolean");
  }
});

test("a home-favorite matchup (much higher home rating) predicts HOME_WIN, driven entirely by the real engine", () => {
  const homeFavorite = PREDICTION_CENTER_FIXTURE.find((snapshot) => snapshot.matchId === "prediction-center-fixture-1");
  assert.equal(homeFavorite.result.prediction.predictedOutcome, "HOME_WIN");
});

test("an away-favorite matchup (much higher away rating) predicts AWAY_WIN, driven entirely by the real engine", () => {
  const awayFavorite = PREDICTION_CENTER_FIXTURE.find((snapshot) => snapshot.matchId === "prediction-center-fixture-3");
  assert.equal(awayFavorite.result.prediction.predictedOutcome, "AWAY_WIN");
});

test("buildPredictionCenterFixture is deeply deterministic across two independent executions of the real chain", () => {
  const first = buildPredictionCenterFixture();
  const second = buildPredictionCenterFixture();
  assert.notEqual(first, second, "must be two distinct computations, not the same reference");
  assert.deepEqual(first, second);
});

test("the precomputed export matches a fresh independent computation", () => {
  const fresh = buildPredictionCenterFixture();
  assert.deepEqual(PREDICTION_CENTER_FIXTURE, fresh);
});

test("reading the fixture repeatedly never mutates it", () => {
  const snapshot = JSON.parse(JSON.stringify(PREDICTION_CENTER_FIXTURE));
  void PREDICTION_CENTER_FIXTURE.map((item) => item.result.greenScore.score);
  void [...PREDICTION_CENTER_FIXTURE];
  assert.deepEqual(PREDICTION_CENTER_FIXTURE, snapshot);
});

/** Remove comentários de linha (`//...`) antes de inspecionar código —
 * evita falso positivo ao encontrar os próprios nomes proibidos citados
 * na documentação em português do arquivo (ex.: "nenhum import de
 * greenScoreEngine"), que não é um import real. */
function stripLineComments(source) {
  return source
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("the fixture source never imports the legacy pipeline (greenScoreEngine, GreenScoreOpportunity, ValueOpportunity, ESoccerPrediction, ESoccerRecommendation)", () => {
  const code = stripLineComments(readFileSync(FIXTURE_SOURCE_PATH, "utf8"));
  const forbidden = ["greenScoreEngine", "GreenScoreOpportunity", "ValueOpportunity", "ESoccerPrediction", "ESoccerRecommendation", "mlTypes", "discoveryTypes", "bankrollTypes", "riskTypes"];
  for (const term of forbidden) {
    assert.ok(!code.includes(term), `fixture code must not reference legacy identifier "${term}"`);
  }
});

test("the fixture source never reads Date.now() or Math.random() in actual code", () => {
  const code = stripLineComments(readFileSync(FIXTURE_SOURCE_PATH, "utf8"));
  assert.ok(!code.includes("Date.now()"));
  assert.ok(!code.includes("Math.random()"));
});
