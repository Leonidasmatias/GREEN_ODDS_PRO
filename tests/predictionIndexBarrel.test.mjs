import test from "node:test";
import assert from "node:assert/strict";
import * as PredictionEngine from "../src/services/prediction/index.ts";

test("the public barrel (index.ts) re-exports the full consumer-facing API", () => {
  assert.equal(typeof PredictionEngine.predictMatchOutcome, "function");
  assert.equal(typeof PredictionEngine.buildPredictionFeatures, "function");
  assert.equal(typeof PredictionEngine.orientHeadToHead, "function");
  assert.equal(typeof PredictionEngine.evaluateDataSufficiency, "function");
  assert.equal(typeof PredictionEngine.computeOutcomeProbabilities, "function");
  assert.equal(typeof PredictionEngine.validatePredictionModelConfig, "function");
  assert.equal(typeof PredictionEngine.PredictionConfigurationError, "function");
  assert.equal(PredictionEngine.PREDICTION_MODEL_VERSION, "esoccer-outcome-v1.0.0-provisional");
  assert.equal(typeof PredictionEngine.DEFAULT_PREDICTION_MODEL_CONFIG, "object");
  assert.equal(typeof PredictionEngine.DEFAULT_PREDICTION_MODEL_WEIGHTS, "object");
  assert.equal(typeof PredictionEngine.DEFAULT_DATA_SUFFICIENCY_THRESHOLDS, "object");
});

test("predictMatchOutcome imported from the barrel behaves identically to the direct module import", async () => {
  const { predictMatchOutcome: direct } = await import("../src/services/prediction/MatchOutcomeProbabilityEngine.ts");
  const request = {
    homePlayer: { playerId: "home", matchesCount: 0, rating: null, form: null, homeAway: null, momentum: null, strength: null, confidence: null, greenScore: null },
    awayPlayer: { playerId: "away", matchesCount: 0, rating: null, form: null, homeAway: null, momentum: null, strength: null, confidence: null, greenScore: null },
    headToHead: null,
  };
  const fixedNow = () => new Date("2026-07-26T00:00:00.000Z");
  assert.deepEqual(
    PredictionEngine.predictMatchOutcome(request, PredictionEngine.DEFAULT_PREDICTION_MODEL_CONFIG, fixedNow),
    direct(request, PredictionEngine.DEFAULT_PREDICTION_MODEL_CONFIG, fixedNow),
  );
});
