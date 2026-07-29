// Sprint 9.0 — Prediction Intelligence Framework.
import test from "node:test";
import assert from "node:assert/strict";
import {
  formatConfidenceBreakdownCategory,
  formatPredictionFactorCode,
  formatPredictionFactorDirection,
  formatPredictionQualityGrade,
  formatPredictionRiskCode,
  formatPredictionRiskSeverity,
} from "../src/lib/predictionExplanationFormatters.ts";

test("formatPredictionFactorCode: covers all 7 factor codes", () => {
  const codes = ["RECENT_FORM", "TEAM_STRENGTH", "GOALS_AVERAGE", "HOME_AWAY_PERFORMANCE", "HEAD_TO_HEAD", "SAMPLE_CONSISTENCY", "DATA_CONFIDENCE"];
  for (const code of codes) assert.ok(formatPredictionFactorCode(code).length > 0);
});

test("formatConfidenceBreakdownCategory: covers all 6 categories", () => {
  const categories = ["RECENT_FORM", "GOALS_TREND", "HOME_ADVANTAGE", "HEAD_TO_HEAD", "SAMPLE_SIZE", "DATA_QUALITY"];
  for (const category of categories) assert.ok(formatConfidenceBreakdownCategory(category).length > 0);
});

test("formatPredictionRiskCode: covers all 6 risk codes", () => {
  const codes = ["LOW_SAMPLE_SIZE", "STALE_DATA", "INDICATOR_CONFLICT", "INSUFFICIENT_CONFIDENCE", "HIGH_VOLATILITY", "NO_HEAD_TO_HEAD_HISTORY"];
  for (const code of codes) assert.ok(formatPredictionRiskCode(code).length > 0);
});

test("formatPredictionRiskSeverity: covers LOW/MEDIUM/HIGH", () => {
  assert.equal(formatPredictionRiskSeverity("LOW"), "Baixa");
  assert.equal(formatPredictionRiskSeverity("MEDIUM"), "Média");
  assert.equal(formatPredictionRiskSeverity("HIGH"), "Alta");
});

test("formatPredictionQualityGrade: covers all 6 grades and never alters the domain value's meaning", () => {
  assert.equal(formatPredictionQualityGrade("A_PLUS"), "A+");
  assert.equal(formatPredictionQualityGrade("A"), "A");
  assert.equal(formatPredictionQualityGrade("B_PLUS"), "B+");
  assert.equal(formatPredictionQualityGrade("B"), "B");
  assert.equal(formatPredictionQualityGrade("C"), "C");
  assert.equal(formatPredictionQualityGrade("D"), "D");
});

test("formatPredictionFactorDirection: covers HOME/AWAY/NEUTRAL", () => {
  assert.equal(formatPredictionFactorDirection("HOME"), "Favorece o mandante");
  assert.equal(formatPredictionFactorDirection("AWAY"), "Favorece o visitante");
  assert.equal(formatPredictionFactorDirection("NEUTRAL"), "Neutro");
});
