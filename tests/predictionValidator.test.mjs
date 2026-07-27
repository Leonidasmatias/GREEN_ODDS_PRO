import test from "node:test";
import assert from "node:assert/strict";
import { validatePredictionQualityRecords } from "../src/services/prediction-quality/PredictionValidator.ts";

function validRecord(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function withResultOverride(overrides) {
  const record = validRecord();
  return { ...record, result: { ...record.result, ...overrides } };
}

test("a fully valid record passes with no issues", () => {
  const { valid, invalid } = validatePredictionQualityRecords([validRecord()]);
  assert.equal(valid.length, 1);
  assert.equal(invalid.length, 0);
});

test("an empty list produces no valid or invalid entries", () => {
  const { valid, invalid } = validatePredictionQualityRecords([]);
  assert.equal(valid.length, 0);
  assert.equal(invalid.length, 0);
});

test("rejects a missing or empty matchId", () => {
  const { invalid } = validatePredictionQualityRecords([validRecord({ matchId: "" })]);
  assert.equal(invalid[0].reason, "missing_or_empty_matchId");
});

test("rejects a missing or empty homePlayerId/awayPlayerId", () => {
  assert.equal(validatePredictionQualityRecords([validRecord({ homePlayerId: "" })]).invalid[0].reason, "missing_or_empty_homePlayerId");
  assert.equal(validatePredictionQualityRecords([validRecord({ awayPlayerId: "" })]).invalid[0].reason, "missing_or_empty_awayPlayerId");
});

test("rejects an invalid actualOutcome", () => {
  const { invalid } = validatePredictionQualityRecords([validRecord({ actualOutcome: "SOMETHING_ELSE" })]);
  assert.equal(invalid[0].reason, "invalid_actualOutcome");
});

test("rejects a NaN, negative, or out-of-range probability", () => {
  const nanCase = { ...validRecord(), result: { ...validRecord().result, prediction: { ...validRecord().result.prediction, probabilities: { homeWin: Number.NaN, draw: 0.25, awayWin: 0.15 } } } };
  assert.equal(validatePredictionQualityRecords([nanCase]).invalid[0].reason, "invalid_probability_homeWin");

  const negativeCase = { ...validRecord(), result: { ...validRecord().result, prediction: { ...validRecord().result.prediction, probabilities: { homeWin: -0.1, draw: 0.9, awayWin: 0.2 } } } };
  assert.equal(validatePredictionQualityRecords([negativeCase]).invalid[0].reason, "invalid_probability_homeWin");
});

test("rejects probabilities that do not sum to 1", () => {
  const record = { ...validRecord(), result: { ...validRecord().result, prediction: { ...validRecord().result.prediction, probabilities: { homeWin: 0.5, draw: 0.5, awayWin: 0.5 } } } };
  assert.equal(validatePredictionQualityRecords([record]).invalid[0].reason, "probabilities_do_not_sum_to_one");
});

test("accepts probabilities within the floating-point sum tolerance", () => {
  const record = { ...validRecord(), result: { ...validRecord().result, prediction: { ...validRecord().result.prediction, probabilities: { homeWin: 0.1, draw: 0.2, awayWin: 0.7000001 } } } };
  const { valid, invalid } = validatePredictionQualityRecords([record]);
  assert.equal(invalid.length, 0);
  assert.equal(valid.length, 1);
});

test("rejects an invalid predictedOutcome", () => {
  const record = { ...validRecord(), result: { ...validRecord().result, prediction: { ...validRecord().result.prediction, predictedOutcome: "NOT_A_REAL_OUTCOME" } } };
  assert.equal(validatePredictionQualityRecords([record]).invalid[0].reason, "invalid_predictedOutcome");
});

test("rejects an invalid topProbability", () => {
  const record = { ...validRecord(), result: { ...validRecord().result, prediction: { ...validRecord().result.prediction, topProbability: 1.5 } } };
  assert.equal(validatePredictionQualityRecords([record]).invalid[0].reason, "invalid_topProbability");
});

test("rejects a confidence outside [0, 100]", () => {
  assert.equal(validatePredictionQualityRecords([withResultOverride({ confidence: -1 })]).invalid[0].reason, "invalid_confidence");
  assert.equal(validatePredictionQualityRecords([withResultOverride({ confidence: 101 })]).invalid[0].reason, "invalid_confidence");
  assert.equal(validatePredictionQualityRecords([withResultOverride({ confidence: Number.NaN })]).invalid[0].reason, "invalid_confidence");
});

test("rejects an invalid greenScore.score", () => {
  const record = { ...validRecord(), result: { ...validRecord().result, greenScore: { score: 150, category: "HIGH" } } };
  assert.equal(validatePredictionQualityRecords([record]).invalid[0].reason, "invalid_greenScore_score");
});

test("rejects an invalid greenScore.category", () => {
  const record = { ...validRecord(), result: { ...validRecord().result, greenScore: { score: 60, category: "SUPER_HIGH" } } };
  assert.equal(validatePredictionQualityRecords([record]).invalid[0].reason, "invalid_greenScore_category");
});

test("valid and invalid records are correctly separated in a mixed batch", () => {
  const records = [validRecord({ matchId: "good1" }), validRecord({ matchId: "", ...{} }), validRecord({ matchId: "good2" })];
  const { valid, invalid } = validatePredictionQualityRecords(records);
  assert.equal(valid.length, 2);
  assert.equal(invalid.length, 1);
});

test("never throws for a malformed record", () => {
  assert.doesNotThrow(() => validatePredictionQualityRecords([validRecord({ actualOutcome: null })]));
});

test("is deterministic for identical input", () => {
  const records = [validRecord(), validRecord({ matchId: "" })];
  assert.deepEqual(validatePredictionQualityRecords(records), validatePredictionQualityRecords(records));
});
