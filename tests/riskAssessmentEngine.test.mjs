import test from "node:test";
import assert from "node:assert/strict";
import { buildRiskAssessments } from "../src/services/prediction-adaptation/RiskAssessmentEngine.ts";
import { DEFAULT_PREDICTION_ADAPTATION_CONFIG } from "../src/services/prediction-adaptation/PredictionAdaptationConfig.ts";

function recommendation(dimension, key, type) {
  return { dimension, key, type, reason: "x", triggeredBySignalIds: [] };
}

function ranking(entries) {
  return { entries, profileCount: entries.length };
}

function rankingEntry(dimension, key, reliabilityScore) {
  return { rank: 1, dimension, key, reliabilityScore, sampleSize: 20, status: "OK", metricContributions: [], warnings: [] };
}

const CONFIG = DEFAULT_PREDICTION_ADAPTATION_CONFIG;

test("maps each RecommendationType to its configured base risk level when reliability is above the floor", () => {
  const cases = [
    ["PROFILE_STABLE", "LOW"],
    ["PROFILE_IMPROVING", "LOW"],
    ["NEEDS_MORE_DATA", "MEDIUM"],
    ["INCREASE_MONITORING", "MEDIUM"],
    ["REDUCE_CONFIDENCE", "HIGH"],
    ["TEMPORARILY_DISABLE_PROFILE", "CRITICAL"],
  ];
  const recommendations = cases.map(([type]) => recommendation("PLAYER", "alice", type));
  const rankingData = ranking([rankingEntry("PLAYER", "alice", 90)]);
  const assessments = buildRiskAssessments(recommendations, rankingData, CONFIG);
  for (let i = 0; i < cases.length; i += 1) {
    assert.equal(assessments[i].level, cases[i][1]);
  }
});

test("escalates LOW to MEDIUM when reliabilityScore is below riskReliabilityFloor", () => {
  const rankingData = ranking([rankingEntry("PLAYER", "alice", 10)]);
  const assessments = buildRiskAssessments([recommendation("PLAYER", "alice", "PROFILE_STABLE")], rankingData, CONFIG);
  assert.equal(assessments[0].level, "MEDIUM");
});

test("escalates HIGH to CRITICAL when reliabilityScore is below riskReliabilityFloor", () => {
  const rankingData = ranking([rankingEntry("PLAYER", "alice", 10)]);
  const assessments = buildRiskAssessments([recommendation("PLAYER", "alice", "REDUCE_CONFIDENCE")], rankingData, CONFIG);
  assert.equal(assessments[0].level, "CRITICAL");
});

test("never escalates beyond CRITICAL", () => {
  const rankingData = ranking([rankingEntry("PLAYER", "alice", 0)]);
  const assessments = buildRiskAssessments([recommendation("PLAYER", "alice", "TEMPORARILY_DISABLE_PROFILE")], rankingData, CONFIG);
  assert.equal(assessments[0].level, "CRITICAL");
});

test("reliabilityScore is null (not escalated, not fabricated as 0) when no ranking entry matches", () => {
  const assessments = buildRiskAssessments([recommendation("PLAYER", "ghost", "PROFILE_STABLE")], ranking([]), CONFIG);
  assert.equal(assessments[0].reliabilityScore, null);
  assert.equal(assessments[0].level, "LOW");
});

test("does not escalate when reliabilityScore is exactly at the floor (only strictly below escalates)", () => {
  const rankingData = ranking([rankingEntry("PLAYER", "alice", CONFIG.riskReliabilityFloor)]);
  const assessments = buildRiskAssessments([recommendation("PLAYER", "alice", "PROFILE_STABLE")], rankingData, CONFIG);
  assert.equal(assessments[0].level, "LOW");
});

test("produces exactly one assessment per recommendation, in the same order", () => {
  const recommendations = [recommendation("GLOBAL", "GLOBAL", "PROFILE_STABLE"), recommendation("PLAYER", "alice", "REDUCE_CONFIDENCE")];
  const assessments = buildRiskAssessments(recommendations, ranking([]), CONFIG);
  assert.equal(assessments.length, 2);
  assert.deepEqual(assessments.map((a) => `${a.dimension}:${a.key}`), ["GLOBAL:GLOBAL", "PLAYER:alice"]);
});

test("does not mutate the input recommendations/reliabilityRanking", () => {
  const recommendations = [recommendation("PLAYER", "alice", "PROFILE_STABLE")];
  const rankingData = ranking([rankingEntry("PLAYER", "alice", 90)]);
  const recSnapshot = JSON.parse(JSON.stringify(recommendations));
  const rankingSnapshot = JSON.parse(JSON.stringify(rankingData));
  buildRiskAssessments(recommendations, rankingData, CONFIG);
  assert.deepEqual(recommendations, recSnapshot);
  assert.deepEqual(rankingData, rankingSnapshot);
});

test("is deterministic for identical input", () => {
  const recommendations = [recommendation("PLAYER", "alice", "REDUCE_CONFIDENCE")];
  const rankingData = ranking([rankingEntry("PLAYER", "alice", 90)]);
  assert.deepEqual(buildRiskAssessments(recommendations, rankingData, CONFIG), buildRiskAssessments(recommendations, rankingData, CONFIG));
});

test("handles an empty recommendations array", () => {
  assert.deepEqual(buildRiskAssessments([], ranking([]), CONFIG), []);
});
