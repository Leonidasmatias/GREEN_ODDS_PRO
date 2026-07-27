import test from "node:test";
import assert from "node:assert/strict";
import * as PredictionQuality from "../src/services/prediction-quality/index.ts";

test("the public barrel (index.ts) re-exports the full consumer-facing API", () => {
  assert.equal(typeof PredictionQuality.buildPredictionQualityReport, "function");
  assert.equal(typeof PredictionQuality.validatePredictionQualityRecords, "function");
  assert.equal(typeof PredictionQuality.computeAccuracyMetrics, "function");
  assert.equal(typeof PredictionQuality.computeBrierScore, "function");
  assert.equal(typeof PredictionQuality.computeBrierScoreReport, "function");
  assert.equal(typeof PredictionQuality.computeLogLoss, "function");
  assert.equal(typeof PredictionQuality.computeCalibrationCurve, "function");
  assert.equal(typeof PredictionQuality.computeConfidenceReliability, "function");
  assert.equal(typeof PredictionQuality.computeGreenScoreCalibration, "function");
  assert.equal(typeof PredictionQuality.validatePredictionQualityConfig, "function");
  assert.equal(typeof PredictionQuality.PredictionQualityConfigurationError, "function");
  assert.equal(PredictionQuality.PREDICTION_QUALITY_MODEL_VERSION, "esoccer-prediction-quality-v1.0.0-provisional");
  assert.equal(typeof PredictionQuality.DEFAULT_PREDICTION_QUALITY_CONFIG, "object");
  assert.equal(typeof PredictionQuality.groupRecordsByKey, "function");
  assert.equal(typeof PredictionQuality.groupRecordsByPlayer, "function");
  assert.equal(typeof PredictionQuality.aggregateGroupsToMetric, "function");
});

test("buildPredictionQualityReport imported from the barrel behaves identically to the direct module import", async () => {
  const { buildPredictionQualityReport: direct } = await import("../src/services/prediction-quality/PredictionQualityReport.ts");
  const records = [
    {
      matchId: "m1",
      homePlayerId: "home",
      awayPlayerId: "away",
      league: null,
      period: null,
      result: {
        prediction: { probabilities: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 }, predictedOutcome: "HOME_WIN", topProbability: 0.6 },
        confidence: 70,
        greenScore: { score: 60, category: "HIGH" },
      },
      actualOutcome: "HOME_WIN",
    },
  ];
  const fixedNow = () => new Date("2026-07-27T00:00:00.000Z");
  assert.deepEqual(
    PredictionQuality.buildPredictionQualityReport(records, PredictionQuality.DEFAULT_PREDICTION_QUALITY_CONFIG, fixedNow),
    direct(records, PredictionQuality.DEFAULT_PREDICTION_QUALITY_CONFIG, fixedNow),
  );
});
