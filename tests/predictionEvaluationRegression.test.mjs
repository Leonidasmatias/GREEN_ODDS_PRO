import test from "node:test";
import assert from "node:assert/strict";
import { predictMatch } from "../src/services/prediction-orchestrator/index.ts";
import { buildEvaluationReport, toPredictionQualityRecord } from "../src/services/prediction-evaluation/index.ts";
import { DEFAULT_PREDICTION_EVALUATION_CONFIG } from "../src/services/prediction-evaluation/PredictionEvaluationConfig.ts";
import { computeAccuracyMetrics, computeBrierScore, computeLogLoss } from "../src/services/prediction-quality/index.ts";

const FIXED_NOW = () => new Date("2026-07-27T00:00:00.000Z");

function player(id, ratingValue) {
  return {
    playerId: id,
    matchesCount: 20,
    rating: { playerId: id, rating: ratingValue, matchesCount: 20 },
    form: null,
    homeAway: null,
    momentum: null,
    strength: null,
    confidence: null,
    greenScore: null,
    goalsRates: null,
  };
}

function buildRealDataset(size) {
  const predictions = [];
  const actuals = [];
  for (let i = 0; i < size; i += 1) {
    const homeStronger = i % 3 !== 0;
    const homePlayer = player(`home-${i}`, homeStronger ? 1700 : 1400);
    const awayPlayer = player(`away-${i}`, homeStronger ? 1400 : 1700);
    const result = predictMatch({ homePlayer, awayPlayer, headToHead: null }, undefined, FIXED_NOW);
    predictions.push({
      matchId: `m${i}`,
      homePlayerId: homePlayer.playerId,
      awayPlayerId: awayPlayer.playerId,
      virtualTeamHome: null,
      virtualTeamAway: null,
      league: i % 2 === 0 ? "league-a" : "league-b",
      period: "2026-07",
      sequenceKey: i,
      result,
    });
    const actualOutcome = i % 5 === 0 ? "DRAW" : result.prediction.predictedOutcome;
    actuals.push({ matchId: `m${i}`, outcome: actualOutcome, homeGoals: 2, awayGoals: 1 });
  }
  return { datasetId: "regression-dataset", predictions, actuals };
}

const CONFIG = { ...DEFAULT_PREDICTION_EVALUATION_CONFIG, minRecordsForEvaluation: 1 };

test("integrates end-to-end with real predictMatch() outputs (Sprint 4.3) without altering their shape or values", () => {
  const dataset = buildRealDataset(20);
  const report = buildEvaluationReport(dataset, CONFIG, { reportId: "regression-1" });
  assert.equal(report.status, "OK");
  assert.equal(report.datasetSummary.matchedRecords, 20);
  assert.ok(Number.isFinite(report.globalMetrics.accuracy));
});

test("global accuracy/brierScore/logLoss are numerically consistent with directly computing them via Sprint 4.4's own engines on the same joined records", () => {
  const dataset = buildRealDataset(15);
  // decimalPlaces raised to avoid the report's serialization-layer rounding masking the comparison — rounding itself is covered separately.
  const config = { ...CONFIG, decimalPlaces: 12 };
  const report = buildEvaluationReport(dataset, config, { reportId: "regression-2", generatedAt: null });

  const actualsByMatchId = new Map(dataset.actuals.map((a) => [a.matchId, a]));
  const qualityRecords = dataset.predictions.map((snapshot) =>
    toPredictionQualityRecord({ snapshot, actual: actualsByMatchId.get(snapshot.matchId) }),
  );

  const directAccuracy = computeAccuracyMetrics(qualityRecords);
  const directBrier = computeBrierScore(qualityRecords);
  const directLogLoss = computeLogLoss(qualityRecords);

  assert.ok(Math.abs(report.globalMetrics.accuracy - directAccuracy.accuracy) < 1e-9);
  assert.ok(Math.abs(report.globalMetrics.brierScore - directBrier) < 1e-9);
  assert.ok(Math.abs(report.globalMetrics.logLoss - directLogLoss) < 1e-9);
});

test("does not mutate any predictMatch() result object passed into the dataset", () => {
  const dataset = buildRealDataset(5);
  const snapshotCopy = JSON.parse(JSON.stringify(dataset));
  buildEvaluationReport(dataset, CONFIG, { reportId: "regression-3" });
  assert.deepEqual(dataset, snapshotCopy);
});

test("produces a fully deterministic report across two separate calls against real predictMatch() output", () => {
  const dataset = buildRealDataset(10);
  const options = { reportId: "regression-4", generatedAt: "2026-07-27T00:00:00.000Z" };
  const first = buildEvaluationReport(dataset, CONFIG, options);
  const second = buildEvaluationReport(dataset, CONFIG, options);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("HISTORICAL_FREQUENCY benchmark integrates correctly with real, sequenceKey-tagged predictMatch() data", () => {
  const dataset = buildRealDataset(12);
  const report = buildEvaluationReport(dataset, CONFIG, {
    reportId: "regression-5",
    benchmarks: [{ type: "HISTORICAL_FREQUENCY", constantProbabilities: null }],
  });
  assert.equal(report.benchmarks[0].definition.type, "HISTORICAL_FREQUENCY");
  assert.equal(report.benchmarks[0].status, "OK");
});

test("never introduces betting/financial vocabulary anywhere in a real report's serialized output", () => {
  const dataset = buildRealDataset(5);
  const report = buildEvaluationReport(dataset, CONFIG, { reportId: "regression-6" });
  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of ["odds", "stake", "kelly", "expectedvalue", "roi", "bookmaker", "wager"]) {
    assert.ok(!serialized.includes(forbidden), `unexpected forbidden term: ${forbidden}`);
  }
});
