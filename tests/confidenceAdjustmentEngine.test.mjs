import test from "node:test";
import assert from "node:assert/strict";
import { buildConfidenceAdjustments } from "../src/services/prediction-adaptation/ConfidenceAdjustmentEngine.ts";
import { DEFAULT_PREDICTION_ADAPTATION_CONFIG } from "../src/services/prediction-adaptation/PredictionAdaptationConfig.ts";

function recommendation(dimension, key, type) {
  return { dimension, key, type, reason: "x", triggeredBySignalIds: [] };
}

const CONFIG = DEFAULT_PREDICTION_ADAPTATION_CONFIG;

test("maps each RecommendationType to its configured multiplier", () => {
  const types = ["REDUCE_CONFIDENCE", "INCREASE_MONITORING", "TEMPORARILY_DISABLE_PROFILE", "PROFILE_STABLE", "PROFILE_IMPROVING", "NEEDS_MORE_DATA"];
  const recommendations = types.map((type) => recommendation("PLAYER", "alice", type));
  const adjustments = buildConfidenceAdjustments(recommendations, CONFIG);
  for (let i = 0; i < types.length; i += 1) {
    assert.equal(adjustments[i].suggestedMultiplier, CONFIG.confidenceMultipliers[types[i]]);
    assert.equal(adjustments[i].recommendationType, types[i]);
  }
});

test("preserves dimension/key from the source recommendation", () => {
  const recommendations = [recommendation("LEAGUE", "league-a", "PROFILE_STABLE")];
  const adjustments = buildConfidenceAdjustments(recommendations, CONFIG);
  assert.equal(adjustments[0].dimension, "LEAGUE");
  assert.equal(adjustments[0].key, "league-a");
});

test("a custom config multiplier is respected, not hardcoded", () => {
  const customConfig = { ...CONFIG, confidenceMultipliers: { ...CONFIG.confidenceMultipliers, PROFILE_STABLE: 0.42 } };
  const adjustments = buildConfidenceAdjustments([recommendation("PLAYER", "alice", "PROFILE_STABLE")], customConfig);
  assert.equal(adjustments[0].suggestedMultiplier, 0.42);
});

test("produces exactly one adjustment per recommendation, in the same order", () => {
  const recommendations = [recommendation("GLOBAL", "GLOBAL", "PROFILE_STABLE"), recommendation("PLAYER", "alice", "REDUCE_CONFIDENCE")];
  const adjustments = buildConfidenceAdjustments(recommendations, CONFIG);
  assert.equal(adjustments.length, 2);
  assert.deepEqual(adjustments.map((a) => `${a.dimension}:${a.key}`), ["GLOBAL:GLOBAL", "PLAYER:alice"]);
});

test("does not mutate the input recommendations", () => {
  const recommendations = [recommendation("PLAYER", "alice", "PROFILE_STABLE")];
  const snapshot = JSON.parse(JSON.stringify(recommendations));
  buildConfidenceAdjustments(recommendations, CONFIG);
  assert.deepEqual(recommendations, snapshot);
});

test("is deterministic for identical input", () => {
  const recommendations = [recommendation("PLAYER", "alice", "REDUCE_CONFIDENCE")];
  assert.deepEqual(buildConfidenceAdjustments(recommendations, CONFIG), buildConfidenceAdjustments(recommendations, CONFIG));
});

test("handles an empty recommendations array", () => {
  assert.deepEqual(buildConfidenceAdjustments([], CONFIG), []);
});

test("never alters actual prediction probabilities: output contains no probability-shaped fields", () => {
  const adjustments = buildConfidenceAdjustments([recommendation("PLAYER", "alice", "REDUCE_CONFIDENCE")], CONFIG);
  assert.ok(!("probabilities" in adjustments[0]));
  assert.ok(!("homeWin" in adjustments[0]));
});
