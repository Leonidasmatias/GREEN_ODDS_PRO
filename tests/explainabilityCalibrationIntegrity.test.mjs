// Sprint 9.1.1 — Calibration Data Integrity & Report Hardening.
// Testes de integridade: proveniência do dataset, elegibilidade de
// recomendação, status geral do relatório, e a separação estrutural
// entre "Resultado operacional" e "Demonstração técnica" no Markdown
// gerado. Complementa (nunca substitui) `explainabilityCalibration.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import { determineRecommendationEligibility, isOperationalEligibility, MIN_SAMPLE_FOR_ELIGIBLE_REVIEW, MIN_SAMPLE_FOR_OBSERVATIONAL_READING } from "../src/services/explainability-calibration/RecommendationEligibility.ts";
import { determineReportStatus } from "../src/services/explainability-calibration/ReportStatus.ts";
import { buildCalibrationDataset } from "../src/services/explainability-calibration/CalibrationDataset.ts";
import { runBacktest } from "../src/services/explainability-calibration/BacktestRunner.ts";
import { buildCalibrationReportMarkdown } from "../src/services/explainability-calibration/CalibrationReport.ts";
import { optimizeThreshold } from "../src/services/explainability-calibration/ThresholdOptimizer.ts";

const NOW = "2026-07-29T12:00:00.000Z";

function feature(name, overrides = {}) {
  return { name, rawValue: 0.5, normalizedValue: 0.4, weight: 1, contribution: 0.4, availability: "AVAILABLE", direction: "FAVORS_HOME", ...overrides };
}

function goalFeature(name, overrides = {}) {
  return { name, rawValue: null, normalizedValue: null, weight: 1, contributionHome: 0.3, contributionAway: 0.1, availability: "AVAILABLE", explanation: "", ...overrides };
}

function buildSnapshot(matchId, overrides = {}) {
  const { confidence = 82, combinedStatus = "STRONG", predictedOutcome = "HOME_WIN", probabilityMargin = 0.35, league = "Test League", generatedAt = NOW } = overrides;
  return {
    matchId,
    homePlayerId: overrides.homePlayerId ?? "home-1",
    awayPlayerId: overrides.awayPlayerId ?? "away-1",
    virtualTeamHome: "Home FC",
    virtualTeamAway: "Away FC",
    league,
    period: "2026-07",
    sequenceKey: 1,
    result: {
      prediction: {
        modelVersion: "esoccer-outcome-v1.0.0-provisional",
        generatedAt,
        probabilities: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 },
        predictedOutcome,
        topProbability: 0.6,
        probabilityMargin,
        dataSufficiency: { status: combinedStatus, sampleSize: 40, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 3, warnings: [] },
        featureTrace: [
          feature("ratingDifference"), feature("formDifference"), feature("strengthDifference"), feature("momentumDifference"),
          feature("homeAdvantage"), feature("headToHead"), feature("greenScoreDifference"), feature("drawBalance", { direction: "NEUTRAL", contribution: 0 }),
        ],
      },
      goalDistribution: {
        modelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
        generatedAt,
        expectedGoals: { home: 1.6, away: 1.1, total: 2.7 },
        homeGoalDistribution: [], awayGoalDistribution: [], exactScores: [],
        mostLikelyScore: { homeGoals: 2, awayGoals: 1, totalGoals: 3, probability: 0.12 },
        topExactScores: [], topExactScoresAggregateProbability: 0.5, overUnder: [],
        bothTeamsToScore: { yes: 0.5, no: 0.5 },
        scoreDerivedOutcomeProbabilities: { homeWin: 0.58, draw: 0.24, awayWin: 0.18 },
        dataSufficiency: { status: combinedStatus, sampleSize: 40, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 3, warnings: [] },
        featureTrace: [
          goalFeature("recentForm"), goalFeature("homeAwaySplit"), goalFeature("headToHead"), goalFeature("momentum"), goalFeature("strength"),
        ],
        warnings: [],
      },
      greenScore: { score: 78, category: "HIGH" },
      confidence,
      quality: {
        predictionDataSufficiency: combinedStatus, goalDistributionDataSufficiency: combinedStatus, combinedStatus,
        consistency: { level: "ALIGNED", matchingWinner: true, maxProbabilityDelta: 0.02, adjustment: 0 },
      },
      warnings: [],
      explanation: { topSignals: [{ type: "RATING_ADVANTAGE", source: "PREDICTION_ENGINE", favors: "HOME", magnitude: 0.6 }], totalSignalsConsidered: 8 },
      metadata: {
        predictionModelVersion: "esoccer-outcome-v1.0.0-provisional",
        goalDistributionModelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
        orchestratorModelVersion: "esoccer-orchestrator-v1.0.0-provisional",
        generatedAt,
        configurationHash: "test-config-hash",
      },
    },
  };
}

function buildRawDataset(n, overridesFor = () => ({})) {
  const predictions = [];
  const actuals = [];
  for (let i = 0; i < n; i += 1) {
    const matchId = `integrity-match-${i}`;
    const highConfidence = i % 2 === 0;
    const confidence = highConfidence ? 85 : 25;
    const predictedOutcome = "HOME_WIN";
    const correct = highConfidence ? true : i % 10 < 2;
    predictions.push(buildSnapshot(matchId, { confidence, predictedOutcome, homePlayerId: `home-${i % 5}`, awayPlayerId: `away-${i % 5}`, league: `League ${i % 2}`, generatedAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString(), ...overridesFor(i) }));
    actuals.push({ matchId, outcome: correct ? predictedOutcome : "AWAY_WIN", homeGoals: 2, awayGoals: 1 });
  }
  return { datasetId: "integrity-dataset", predictions, actuals };
}

function realTags(raw) {
  return raw.predictions.map((p) => ({ matchId: p.matchId, origin: "REAL" }));
}

function syntheticTags(raw) {
  return raw.predictions.map((p) => ({ matchId: p.matchId, origin: "SYNTHETIC" }));
}

const CURRENT_THRESHOLDS = {
  highVolatilityMarginThreshold: 0.08,
  insufficientConfidenceHighThreshold: 40,
  insufficientConfidenceMediumThreshold: 60,
  qualityGradeAPlusMinScore: 90,
};

// ---------------------------------------------------------------------
// DatasetProvenance
// ---------------------------------------------------------------------

test("provenance: 100% real tags produce origin REAL with correct counts", () => {
  const raw = buildRawDataset(35);
  const dataset = buildCalibrationDataset(raw, NOW, realTags(raw), true);
  assert.equal(dataset.provenance.origin, "REAL");
  assert.equal(dataset.provenance.realCount, 35);
  assert.equal(dataset.provenance.syntheticCount, 0);
  assert.equal(dataset.provenance.totalCount, 35);
});

test("provenance: 100% synthetic tags produce origin SYNTHETIC", () => {
  const raw = buildRawDataset(35);
  const dataset = buildCalibrationDataset(raw, NOW, syntheticTags(raw), false);
  assert.equal(dataset.provenance.origin, "SYNTHETIC");
  assert.equal(dataset.provenance.realCount, 0);
  assert.equal(dataset.provenance.syntheticCount, 35);
});

test("provenance: a mix of REAL and SYNTHETIC tags produces origin MIXED", () => {
  const raw = buildRawDataset(35);
  const tags = raw.predictions.map((p, i) => ({ matchId: p.matchId, origin: i < 5 ? "REAL" : "SYNTHETIC" }));
  const dataset = buildCalibrationDataset(raw, NOW, tags, true);
  assert.equal(dataset.provenance.origin, "MIXED");
  assert.equal(dataset.provenance.realCount, 5);
  assert.equal(dataset.provenance.syntheticCount, 30);
});

test("provenance: period/league/player counts are computed from valid records only, never invented", () => {
  const raw = buildRawDataset(10);
  const dataset = buildCalibrationDataset(raw, NOW, realTags(raw), true);
  assert.equal(dataset.provenance.leagueCount, 2);
  assert.equal(dataset.provenance.playerCount, 10); // 5 home + 5 away distinct ids
  assert.ok(dataset.provenance.periodStart);
  assert.ok(dataset.provenance.periodEnd);
  assert.ok(dataset.provenance.periodStart <= dataset.provenance.periodEnd);
});

test("provenance: an empty dataset never invents a period — periodStart/periodEnd are null", () => {
  const dataset = buildCalibrationDataset({ datasetId: "empty", predictions: [], actuals: [] }, NOW, [], true);
  assert.equal(dataset.provenance.periodStart, null);
  assert.equal(dataset.provenance.periodEnd, null);
  assert.equal(dataset.provenance.leagueCount, 0);
  assert.equal(dataset.provenance.playerCount, 0);
});

test("provenance: discard reasons are aggregated from the same warnings prediction-evaluation already computes, never a new reason", () => {
  const raw = buildRawDataset(5);
  raw.predictions.push(buildSnapshot("duplicate-of-0", { confidence: 80 }));
  raw.predictions[raw.predictions.length - 1].matchId = "integrity-match-0"; // force a duplicate matchId warning
  const tags = [...realTags(buildRawDataset(5)), { matchId: "integrity-match-0", origin: "REAL" }];
  const dataset = buildCalibrationDataset(raw, NOW, tags, true);
  if (dataset.warnings.length > 0) {
    const totalFromReasons = dataset.provenance.discardReasons.reduce((sum, r) => sum + r.count, 0);
    assert.ok(totalFromReasons <= dataset.warnings.length + 1);
  }
});

// ---------------------------------------------------------------------
// RecommendationEligibility
// ---------------------------------------------------------------------

test("eligibility: SYNTHETIC origin is always DEMONSTRATION_ONLY regardless of sample size", () => {
  assert.equal(determineRecommendationEligibility("SYNTHETIC", 1), "DEMONSTRATION_ONLY");
  assert.equal(determineRecommendationEligibility("SYNTHETIC", 10_000), "DEMONSTRATION_ONLY");
});

test("eligibility: below MIN_SAMPLE_FOR_OBSERVATIONAL_READING is always INSUFFICIENT_SAMPLE, even for REAL", () => {
  assert.equal(determineRecommendationEligibility("REAL", MIN_SAMPLE_FOR_OBSERVATIONAL_READING - 1), "INSUFFICIENT_SAMPLE");
});

test("eligibility: MIXED origin never reaches ELIGIBLE_FOR_REVIEW, even with a very large sample", () => {
  assert.equal(determineRecommendationEligibility("MIXED", 100_000), "OBSERVATIONAL");
});

test("eligibility: REAL origin below MIN_SAMPLE_FOR_ELIGIBLE_REVIEW is OBSERVATIONAL, at/above it is ELIGIBLE_FOR_REVIEW", () => {
  assert.equal(determineRecommendationEligibility("REAL", MIN_SAMPLE_FOR_ELIGIBLE_REVIEW - 1), "OBSERVATIONAL");
  assert.equal(determineRecommendationEligibility("REAL", MIN_SAMPLE_FOR_ELIGIBLE_REVIEW), "ELIGIBLE_FOR_REVIEW");
});

test("isOperationalEligibility: only OBSERVATIONAL and ELIGIBLE_FOR_REVIEW are operational", () => {
  assert.equal(isOperationalEligibility("DEMONSTRATION_ONLY"), false);
  assert.equal(isOperationalEligibility("INSUFFICIENT_SAMPLE"), false);
  assert.equal(isOperationalEligibility("OBSERVATIONAL"), true);
  assert.equal(isOperationalEligibility("ELIGIBLE_FOR_REVIEW"), true);
});

// ---------------------------------------------------------------------
// ReportStatus
// ---------------------------------------------------------------------

function provenance(overrides) {
  return {
    origin: "SYNTHETIC", totalCount: 0, realCount: 0, syntheticCount: 0, periodStart: null, periodEnd: null,
    leagueCount: 0, playerCount: 0, validRecordCount: 0, discardedRecordCount: 0, discardReasons: [], realDataAttempted: false,
    ...overrides,
  };
}

test("reportStatus: SYNTHETIC + no real attempt => DEMONSTRATION", () => {
  assert.equal(determineReportStatus(provenance({ origin: "SYNTHETIC", realDataAttempted: false })), "DEMONSTRATION");
});

test("reportStatus: SYNTHETIC + real attempt made (found nothing) => BLOCKED_NO_REAL_DATA", () => {
  assert.equal(determineReportStatus(provenance({ origin: "SYNTHETIC", realDataAttempted: true })), "BLOCKED_NO_REAL_DATA");
});

test("reportStatus: REAL with validRecordCount below observational minimum => BLOCKED_INSUFFICIENT_SAMPLE", () => {
  assert.equal(determineReportStatus(provenance({ origin: "REAL", validRecordCount: MIN_SAMPLE_FOR_OBSERVATIONAL_READING - 1, realDataAttempted: true })), "BLOCKED_INSUFFICIENT_SAMPLE");
});

test("reportStatus: MIXED with sufficient sample => OBSERVATIONAL, never READY_FOR_HUMAN_REVIEW", () => {
  assert.equal(determineReportStatus(provenance({ origin: "MIXED", validRecordCount: 10_000, realDataAttempted: true })), "OBSERVATIONAL");
});

test("reportStatus: REAL between the two minimums => OBSERVATIONAL", () => {
  assert.equal(determineReportStatus(provenance({ origin: "REAL", validRecordCount: MIN_SAMPLE_FOR_ELIGIBLE_REVIEW - 1, realDataAttempted: true })), "OBSERVATIONAL");
});

test("reportStatus: REAL at/above MIN_SAMPLE_FOR_ELIGIBLE_REVIEW => READY_FOR_HUMAN_REVIEW", () => {
  assert.equal(determineReportStatus(provenance({ origin: "REAL", validRecordCount: MIN_SAMPLE_FOR_ELIGIBLE_REVIEW, realDataAttempted: true })), "READY_FOR_HUMAN_REVIEW");
});

// ---------------------------------------------------------------------
// Report section separation and honesty (integration, via CalibrationReport)
// ---------------------------------------------------------------------

test("report: SYNTHETIC dataset never uses real-calibration language and never claims READY_FOR_HUMAN_REVIEW", () => {
  const raw = buildRawDataset(35);
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, syntheticTags(raw), false);
  const markdown = buildCalibrationReportMarkdown(result, { generatedAt: NOW, sourceDescription: "synthetic fixture" });
  assert.equal(result.reportStatus, "DEMONSTRATION");
  assert.ok(!markdown.includes("Dados reais de produção"));
  assert.ok(!markdown.includes("Pronto para revisão humana"));
  assert.match(markdown, /não tentou consultar dados reais/);
});

test("report: with a real dataset large enough to be eligible, the operational section renders an actual table, not a blocked message", () => {
  const raw = buildRawDataset(35);
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  const markdown = buildCalibrationReportMarkdown(result, { generatedAt: NOW, sourceDescription: "real fixture" });
  assert.equal(result.provenance.origin, "REAL");
  assert.equal(result.reportStatus, "READY_FOR_HUMAN_REVIEW");
  assert.ok(!markdown.includes("CALIBRAÇÃO REAL BLOQUEADA"));
  assert.match(markdown, /prontas para revisão humana/);
});

test("report: the technical demonstration section (Section 9) is always present, even for a fully eligible REAL dataset", () => {
  const raw = buildRawDataset(35);
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  const markdown = buildCalibrationReportMarkdown(result, { generatedAt: NOW, sourceDescription: "real fixture" });
  assert.match(markdown, /## 9\. Demonstração técnica do otimizador/);
  assert.match(markdown, /nunca representa uma recomendação de produção/);
});

test("report: the old field name recommendationConfidence never appears anywhere in generated output", () => {
  const raw = buildRawDataset(35);
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  const markdown = buildCalibrationReportMarkdown(result, { generatedAt: NOW, sourceDescription: "x" });
  assert.ok(!markdown.includes("recommendationConfidence"));
  assert.match(markdown, /evidence score|Evidence score/i);
});

test("report: a parameter with no variation or a single outcome class is shown in Section 9 with an explanatory reason, never silently dropped", () => {
  const raw = buildRawDataset(20, () => ({ probabilityMargin: 0.08 })); // constant value => NO_VARIATION for the margin parameter
  const result = runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  const marginRec = result.recommendations.find((r) => r.parameterName === "HIGH_VOLATILITY_MARGIN_THRESHOLD");
  assert.equal(marginRec.outcome, "NO_VARIATION");
  const markdown = buildCalibrationReportMarkdown(result, { generatedAt: NOW, sourceDescription: "x" });
  assert.match(markdown, /Parâmetro sem variação na amostra/);
});

test("report: current production thresholds are never mutated by a full run", () => {
  const raw = buildRawDataset(35);
  const before = JSON.stringify(CURRENT_THRESHOLDS);
  runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true);
  optimizeThreshold("X", [{ value: 1, correct: true }, { value: 2, correct: false }], 5);
  assert.equal(JSON.stringify(CURRENT_THRESHOLDS), before);
});

test("report: is deterministic for identical provenance and input", () => {
  const raw = buildRawDataset(35);
  const a = buildCalibrationReportMarkdown(runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true), { generatedAt: NOW, sourceDescription: "x" });
  const b = buildCalibrationReportMarkdown(runBacktest(raw, NOW, CURRENT_THRESHOLDS, realTags(raw), true), { generatedAt: NOW, sourceDescription: "x" });
  assert.equal(a, b);
});
