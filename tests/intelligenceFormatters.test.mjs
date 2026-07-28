import test from "node:test";
import assert from "node:assert/strict";
import {
  NOT_AVAILABLE,
  formatAlertLevel,
  formatAlertType,
  formatCount,
  formatDimension,
  formatDriftSignalType,
  formatMonitoringStatus,
  formatMultiplier,
  formatPercentageScore,
  formatProfileLabel,
  formatRecommendation,
  formatReportDate,
  formatRisk,
  formatStrategyStatus,
  formatTimelineEventType,
  formatTrend,
} from "../src/lib/intelligenceFormatters.ts";

test("formatPercentageScore formats a valid number with the % suffix", () => {
  assert.equal(formatPercentageScore(71.5), "71.5%");
  assert.equal(formatPercentageScore(0), "0.0%");
  assert.equal(formatPercentageScore(100), "100.0%");
});

test("formatPercentageScore returns NOT_AVAILABLE for null or NaN, never 0", () => {
  assert.equal(formatPercentageScore(null), NOT_AVAILABLE);
  assert.equal(formatPercentageScore(Number.NaN), NOT_AVAILABLE);
});

test("formatMultiplier formats a valid number with the x suffix", () => {
  assert.equal(formatMultiplier(0.8), "0.80x");
  assert.equal(formatMultiplier(1), "1.00x");
});

test("formatMultiplier returns NOT_AVAILABLE for null, never 0", () => {
  assert.equal(formatMultiplier(null), NOT_AVAILABLE);
});

test("formatCount formats a valid number and returns NOT_AVAILABLE for null", () => {
  assert.equal(formatCount(1234), "1.234");
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(null), NOT_AVAILABLE);
});

test("formatReportDate returns NOT_AVAILABLE for null/undefined, never fabricates a date", () => {
  assert.equal(formatReportDate(null), NOT_AVAILABLE);
  assert.equal(formatReportDate(undefined), NOT_AVAILABLE);
});

test("formatReportDate formats a valid ISO date deterministically (never Date.now())", () => {
  const formatted = formatReportDate("2026-07-27T12:00:00.000Z");
  assert.ok(formatted.includes("2026"));
  assert.ok(formatted.includes("BRT"));
});

test("formatDimension covers every ProfileDimension value used by the backend", () => {
  const dimensions = ["GLOBAL", "PLAYER", "LEAGUE", "VIRTUAL_TEAM", "HOME_AWAY", "PERIOD", "PREDICTED_OUTCOME", "GREEN_SCORE", "CONFIDENCE_BUCKET"];
  for (const dimension of dimensions) {
    const label = formatDimension(dimension);
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0);
  }
});

test("formatMonitoringStatus covers every MonitoringStatus value", () => {
  for (const status of ["STABLE", "WARNING", "CRITICAL", "IMPROVING", "DISABLED", "NEW"]) {
    assert.ok(formatMonitoringStatus(status).length > 0);
  }
});

test("formatStrategyStatus returns a label and description for every StrategyStatus value", () => {
  for (const status of ["NORMAL", "WATCH", "WARNING", "CRITICAL"]) {
    const { label, description } = formatStrategyStatus(status);
    assert.ok(label.length > 0);
    assert.ok(description.length > 0);
  }
});

test("formatRecommendation covers every RecommendationType value", () => {
  for (const type of ["REDUCE_CONFIDENCE", "INCREASE_MONITORING", "TEMPORARILY_DISABLE_PROFILE", "PROFILE_STABLE", "PROFILE_IMPROVING", "NEEDS_MORE_DATA"]) {
    assert.ok(formatRecommendation(type).length > 0);
  }
});

test("formatRisk covers every RiskLevel value", () => {
  for (const level of ["LOW", "MEDIUM", "HIGH", "CRITICAL"]) {
    assert.ok(formatRisk(level).length > 0);
  }
});

test("formatAlertLevel/formatAlertType cover every AlertLevel/AlertType value", () => {
  for (const level of ["INFO", "WARNING", "CRITICAL"]) assert.ok(formatAlertLevel(level).length > 0);
  for (const type of ["DRIFT_CRITICAL", "LOW_RELIABILITY", "PROFILE_DISABLED", "HIGH_RISK", "IMPROVING_PROFILE", "NEW_PROFILE", "SAMPLE_TOO_SMALL"]) {
    assert.ok(formatAlertType(type).length > 0);
  }
});

test("formatTrend never uses future-prediction language (says 'observado', not 'previsão')", () => {
  for (const trend of ["INCREASING_STABILITY", "DECREASING_STABILITY", "CONTINUOUS_DRIFT", "RECOVERY", "DETERIORATION", "NEWLY_CREATED_PROFILE"]) {
    const { label, description } = formatTrend(trend);
    assert.ok(label.length > 0);
    assert.ok(!description.toLowerCase().includes("previsão futura"));
  }
});

test("formatTimelineEventType covers every TimelineEventType value", () => {
  for (const type of ["STRATEGY_CHANGE", "RISK_CHANGE", "RELIABILITY_CHANGE", "RECOMMENDATION_CHANGE", "DRIFT_CHANGE"]) {
    assert.ok(formatTimelineEventType(type).length > 0);
  }
});

test("formatDriftSignalType covers every DriftSignalType value", () => {
  for (const type of ["PERFORMANCE_DEGRADATION", "PERFORMANCE_IMPROVEMENT", "CALIBRATION_DEGRADATION", "CONFIDENCE_SHIFT", "SAMPLE_INSUFFICIENT", "PROFILE_DISAPPEARED", "PROFILE_EMERGED"]) {
    assert.ok(formatDriftSignalType(type).length > 0);
  }
});

test("formatProfileLabel returns 'Global' when dimension/key are null", () => {
  assert.equal(formatProfileLabel(null, null), "Global");
});

test("formatProfileLabel combines dimension label and key when both are provided", () => {
  assert.equal(formatProfileLabel("PLAYER", "alice"), "Jogador · alice");
});
