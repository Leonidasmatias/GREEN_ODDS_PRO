import test from "node:test";
import assert from "node:assert/strict";

function classifyGreenScore(score) {
  if (score >= 90) return "ELITE_GREEN";
  if (score >= 80) return "STRONG_GREEN";
  if (score >= 70) return "GREEN";
  if (score >= 60) return "WATCHLIST";
  return "AVOID";
}

function qualifiesOddsOfDay({ greenScore, confidence, risk }) {
  return greenScore >= 80 && confidence >= 80 && risk === "LOW";
}

test("green score classification thresholds match Phase 26", () => {
  assert.equal(classifyGreenScore(90), "ELITE_GREEN");
  assert.equal(classifyGreenScore(89), "STRONG_GREEN");
  assert.equal(classifyGreenScore(80), "STRONG_GREEN");
  assert.equal(classifyGreenScore(79), "GREEN");
  assert.equal(classifyGreenScore(70), "GREEN");
  assert.equal(classifyGreenScore(69), "WATCHLIST");
  assert.equal(classifyGreenScore(60), "WATCHLIST");
  assert.equal(classifyGreenScore(59), "AVOID");
});

test("odds of day requires score, confidence, and low risk", () => {
  assert.equal(qualifiesOddsOfDay({ greenScore: 80, confidence: 80, risk: "LOW" }), true);
  assert.equal(qualifiesOddsOfDay({ greenScore: 79, confidence: 80, risk: "LOW" }), false);
  assert.equal(qualifiesOddsOfDay({ greenScore: 80, confidence: 79, risk: "LOW" }), false);
  assert.equal(qualifiesOddsOfDay({ greenScore: 80, confidence: 80, risk: "MEDIUM" }), false);
});
