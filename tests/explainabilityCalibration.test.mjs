// Sprint 9.1 — Explainability Calibration & Backtest.
// Testes puros e determinísticos para todo o módulo
// `src/services/explainability-calibration/`.
import test from "node:test";
import assert from "node:assert/strict";
import { buildCalibrationDataset } from "../src/services/explainability-calibration/CalibrationDataset.ts";
import { calibrateQualityGrades, isQualityScaleMonotonic } from "../src/services/explainability-calibration/QualityCalibration.ts";
import { calibrateRiskIndicators } from "../src/services/explainability-calibration/RiskCalibration.ts";
import { analyzeCalibration } from "../src/services/explainability-calibration/CalibrationAnalyzer.ts";
import { optimizeThreshold } from "../src/services/explainability-calibration/ThresholdOptimizer.ts";
import { runBacktest } from "../src/services/explainability-calibration/BacktestRunner.ts";
import { buildCalibrationReportMarkdown } from "../src/services/explainability-calibration/CalibrationReport.ts";
import { DEFAULT_PREDICTION_EVALUATION_CONFIG } from "../src/services/prediction-evaluation/index.ts";

const NOW = "2026-07-29T12:00:00.000Z";

function feature(name, overrides = {}) {
  return { name, rawValue: 0.5, normalizedValue: 0.4, weight: 1, contribution: 0.4, availability: "AVAILABLE", direction: "FAVORS_HOME", ...overrides };
}

function goalFeature(name, overrides = {}) {
  return { name, rawValue: null, normalizedValue: null, weight: 1, contributionHome: 0.3, contributionAway: 0.1, availability: "AVAILABLE", explanation: "", ...overrides };
}

function buildSnapshot(matchId, overrides = {}) {
  const { confidence = 82, combinedStatus = "STRONG", consistencyLevel = "ALIGNED", predictedOutcome = "HOME_WIN", probabilityMargin = 0.35, headToHeadSampleSize = 3 } = overrides;
  return {
    matchId,
    homePlayerId: "home-1",
    awayPlayerId: "away-1",
    virtualTeamHome: "Home FC",
    virtualTeamAway: "Away FC",
    league: "Test League",
    period: "2026-07",
    sequenceKey: 1,
    result: {
      prediction: {
        modelVersion: "esoccer-outcome-v1.0.0-provisional",
        generatedAt: NOW,
        probabilities: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 },
        predictedOutcome,
        topProbability: 0.6,
        probabilityMargin,
        dataSufficiency: { status: combinedStatus, sampleSize: 40, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize, warnings: [] },
        featureTrace: [
          feature("ratingDifference"), feature("formDifference"), feature("strengthDifference"), feature("momentumDifference"),
          feature("homeAdvantage"), feature("headToHead", { availability: headToHeadSampleSize > 0 ? "AVAILABLE" : "MISSING" }),
          feature("greenScoreDifference"), feature("drawBalance", { direction: "NEUTRAL", contribution: 0 }),
        ],
      },
      goalDistribution: {
        modelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
        generatedAt: NOW,
        expectedGoals: { home: 1.6, away: 1.1, total: 2.7 },
        homeGoalDistribution: [], awayGoalDistribution: [], exactScores: [],
        mostLikelyScore: { homeGoals: 2, awayGoals: 1, totalGoals: 3, probability: 0.12 },
        topExactScores: [], topExactScoresAggregateProbability: 0.5, overUnder: [],
        bothTeamsToScore: { yes: 0.5, no: 0.5 },
        scoreDerivedOutcomeProbabilities: { homeWin: 0.58, draw: 0.24, awayWin: 0.18 },
        dataSufficiency: { status: combinedStatus, sampleSize: 40, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize, warnings: [] },
        featureTrace: [
          goalFeature("recentForm"), goalFeature("homeAwaySplit"), goalFeature("headToHead", { availability: headToHeadSampleSize > 0 ? "AVAILABLE" : "MISSING" }),
          goalFeature("momentum"), goalFeature("strength"),
        ],
        warnings: [],
      },
      greenScore: { score: 78, category: "HIGH" },
      confidence,
      quality: {
        predictionDataSufficiency: combinedStatus, goalDistributionDataSufficiency: combinedStatus, combinedStatus,
        consistency: { level: consistencyLevel, matchingWinner: true, maxProbabilityDelta: 0.02, adjustment: 0 },
      },
      warnings: [],
      explanation: { topSignals: [{ type: "RATING_ADVANTAGE", source: "PREDICTION_ENGINE", favors: "HOME", magnitude: 0.6 }], totalSignalsConsidered: 8 },
      metadata: {
        predictionModelVersion: "esoccer-outcome-v1.0.0-provisional",
        goalDistributionModelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
        orchestratorModelVersion: "esoccer-orchestrator-v1.0.0-provisional",
        generatedAt: NOW,
        configurationHash: "test-config-hash",
      },
    },
  };
}

function buildDataset(n, correctRatioHighConfidence = 1) {
  const predictions = [];
  const actuals = [];
  for (let i = 0; i < n; i += 1) {
    const matchId = `calib-match-${i}`;
    const highConfidence = i % 2 === 0;
    const confidence = highConfidence ? 85 : 25;
    const predictedOutcome = "HOME_WIN";
    const correct = highConfidence ? i % 10 < correctRatioHighConfidence * 10 : i % 10 < 2;
    predictions.push(buildSnapshot(matchId, { confidence, predictedOutcome }));
    actuals.push({ matchId, outcome: correct ? predictedOutcome : "AWAY_WIN", homeGoals: 2, awayGoals: 1 });
  }
  return { datasetId: "test-dataset", predictions, actuals };
}

const CURRENT_THRESHOLDS = {
  highVolatilityMarginThreshold: 0.08,
  insufficientConfidenceHighThreshold: 40,
  insufficientConfidenceMediumThreshold: 60,
  qualityGradeAPlusMinScore: 90,
};

/** Tags de proveniência REAL para todas as previsões de um dataset bruto
 * — usado pela maioria dos testes desta suíte, que testam o pipeline
 * geral e não a lógica de proveniência em si (coberta em
 * `explainabilityCalibrationIntegrity.test.mjs`). */
function realTags(raw) {
  return raw.predictions.map((p) => ({ matchId: p.matchId, origin: "REAL" }));
}

// ---------------------------------------------------------------------
// CalibrationDataset
// ---------------------------------------------------------------------

test("buildCalibrationDataset: joins predictions+actuals (reusing prediction-evaluation) and attaches an explanation per record", () => {
  const raw = buildDataset(20);
  const dataset = buildCalibrationDataset(raw, NOW, realTags(raw), true);
  assert.equal(dataset.status, "OK");
  assert.equal(dataset.records.length, 20);
  for (const record of dataset.records) {
    assert.equal(record.explanation.factors.length, 7);
    assert.ok(Array.isArray(record.explanation.reasons));
  }
});

test("buildCalibrationDataset: never mutates the input dataset", () => {
  const raw = buildDataset(10);
  const before = JSON.stringify(raw);
  buildCalibrationDataset(raw, NOW, realTags(raw), true);
  assert.equal(JSON.stringify(raw), before);
});

test("buildCalibrationDataset: reports EMPTY status for an empty dataset (never throws)", () => {
  const dataset = buildCalibrationDataset({ datasetId: "empty", predictions: [], actuals: [] }, NOW, [], true);
  assert.equal(dataset.status, "EMPTY");
  assert.equal(dataset.records.length, 0);
});

// ---------------------------------------------------------------------
// QualityCalibration
// ---------------------------------------------------------------------

test("calibrateQualityGrades: covers all 6 grades, including zero-sample ones", () => {
  const raw = buildDataset(20);
  const dataset = buildCalibrationDataset(raw, NOW, realTags(raw), true);
  const calibration = calibrateQualityGrades(dataset.records);
  assert.deepEqual(calibration.map((c) => c.grade), ["A_PLUS", "A", "B_PLUS", "B", "C", "D"]);
  const totalSample = calibration.reduce((sum, c) => sum + c.sampleSize, 0);
  assert.equal(totalSample, 20);
});

test("isQualityScaleMonotonic: true for a perfectly monotonic synthetic scale", () => {
  // Construct calibration data directly (bypassing real dataset) for a clean monotonic check.
  const calibration = [
    { grade: "A_PLUS", sampleSize: 10, metrics: { accuracy: 0.95, validRecords: 10 } },
    { grade: "A", sampleSize: 10, metrics: { accuracy: 0.85, validRecords: 10 } },
    { grade: "B_PLUS", sampleSize: 10, metrics: { accuracy: 0.75, validRecords: 10 } },
    { grade: "B", sampleSize: 10, metrics: { accuracy: 0.65, validRecords: 10 } },
    { grade: "C", sampleSize: 10, metrics: { accuracy: 0.5, validRecords: 10 } },
    { grade: "D", sampleSize: 10, metrics: { accuracy: 0.3, validRecords: 10 } },
  ];
  assert.equal(isQualityScaleMonotonic(calibration, 5, 0.01), true);
});

test("isQualityScaleMonotonic: false when a lower grade outperforms a higher one", () => {
  const calibration = [
    { grade: "A_PLUS", sampleSize: 10, metrics: { accuracy: 0.5, validRecords: 10 } },
    { grade: "A", sampleSize: 10, metrics: { accuracy: 0.9, validRecords: 10 } },
  ];
  assert.equal(isQualityScaleMonotonic(calibration, 5, 0.01), false);
});

test("isQualityScaleMonotonic: ignores grades below the minimum sample size", () => {
  const calibration = [
    { grade: "A_PLUS", sampleSize: 1, metrics: { accuracy: 0.1, validRecords: 1 } }, // below minSample, ignored
    { grade: "A", sampleSize: 10, metrics: { accuracy: 0.9, validRecords: 10 } },
  ];
  assert.equal(isQualityScaleMonotonic(calibration, 5, 0.01), true);
});

// ---------------------------------------------------------------------
// RiskCalibration
// ---------------------------------------------------------------------

test("calibrateRiskIndicators: covers all 6 risk codes with frequency and impact", () => {
  const raw = buildDataset(20);
  const dataset = buildCalibrationDataset(raw, NOW, realTags(raw), true);
  const calibration = calibrateRiskIndicators(dataset.records);
  assert.deepEqual(
    calibration.map((c) => c.code),
    ["LOW_SAMPLE_SIZE", "STALE_DATA", "INDICATOR_CONFLICT", "INSUFFICIENT_CONFIDENCE", "HIGH_VOLATILITY", "NO_HEAD_TO_HEAD_HISTORY"],
  );
  for (const item of calibration) {
    assert.ok(item.frequency >= 0);
    assert.ok(item.frequencyRate >= 0 && item.frequencyRate <= 1);
  }
});

test("calibrateRiskIndicators: frequencyRate is 0 for an empty dataset (never NaN)", () => {
  const calibration = calibrateRiskIndicators([]);
  for (const item of calibration) assert.equal(item.frequencyRate, 0);
});

// ---------------------------------------------------------------------
// CalibrationAnalyzer
// ---------------------------------------------------------------------

test("analyzeCalibration: composes confidence/quality/risk/factor analyses", () => {
  const raw = buildDataset(20);
  const dataset = buildCalibrationDataset(raw, NOW, realTags(raw), true);
  const analysis = analyzeCalibration(dataset);
  assert.ok(Array.isArray(analysis.confidenceCalibration));
  assert.equal(analysis.qualityCalibration.length, 6);
  assert.equal(analysis.riskCalibration.length, 6);
  assert.equal(analysis.factorImportance.length, 7);
  assert.equal(typeof analysis.qualityScaleMonotonic, "boolean");
});

test("analyzeCalibration: confidence buckets reuse prediction-evaluation's CONFIDENCE_BUCKET segmentation verbatim", () => {
  const raw = buildDataset(20);
  const dataset = buildCalibrationDataset(raw, NOW, realTags(raw), true);
  const analysis = analyzeCalibration(dataset, DEFAULT_PREDICTION_EVALUATION_CONFIG);
  for (const segment of analysis.confidenceCalibration) {
    assert.equal(segment.segment.type, "CONFIDENCE_BUCKET");
  }
});

// ---------------------------------------------------------------------
// ThresholdOptimizer
// ---------------------------------------------------------------------

test("optimizeThreshold: finds a separating threshold when one clearly exists", () => {
  const samples = [
    ...Array.from({ length: 10 }, () => ({ value: 10, correct: false })),
    ...Array.from({ length: 10 }, () => ({ value: 90, correct: true })),
  ];
  const recommendation = optimizeThreshold("TEST_PARAM", samples, 50);
  assert.equal(recommendation.outcome, "RECOMMENDED");
  assert.equal(recommendation.parameterName, "TEST_PARAM");
  assert.ok(recommendation.suggestedValue >= 10 && recommendation.suggestedValue <= 90);
  assert.ok(recommendation.accuracySeparation > 0.9);
});

test("optimizeThreshold: never returns null — reports INSUFFICIENT_SAMPLE when every candidate side is too small", () => {
  const samples = [{ value: 1, correct: true }, { value: 2, correct: false }];
  const result = optimizeThreshold("TEST_PARAM", samples, 50);
  assert.ok(result);
  assert.equal(result.outcome, "INSUFFICIENT_SAMPLE");
  assert.equal(result.suggestedValue, null);
  assert.equal(result.evidenceScore, null);
});

test("optimizeThreshold: reports NO_VARIATION when the parameter has a single distinct value", () => {
  const samples = Array.from({ length: 20 }, (_, i) => ({ value: 42, correct: i % 2 === 0 }));
  const result = optimizeThreshold("TEST_PARAM", samples, 50);
  assert.equal(result.outcome, "NO_VARIATION");
  assert.equal(result.suggestedValue, null);
});

test("optimizeThreshold: reports SINGLE_OUTCOME_CLASS when every record has the same correctness", () => {
  const samples = Array.from({ length: 20 }, (_, i) => ({ value: i, correct: true }));
  const result = optimizeThreshold("TEST_PARAM", samples, 50);
  assert.equal(result.outcome, "SINGLE_OUTCOME_CLASS");
  assert.equal(result.suggestedValue, null);
});

test("optimizeThreshold: evidenceScore is always between 0 and 95 (never claims 100% certainty, never a p-value)", () => {
  const samples = Array.from({ length: 100 }, (_, i) => ({ value: i, correct: i > 50 }));
  const recommendation = optimizeThreshold("TEST_PARAM", samples, 50);
  assert.equal(recommendation.outcome, "RECOMMENDED");
  assert.ok(recommendation.evidenceScore <= 95);
  assert.ok(recommendation.evidenceScore >= 0);
});

test("optimizeThreshold: is deterministic for identical input", () => {
  const samples = Array.from({ length: 30 }, (_, i) => ({ value: i, correct: i % 3 === 0 }));
  const a = optimizeThreshold("P", samples, 10);
  const b = optimizeThreshold("P", samples, 10);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------
// BacktestRunner
// ---------------------------------------------------------------------

test("runBacktest: produces a full BacktestResult and never alters the current thresholds object", () => {
  const raw = buildDataset(20);
  const thresholdsCopy = { ...CURRENT_THRESHOLDS };
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  assert.equal(result.status, "OK");
  assert.equal(result.datasetSummary.validRecords, 20);
  assert.equal(result.recommendations.length, 4);
  assert.deepEqual(CURRENT_THRESHOLDS, thresholdsCopy);
});

test("runBacktest: recommendations always report the exact currentValue supplied by the caller (never invented)", () => {
  const raw = buildDataset(20);
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  for (const rec of result.recommendations) {
    if (rec.parameterName === "HIGH_VOLATILITY_MARGIN_THRESHOLD") assert.equal(rec.currentValue, CURRENT_THRESHOLDS.highVolatilityMarginThreshold);
  }
});

test("runBacktest: is deterministic for identical input", () => {
  const raw = buildDataset(20);
  const a = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  const b = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  assert.deepEqual(a, b);
});

test("runBacktest: with insufficient sample, status reflects that and every recommendation is still returned (never dropped)", () => {
  const raw = buildDataset(2);
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  assert.equal(result.status, "INSUFFICIENT_SAMPLE");
  assert.equal(result.recommendations.length, 4);
  assert.equal(result.reportStatus, "BLOCKED_INSUFFICIENT_SAMPLE");
});

test("runBacktest: always exposes provenance and reportStatus", () => {
  const raw = buildDataset(20);
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  assert.equal(result.provenance.origin, "REAL");
  assert.equal(typeof result.reportStatus, "string");
});

// ---------------------------------------------------------------------
// CalibrationReport (Markdown)
// ---------------------------------------------------------------------

test("buildCalibrationReportMarkdown: is deterministic and contains all 11 required sections", () => {
  const raw = buildDataset(20);
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  const options = { generatedAt: NOW, sourceDescription: "test dataset" };
  const a = buildCalibrationReportMarkdown(result, options);
  const b = buildCalibrationReportMarkdown(result, options);
  assert.equal(a, b);

  const requiredHeadings = [
    "## 1. Resumo executivo", "## 2. Dataset e proveniência", "## 3. Distribuição e avisos",
    "## 4. Confidence", "## 5. Quality", "## 6. Risk", "## 7. Factor Importance",
    "## 8. Resultado operacional", "## 9. Demonstração técnica do otimizador",
    "## 10. Conclusões", "## 11. Limitações",
  ];
  for (const heading of requiredHeadings) assert.ok(a.includes(heading), `missing section: ${heading}`);
});

test("buildCalibrationReportMarkdown: never claims a threshold was changed automatically", () => {
  const raw = buildDataset(20);
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  const markdown = buildCalibrationReportMarkdown(result, { generatedAt: NOW, sourceDescription: "test" });
  assert.match(markdown, /Nenhum threshold de produção foi alterado/);
  assert.match(markdown, /nunca representa uma recomendação de produção|nenhuma foi ou será aplicada automaticamente/);
});

test("buildCalibrationReportMarkdown: origin comes from provenance, not from a caller-supplied flag — SYNTHETIC vs REAL are labeled differently", () => {
  const raw = buildDataset(20);
  const syntheticTags = raw.predictions.map((p) => ({ matchId: p.matchId, origin: "SYNTHETIC" }));
  const syntheticResult = runBacktest(raw, NOW, CURRENT_THRESHOLDS, syntheticTags, false);
  const realResult = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  const synthetic = buildCalibrationReportMarkdown(syntheticResult, { generatedAt: NOW, sourceDescription: "x" });
  const real = buildCalibrationReportMarkdown(realResult, { generatedAt: NOW, sourceDescription: "x" });
  assert.match(synthetic, /Dataset sintético de demonstração/);
  assert.match(real, /Dados reais de produção/);
  assert.equal(syntheticResult.provenance.origin, "SYNTHETIC");
  assert.equal(realResult.provenance.origin, "REAL");
});

test("buildCalibrationReportMarkdown: never shows a misleading accuracy/impact for a zero-sample side", () => {
  // Build a dataset where GOALS_AVERAGE (always AVAILABLE) has zero "unavailable" records.
  const raw = buildDataset(20);
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  const markdown = buildCalibrationReportMarkdown(result, { generatedAt: NOW, sourceDescription: "x" });
  assert.match(markdown, /N\/A \(sem amostra/);
});

test("buildCalibrationReportMarkdown: with insufficient sample, the operational section shows the explicit blocked message instead of a table", () => {
  const raw = buildDataset(2);
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  const markdown = buildCalibrationReportMarkdown(result, { generatedAt: NOW, sourceDescription: "x" });
  assert.match(markdown, /CALIBRAÇÃO REAL BLOQUEADA — AMOSTRA HISTÓRICA INSUFICIENTE/);
});
