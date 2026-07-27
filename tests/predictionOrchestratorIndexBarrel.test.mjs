import test from "node:test";
import assert from "node:assert/strict";
import * as PredictionOrchestrator from "../src/services/prediction-orchestrator/index.ts";

test("the public barrel (index.ts) re-exports only the public API — predictMatch, config, and types", () => {
  assert.equal(typeof PredictionOrchestrator.predictMatch, "function");
  assert.equal(typeof PredictionOrchestrator.computeConfigurationHash, "function");
  assert.equal(typeof PredictionOrchestrator.validatePredictionOrchestratorConfig, "function");
  assert.equal(typeof PredictionOrchestrator.PredictionOrchestratorConfigurationError, "function");
  assert.equal(PredictionOrchestrator.PREDICTION_ORCHESTRATOR_MODEL_VERSION, "esoccer-orchestrator-v1.0.0-provisional");
  assert.equal(typeof PredictionOrchestrator.DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, "object");
  assert.equal(typeof PredictionOrchestrator.DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES, "object");
  assert.equal(typeof PredictionOrchestrator.DEFAULT_CONSISTENCY_THRESHOLDS, "object");
  assert.equal(typeof PredictionOrchestrator.DEFAULT_CONSISTENCY_ADJUSTMENTS, "object");
  assert.equal(typeof PredictionOrchestrator.DEFAULT_CONFIDENCE_WEIGHTS, "object");
  assert.equal(typeof PredictionOrchestrator.DEFAULT_GREEN_SCORE_WEIGHTS, "object");
  assert.equal(typeof PredictionOrchestrator.DEFAULT_GREEN_SCORE_THRESHOLDS, "object");
  assert.equal(typeof PredictionOrchestrator.DEFAULT_EXPLANATION_CONFIG, "object");
});

test("internal engines (Aggregator, Confidence, Green Score, Consistency, Explanation) are NOT exported from the barrel", () => {
  assert.equal("aggregate" in PredictionOrchestrator, false);
  assert.equal("computeConfidenceScore" in PredictionOrchestrator, false);
  assert.equal("computeGreenScore" in PredictionOrchestrator, false);
  assert.equal("classifyGreenScore" in PredictionOrchestrator, false);
  assert.equal("evaluateConsistency" in PredictionOrchestrator, false);
  assert.equal("buildPredictionExplanation" in PredictionOrchestrator, false);
});

test("predictMatch imported from the barrel behaves identically to the direct module import", async () => {
  const { predictMatch: direct } = await import("../src/services/prediction-orchestrator/PredictionOrchestrator.ts");
  const request = {
    homePlayer: { playerId: "home", matchesCount: 0, rating: null, form: null, homeAway: null, momentum: null, strength: null, confidence: null, greenScore: null, goalsRates: null },
    awayPlayer: { playerId: "away", matchesCount: 0, rating: null, form: null, homeAway: null, momentum: null, strength: null, confidence: null, greenScore: null, goalsRates: null },
    headToHead: null,
  };
  const fixedNow = () => new Date("2026-07-27T00:00:00.000Z");
  assert.deepEqual(
    PredictionOrchestrator.predictMatch(request, PredictionOrchestrator.DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, fixedNow),
    direct(request, PredictionOrchestrator.DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, fixedNow),
  );
});
