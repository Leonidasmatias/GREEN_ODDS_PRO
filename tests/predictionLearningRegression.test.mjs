import test from "node:test";
import assert from "node:assert/strict";
import { predictMatch } from "../src/services/prediction-orchestrator/index.ts";
import { buildEvaluationReport } from "../src/services/prediction-evaluation/index.ts";
import { DEFAULT_PREDICTION_EVALUATION_CONFIG } from "../src/services/prediction-evaluation/PredictionEvaluationConfig.ts";
import { buildLearningReport, toLearningHistoricalRecord } from "../src/services/prediction-learning/index.ts";
import { DEFAULT_PREDICTION_LEARNING_CONFIG } from "../src/services/prediction-learning/PredictionLearningConfig.ts";

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

function buildRealHistoricalPredictionRecords(size) {
  const predictions = [];
  const actuals = [];
  const learningRecords = [];
  for (let i = 0; i < size; i += 1) {
    const homeStronger = i % 3 !== 0;
    const homePlayer = player(`home-${i}`, homeStronger ? 1700 : 1400);
    const awayPlayer = player(`away-${i}`, homeStronger ? 1400 : 1700);
    const result = predictMatch({ homePlayer, awayPlayer, headToHead: null }, undefined, FIXED_NOW);
    const actualOutcome = i % 5 === 0 ? "DRAW" : result.prediction.predictedOutcome;

    const snapshot = {
      matchId: `m${i}`,
      homePlayerId: homePlayer.playerId,
      awayPlayerId: awayPlayer.playerId,
      virtualTeamHome: i % 2 === 0 ? "Bologna" : "Juventus",
      virtualTeamAway: i % 2 === 0 ? "Roma" : "Napoli",
      league: i % 2 === 0 ? "league-a" : "league-b",
      period: i < size / 2 ? "2026-06" : "2026-07",
      sequenceKey: i,
      result,
    };
    const actual = { matchId: `m${i}`, outcome: actualOutcome, homeGoals: 2, awayGoals: 1 };
    predictions.push(snapshot);
    actuals.push(actual);
    learningRecords.push(toLearningHistoricalRecord({ snapshot, actual }));
  }
  return { predictions, actuals, learningRecords };
}

const LEARNING_CONFIG = { ...DEFAULT_PREDICTION_LEARNING_CONFIG, minimumRecordsPerProfile: 1, minimumRecordsPerWindow: 1, minimumRecordsForDrift: 1 };
const EVALUATION_CONFIG = { ...DEFAULT_PREDICTION_EVALUATION_CONFIG, minRecordsForEvaluation: 1 };

test("integrates end-to-end with real predictMatch() outputs (Sprint 4.3) via toLearningHistoricalRecord, without altering their shape or values", () => {
  const { learningRecords } = buildRealHistoricalPredictionRecords(20);
  const report = buildLearningReport(
    { datasetId: "regression-1", records: learningRecords },
    LEARNING_CONFIG,
    { reportId: "r1", baselineWindow: { label: "b", fromSequenceKey: 0, toSequenceKey: 9 }, currentWindow: { label: "c", fromSequenceKey: 10, toSequenceKey: 19 } },
  );
  assert.equal(report.status, "OK");
  assert.equal(report.datasetSummary.totalRecords, 20);
});

test("GLOBAL profile metrics are numerically consistent with the equivalent EvaluationReport (Sprint 4.5) globalMetrics on the same dataset", () => {
  const { predictions, actuals, learningRecords } = buildRealHistoricalPredictionRecords(15);

  const evaluationReport = buildEvaluationReport(
    { datasetId: "eval-ds", predictions, actuals },
    { ...EVALUATION_CONFIG, decimalPlaces: 12 },
    { reportId: "eval-r1" },
  );

  const learningConfig = { ...LEARNING_CONFIG, decimalPlaces: 12 };
  const learningReport = buildLearningReport(
    { datasetId: "learning-ds", records: learningRecords },
    learningConfig,
    { reportId: "learning-r1", baselineWindow: { label: "b", fromSequenceKey: 0, toSequenceKey: 7 }, currentWindow: { label: "c", fromSequenceKey: 8, toSequenceKey: 14 } },
  );

  const globalProfile = learningReport.historicalProfiles.find((p) => p.dimension === "GLOBAL");
  assert.ok(Math.abs(globalProfile.metrics.accuracy - evaluationReport.globalMetrics.accuracy) < 1e-9);
  assert.ok(Math.abs(globalProfile.metrics.brierScore - evaluationReport.globalMetrics.brierScore) < 1e-9);
  assert.ok(Math.abs(globalProfile.metrics.logLoss - evaluationReport.globalMetrics.logLoss) < 1e-9);
});

test("does not mutate any predictMatch() result or HistoricalPredictionRecord passed through toLearningHistoricalRecord", () => {
  const { learningRecords } = buildRealHistoricalPredictionRecords(10);
  const snapshotCopy = JSON.parse(JSON.stringify(learningRecords));
  buildLearningReport(
    { datasetId: "regression-3", records: learningRecords },
    LEARNING_CONFIG,
    { reportId: "r1", baselineWindow: { label: "b", fromSequenceKey: 0, toSequenceKey: 4 }, currentWindow: { label: "c", fromSequenceKey: 5, toSequenceKey: 9 } },
  );
  assert.deepEqual(learningRecords, snapshotCopy);
});

test("produces a fully deterministic report across two separate calls against real predictMatch() output", () => {
  const { learningRecords } = buildRealHistoricalPredictionRecords(12);
  const dataset = { datasetId: "regression-4", records: learningRecords };
  const options = { reportId: "r1", generatedAt: "2026-07-27T00:00:00.000Z", baselineWindow: { label: "b", fromSequenceKey: 0, toSequenceKey: 5 }, currentWindow: { label: "c", fromSequenceKey: 6, toSequenceKey: 11 } };
  const first = buildLearningReport(dataset, LEARNING_CONFIG, options);
  const second = buildLearningReport(dataset, LEARNING_CONFIG, options);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("regression: prior sprints' public barrels remain importable and functional alongside prediction-learning", () => {
  const { predictions, actuals } = buildRealHistoricalPredictionRecords(5);
  assert.doesNotThrow(() => buildEvaluationReport({ datasetId: "regression-5", predictions, actuals }, EVALUATION_CONFIG, { reportId: "r1" }));
});

test("never introduces betting/financial vocabulary anywhere in a real report's serialized output", () => {
  const { learningRecords } = buildRealHistoricalPredictionRecords(10);
  const report = buildLearningReport(
    { datasetId: "regression-6", records: learningRecords },
    LEARNING_CONFIG,
    { reportId: "r1", baselineWindow: { label: "b", fromSequenceKey: 0, toSequenceKey: 4 }, currentWindow: { label: "c", fromSequenceKey: 5, toSequenceKey: 9 } },
  );
  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of ["odds", "stake", "kelly", "expectedvalue", "roi", "bookmaker", "wager"]) {
    assert.ok(!serialized.includes(forbidden), `unexpected forbidden term: ${forbidden}`);
  }
});
