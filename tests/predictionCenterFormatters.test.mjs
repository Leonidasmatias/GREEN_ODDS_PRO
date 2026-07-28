import test from "node:test";
import assert from "node:assert/strict";
import {
  NOT_AVAILABLE,
  formatConsistencyLevel,
  formatDataSufficiencyStatus,
  formatGoals,
  formatGreenScoreCategory,
  formatMarketCode,
  formatMatchOutcome,
  formatPredictionRiskLevel,
  formatPredictionRiskReason,
  formatPredictionSignalFavors,
  formatPredictionSignalSource,
  formatPredictionSignalType,
  formatProbability,
  formatReportDate,
  formatScore,
  formatSignalMagnitude,
} from "../src/lib/predictionCenterFormatters.ts";

test("formatProbability formats a 0-1 fraction as a percentage (multiplies by 100)", () => {
  assert.equal(formatProbability(0.715), "71.5%");
  assert.equal(formatProbability(0), "0.0%");
  assert.equal(formatProbability(1), "100.0%");
});

test("formatProbability returns NOT_AVAILABLE for null or NaN, never 0", () => {
  assert.equal(formatProbability(null), NOT_AVAILABLE);
  assert.equal(formatProbability(Number.NaN), NOT_AVAILABLE);
});

test("formatScore formats an already 0-100 value as a percentage (never multiplies)", () => {
  assert.equal(formatScore(71.5), "71.5%");
  assert.equal(formatScore(0), "0.0%");
  assert.equal(formatScore(100), "100.0%");
});

test("formatScore returns NOT_AVAILABLE for null, never 0", () => {
  assert.equal(formatScore(null), NOT_AVAILABLE);
});

test("formatGoals formats a valid count and returns NOT_AVAILABLE for null", () => {
  assert.equal(formatGoals(2), "2");
  assert.equal(formatGoals(0), "0");
  assert.equal(formatGoals(null), NOT_AVAILABLE);
});

test("formatReportDate returns NOT_AVAILABLE for null/undefined, never fabricates a date", () => {
  assert.equal(formatReportDate(null), NOT_AVAILABLE);
  assert.equal(formatReportDate(undefined), NOT_AVAILABLE);
});

test("formatReportDate formats a valid ISO date deterministically", () => {
  const formatted = formatReportDate("2026-07-27T12:00:00.000Z");
  assert.ok(formatted.includes("2026"));
  assert.ok(formatted.includes("BRT"));
});

test("formatMatchOutcome covers every MatchOutcome value", () => {
  for (const outcome of ["HOME_WIN", "DRAW", "AWAY_WIN"]) {
    assert.ok(formatMatchOutcome(outcome).length > 0);
  }
});

test("formatMarketCode covers every MarketCode value", () => {
  for (const code of ["HOME_WIN", "DRAW", "AWAY_WIN", "OVER_1_5", "OVER_2_5", "BTTS"]) {
    assert.ok(formatMarketCode(code).length > 0);
  }
});

test("formatGreenScoreCategory covers every GreenScoreCategory value", () => {
  for (const category of ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]) {
    assert.ok(formatGreenScoreCategory(category).length > 0);
  }
});

test("formatDataSufficiencyStatus covers every DataSufficiencyStatus value", () => {
  for (const status of ["INSUFFICIENT", "LIMITED", "SUFFICIENT", "STRONG"]) {
    assert.ok(formatDataSufficiencyStatus(status).length > 0);
  }
});

test("formatConsistencyLevel covers every ConsistencyLevel value", () => {
  for (const level of ["ALIGNED", "MINOR_DIVERGENCE", "MAJOR_DIVERGENCE"]) {
    assert.ok(formatConsistencyLevel(level).length > 0);
  }
});

test("formatPredictionRiskLevel covers every PredictionRiskLevel value", () => {
  for (const level of ["LOW", "MEDIUM", "HIGH", "ELEVATED"]) {
    assert.ok(formatPredictionRiskLevel(level).length > 0);
  }
});

test("formatPredictionRiskReason covers every PredictionRiskReasonCode value", () => {
  for (const code of ["LIMITED_DATA_SUFFICIENCY", "INSUFFICIENT_DATA_SUFFICIENCY", "MINOR_ENGINE_DIVERGENCE", "MAJOR_ENGINE_DIVERGENCE", "ENGINE_WARNINGS_PRESENT"]) {
    assert.ok(formatPredictionRiskReason(code).length > 0);
  }
});

test("formatPredictionSignalType covers every PredictionSignalType value", () => {
  const types = [
    "RATING_ADVANTAGE",
    "FORM_ADVANTAGE",
    "STRENGTH_ADVANTAGE",
    "MOMENTUM_ADVANTAGE",
    "HOME_FIELD_ADVANTAGE",
    "HEAD_TO_HEAD_ADVANTAGE",
    "GREEN_SCORE_ADVANTAGE",
    "GOAL_EXPECTATION_ADVANTAGE",
    "HIGH_SCORING_TREND",
    "LOW_SCORING_TREND",
  ];
  for (const type of types) {
    assert.ok(formatPredictionSignalType(type).length > 0);
  }
});

test("formatPredictionSignalFavors covers every PredictionSignalFavors value", () => {
  for (const favors of ["HOME", "AWAY", "NEUTRAL"]) {
    assert.ok(formatPredictionSignalFavors(favors).length > 0);
  }
});

test("formatPredictionSignalSource covers every PredictionSignalSource value", () => {
  for (const source of ["PREDICTION_ENGINE", "GOAL_DISTRIBUTION_ENGINE"]) {
    assert.ok(formatPredictionSignalSource(source).length > 0);
  }
});

test("formatSignalMagnitude reuses formatProbability (same 0-1 scale)", () => {
  assert.equal(formatSignalMagnitude(0.5), formatProbability(0.5));
  assert.equal(formatSignalMagnitude(0.5), "50.0%");
});
