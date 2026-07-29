// Sprint 9.0 — Prediction Intelligence Framework.
// Testes puros dos 5 motores de explicação + composição. Nenhum acesso a
// rede/Prisma/relógio do sistema — `now` é sempre passado explicitamente.
import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionFactors } from "../src/services/prediction-explanation/PredictionFactorsEngine.ts";
import { buildConfidenceBreakdown } from "../src/services/prediction-explanation/ConfidenceBreakdownEngine.ts";
import { buildPredictionReasons } from "../src/services/prediction-explanation/PredictionReasonsEngine.ts";
import { buildRiskIndicators } from "../src/services/prediction-explanation/RiskIndicatorEngine.ts";
import { buildPredictionQualityScore } from "../src/services/prediction-explanation/QualityScoreEngine.ts";
import { buildPredictionExplanation } from "../src/services/prediction-explanation/PredictionExplanationEngine.ts";

const NOW = "2026-07-29T12:00:00.000Z";

function feature(name, overrides = {}) {
  return { name, rawValue: 0.5, normalizedValue: 0.4, weight: 1, contribution: 0.4, availability: "AVAILABLE", direction: "FAVORS_HOME", ...overrides };
}

function goalFeature(name, overrides = {}) {
  return { name, rawValue: null, normalizedValue: null, weight: 1, contributionHome: 0.3, contributionAway: 0.1, availability: "AVAILABLE", explanation: "", ...overrides };
}

function buildResult(overrides = {}) {
  const base = {
    prediction: {
      modelVersion: "esoccer-outcome-v1.0.0-provisional",
      generatedAt: NOW,
      probabilities: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 },
      predictedOutcome: "HOME_WIN",
      topProbability: 0.6,
      probabilityMargin: 0.35,
      dataSufficiency: { status: "STRONG", sampleSize: 40, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 3, warnings: [] },
      featureTrace: [
        feature("ratingDifference"),
        feature("formDifference"),
        feature("strengthDifference"),
        feature("momentumDifference"),
        feature("homeAdvantage"),
        feature("headToHead"),
        feature("greenScoreDifference"),
        feature("drawBalance", { direction: "NEUTRAL", contribution: 0 }),
      ],
    },
    goalDistribution: {
      modelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
      generatedAt: NOW,
      expectedGoals: { home: 1.6, away: 1.1, total: 2.7 },
      homeGoalDistribution: [],
      awayGoalDistribution: [],
      exactScores: [],
      mostLikelyScore: { homeGoals: 2, awayGoals: 1, totalGoals: 3, probability: 0.12 },
      topExactScores: [],
      topExactScoresAggregateProbability: 0.5,
      overUnder: [],
      bothTeamsToScore: { yes: 0.5, no: 0.5 },
      scoreDerivedOutcomeProbabilities: { homeWin: 0.58, draw: 0.24, awayWin: 0.18 },
      dataSufficiency: { status: "STRONG", sampleSize: 40, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 3, warnings: [] },
      featureTrace: [
        goalFeature("recentForm"),
        goalFeature("homeAwaySplit"),
        goalFeature("headToHead"),
        goalFeature("momentum"),
        goalFeature("strength"),
      ],
      warnings: [],
    },
    greenScore: { score: 78, category: "HIGH" },
    confidence: 82,
    quality: {
      predictionDataSufficiency: "STRONG",
      goalDistributionDataSufficiency: "STRONG",
      combinedStatus: "STRONG",
      consistency: { level: "ALIGNED", matchingWinner: true, maxProbabilityDelta: 0.02, adjustment: 8 },
    },
    warnings: [],
    explanation: {
      topSignals: [
        { type: "RATING_ADVANTAGE", source: "PREDICTION_ENGINE", favors: "HOME", magnitude: 0.6 },
        { type: "FORM_ADVANTAGE", source: "PREDICTION_ENGINE", favors: "HOME", magnitude: 0.4 },
        { type: "HIGH_SCORING_TREND", source: "GOAL_DISTRIBUTION_ENGINE", favors: "NEUTRAL", magnitude: 0.2 },
      ],
      totalSignalsConsidered: 8,
    },
    metadata: {
      predictionModelVersion: "esoccer-outcome-v1.0.0-provisional",
      goalDistributionModelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
      orchestratorModelVersion: "esoccer-orchestrator-v1.0.0-provisional",
      generatedAt: NOW,
      configurationHash: "test-config-hash",
    },
  };
  return { ...base, ...overrides };
}

function buildSnapshot(resultOverrides = {}) {
  return {
    matchId: "match-1",
    homePlayerId: "home-1",
    awayPlayerId: "away-1",
    virtualTeamHome: "Home FC",
    virtualTeamAway: "Away FC",
    league: "Test League",
    period: "2026-07",
    sequenceKey: 1,
    result: buildResult(resultOverrides),
  };
}

// ---------------------------------------------------------------------
// PredictionFactorsEngine (Etapa 1)
// ---------------------------------------------------------------------

test("buildPredictionFactors: returns exactly the 7 documented factor codes, in fixed order", () => {
  const factors = buildPredictionFactors(buildResult());
  assert.deepEqual(
    factors.map((f) => f.code),
    ["RECENT_FORM", "TEAM_STRENGTH", "GOALS_AVERAGE", "HOME_AWAY_PERFORMANCE", "HEAD_TO_HEAD", "SAMPLE_CONSISTENCY", "DATA_CONFIDENCE"],
  );
});

test("buildPredictionFactors: AVAILABLE feature yields AVAILABLE factor with magnitude/direction/weight derived from real data", () => {
  const factors = buildPredictionFactors(buildResult());
  const recentForm = factors.find((f) => f.code === "RECENT_FORM");
  assert.equal(recentForm.availability, "AVAILABLE");
  assert.equal(recentForm.direction, "HOME");
  assert.ok(recentForm.magnitude > 0 && recentForm.magnitude <= 1);
  assert.ok(recentForm.weight > 0);
});

test("buildPredictionFactors: MISSING feature (present but unavailable) never fabricates a magnitude", () => {
  const result = buildResult();
  result.prediction.featureTrace = result.prediction.featureTrace.map((f) =>
    f.name === "formDifference" ? { ...f, availability: "MISSING", normalizedValue: null, contribution: 0 } : f,
  );
  result.goalDistribution.featureTrace = result.goalDistribution.featureTrace.map((f) =>
    f.name === "recentForm" ? { ...f, availability: "MISSING" } : f,
  );
  const factors = buildPredictionFactors(result);
  const recentForm = factors.find((f) => f.code === "RECENT_FORM");
  assert.equal(recentForm.availability, "MISSING");
  assert.equal(recentForm.magnitude, null);
  assert.equal(recentForm.weight, null);
});

test("buildPredictionFactors: falls back to Goal Distribution feature when Prediction Engine feature is unavailable", () => {
  const result = buildResult();
  result.prediction.featureTrace = result.prediction.featureTrace.map((f) =>
    f.name === "formDifference" ? { ...f, availability: "MISSING", normalizedValue: null, contribution: 0 } : f,
  );
  const factors = buildPredictionFactors(result);
  const recentForm = factors.find((f) => f.code === "RECENT_FORM");
  assert.equal(recentForm.availability, "AVAILABLE");
});

test("buildPredictionFactors: GOALS_AVERAGE is always AVAILABLE, NEUTRAL direction, derived from expectedGoals.total", () => {
  const factors = buildPredictionFactors(buildResult());
  const goalsAverage = factors.find((f) => f.code === "GOALS_AVERAGE");
  assert.equal(goalsAverage.availability, "AVAILABLE");
  assert.equal(goalsAverage.direction, "NEUTRAL");
  assert.equal(goalsAverage.weight, null);
});

test("buildPredictionFactors: weight of feature-backed factors is normalized to sum to 1", () => {
  const factors = buildPredictionFactors(buildResult());
  const weighted = factors.filter((f) => f.weight !== null);
  const sum = weighted.reduce((acc, f) => acc + f.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("buildPredictionFactors: never mutates the input result", () => {
  const result = buildResult();
  const before = JSON.stringify(result);
  buildPredictionFactors(result);
  assert.equal(JSON.stringify(result), before);
});

// ---------------------------------------------------------------------
// ConfidenceBreakdownEngine (Etapa 2)
// ---------------------------------------------------------------------

test("buildConfidenceBreakdown: sums to exactly 100", () => {
  const breakdown = buildConfidenceBreakdown(buildResult());
  const sum = breakdown.reduce((acc, item) => acc + item.percentage, 0);
  assert.equal(sum, 100);
});

test("buildConfidenceBreakdown: returns exactly the 6 documented categories", () => {
  const breakdown = buildConfidenceBreakdown(buildResult());
  assert.deepEqual(
    breakdown.map((i) => i.category).sort(),
    ["DATA_QUALITY", "GOALS_TREND", "HEAD_TO_HEAD", "HOME_ADVANTAGE", "RECENT_FORM", "SAMPLE_SIZE"].sort(),
  );
});

test("buildConfidenceBreakdown: all percentages are non-negative integers", () => {
  const breakdown = buildConfidenceBreakdown(buildResult());
  for (const item of breakdown) {
    assert.ok(Number.isInteger(item.percentage));
    assert.ok(item.percentage >= 0);
  }
});

test("buildConfidenceBreakdown: falls back to an even split (still summing to 100) when every raw score is zero", () => {
  const result = buildResult();
  result.prediction.featureTrace = result.prediction.featureTrace.map((f) => ({ ...f, availability: "MISSING", weight: 0 }));
  result.goalDistribution.featureTrace = result.goalDistribution.featureTrace.map((f) => ({ ...f, availability: "MISSING", weight: 0 }));
  result.goalDistribution.expectedGoals = { home: 1.25, away: 1.25, total: 2.5 }; // exactly neutral baseline
  result.prediction.dataSufficiency = { ...result.prediction.dataSufficiency, status: "INSUFFICIENT" };
  result.quality = { ...result.quality, combinedStatus: "INSUFFICIENT" };
  const breakdown = buildConfidenceBreakdown(result);
  const sum = breakdown.reduce((acc, item) => acc + item.percentage, 0);
  assert.equal(sum, 100);
});

test("buildConfidenceBreakdown: higher data sufficiency status yields a higher DATA_QUALITY/SAMPLE_SIZE share", () => {
  const strong = buildConfidenceBreakdown(buildResult());
  const weak = buildConfidenceBreakdown(buildResult({
    quality: { predictionDataSufficiency: "INSUFFICIENT", goalDistributionDataSufficiency: "INSUFFICIENT", combinedStatus: "INSUFFICIENT", consistency: { level: "ALIGNED", matchingWinner: true, maxProbabilityDelta: 0.02, adjustment: 8 } },
    prediction: { ...buildResult().prediction, dataSufficiency: { status: "INSUFFICIENT", sampleSize: 2, homeSampleSize: 1, awaySampleSize: 1, headToHeadSampleSize: 0, warnings: [] } },
  }));
  const strongDataQuality = strong.find((i) => i.category === "DATA_QUALITY").percentage;
  const weakDataQuality = weak.find((i) => i.category === "DATA_QUALITY").percentage;
  assert.ok(strongDataQuality >= weakDataQuality);
});

// ---------------------------------------------------------------------
// PredictionReasonsEngine (Etapa 3)
// ---------------------------------------------------------------------

test("buildPredictionReasons: preserves the exact order and count of explanation.topSignals", () => {
  const result = buildResult();
  const reasons = buildPredictionReasons(result);
  assert.equal(reasons.length, result.explanation.topSignals.length);
  reasons.forEach((reason, index) => {
    assert.equal(reason.rank, index + 1);
    assert.equal(reason.signalType, result.explanation.topSignals[index].type);
    assert.equal(reason.magnitude, result.explanation.topSignals[index].magnitude);
  });
});

test("buildPredictionReasons: text mentions the correct side for HOME/AWAY signals", () => {
  const reasons = buildPredictionReasons(buildResult());
  const ratingReason = reasons.find((r) => r.signalType === "RATING_ADVANTAGE");
  assert.match(ratingReason.text, /mandante/);
});

test("buildPredictionReasons: NEUTRAL signals produce side-agnostic text (never 'mandante'/'visitante')", () => {
  const reasons = buildPredictionReasons(buildResult());
  const trendReason = reasons.find((r) => r.signalType === "HIGH_SCORING_TREND");
  assert.ok(!/mandante|visitante/.test(trendReason.text));
});

test("buildPredictionReasons: empty topSignals yields an empty reasons array (never fabricated)", () => {
  const result = buildResult({ explanation: { topSignals: [], totalSignalsConsidered: 0 } });
  assert.deepEqual(buildPredictionReasons(result), []);
});

test("buildPredictionReasons: every PredictionSignalType has a template (never throws)", () => {
  const allTypes = [
    "RATING_ADVANTAGE", "FORM_ADVANTAGE", "STRENGTH_ADVANTAGE", "MOMENTUM_ADVANTAGE", "HOME_FIELD_ADVANTAGE",
    "HEAD_TO_HEAD_ADVANTAGE", "GREEN_SCORE_ADVANTAGE", "GOAL_EXPECTATION_ADVANTAGE", "HIGH_SCORING_TREND", "LOW_SCORING_TREND",
  ];
  const result = buildResult({
    explanation: { topSignals: allTypes.map((type) => ({ type, source: "PREDICTION_ENGINE", favors: "AWAY", magnitude: 0.5 })), totalSignalsConsidered: allTypes.length },
  });
  const reasons = buildPredictionReasons(result);
  assert.equal(reasons.length, allTypes.length);
  for (const reason of reasons) assert.ok(reason.text.length > 0);
});

// ---------------------------------------------------------------------
// RiskIndicatorEngine (Etapa 4)
// ---------------------------------------------------------------------

test("buildRiskIndicators: a healthy, strong prediction yields no risks", () => {
  const risks = buildRiskIndicators(buildResult(), NOW);
  assert.deepEqual(risks, []);
});

test("buildRiskIndicators: LOW_SAMPLE_SIZE fires for INSUFFICIENT/LIMITED combinedStatus, with the right severity", () => {
  const insufficient = buildRiskIndicators(buildResult({ quality: { ...buildResult().quality, combinedStatus: "INSUFFICIENT" } }), NOW);
  assert.equal(insufficient.find((r) => r.code === "LOW_SAMPLE_SIZE").severity, "HIGH");

  const limited = buildRiskIndicators(buildResult({ quality: { ...buildResult().quality, combinedStatus: "LIMITED" } }), NOW);
  assert.equal(limited.find((r) => r.code === "LOW_SAMPLE_SIZE").severity, "MEDIUM");
});

test("buildRiskIndicators: STALE_DATA fires only when now is far enough after generatedAt", () => {
  const fresh = buildRiskIndicators(buildResult(), NOW);
  assert.ok(!fresh.some((r) => r.code === "STALE_DATA"));

  const later = new Date(Date.parse(NOW) + 30 * 60 * 60 * 1000).toISOString(); // +30h
  const stale = buildRiskIndicators(buildResult(), later);
  assert.ok(stale.some((r) => r.code === "STALE_DATA"));
});

test("buildRiskIndicators: INDICATOR_CONFLICT fires for MINOR/MAJOR_DIVERGENCE", () => {
  const major = buildRiskIndicators(buildResult({ quality: { ...buildResult().quality, consistency: { level: "MAJOR_DIVERGENCE", matchingWinner: false, maxProbabilityDelta: 0.3, adjustment: -20 } } }), NOW);
  assert.equal(major.find((r) => r.code === "INDICATOR_CONFLICT").severity, "HIGH");
});

test("buildRiskIndicators: INSUFFICIENT_CONFIDENCE fires below thresholds", () => {
  const high = buildRiskIndicators(buildResult({ confidence: 20 }), NOW);
  assert.equal(high.find((r) => r.code === "INSUFFICIENT_CONFIDENCE").severity, "HIGH");
  const medium = buildRiskIndicators(buildResult({ confidence: 50 }), NOW);
  assert.equal(medium.find((r) => r.code === "INSUFFICIENT_CONFIDENCE").severity, "MEDIUM");
});

test("buildRiskIndicators: HIGH_VOLATILITY fires for a narrow probabilityMargin", () => {
  const result = buildResult();
  result.prediction.probabilityMargin = 0.01;
  const risks = buildRiskIndicators(result, NOW);
  assert.ok(risks.some((r) => r.code === "HIGH_VOLATILITY"));
});

test("buildRiskIndicators: NO_HEAD_TO_HEAD_HISTORY fires when headToHeadSampleSize is zero", () => {
  const result = buildResult();
  result.prediction.dataSufficiency.headToHeadSampleSize = 0;
  const risks = buildRiskIndicators(result, NOW);
  assert.ok(risks.some((r) => r.code === "NO_HEAD_TO_HEAD_HISTORY"));
});

test("buildRiskIndicators: every returned risk has code/severity/description", () => {
  const risks = buildRiskIndicators(buildResult({ confidence: 10, quality: { predictionDataSufficiency: "INSUFFICIENT", goalDistributionDataSufficiency: "INSUFFICIENT", combinedStatus: "INSUFFICIENT", consistency: { level: "MAJOR_DIVERGENCE", matchingWinner: false, maxProbabilityDelta: 0.3, adjustment: -20 } } }), NOW);
  assert.ok(risks.length > 0);
  for (const risk of risks) {
    assert.ok(typeof risk.code === "string");
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(risk.severity));
    assert.ok(risk.description.length > 0);
  }
});

// ---------------------------------------------------------------------
// QualityScoreEngine (Etapa 5)
// ---------------------------------------------------------------------

test("buildPredictionQualityScore: strong confidence + strong data quality + aligned consistency yields a high grade", () => {
  const quality = buildPredictionQualityScore(buildResult());
  assert.ok(["A_PLUS", "A"].includes(quality.grade));
  assert.ok(quality.score >= 80);
});

test("buildPredictionQualityScore: weak confidence + insufficient data + major divergence yields a low grade", () => {
  const quality = buildPredictionQualityScore(
    buildResult({
      confidence: 15,
      quality: { predictionDataSufficiency: "INSUFFICIENT", goalDistributionDataSufficiency: "INSUFFICIENT", combinedStatus: "INSUFFICIENT", consistency: { level: "MAJOR_DIVERGENCE", matchingWinner: false, maxProbabilityDelta: 0.3, adjustment: -20 } },
    }),
  );
  assert.equal(quality.grade, "D");
});

test("buildPredictionQualityScore: score is always clamped to 0..100", () => {
  const quality = buildPredictionQualityScore(buildResult({ confidence: 100, quality: { predictionDataSufficiency: "STRONG", goalDistributionDataSufficiency: "STRONG", combinedStatus: "STRONG", consistency: { level: "ALIGNED", matchingWinner: true, maxProbabilityDelta: 0, adjustment: 8 } } }));
  assert.ok(quality.score >= 0 && quality.score <= 100);
});

test("buildPredictionQualityScore: is independent from greenScore.score (never reads it)", () => {
  const a = buildPredictionQualityScore(buildResult({ greenScore: { score: 10, category: "LOW" } }));
  const b = buildPredictionQualityScore(buildResult({ greenScore: { score: 95, category: "VERY_HIGH" } }));
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------
// Composição (buildPredictionExplanation)
// ---------------------------------------------------------------------

test("buildPredictionExplanation: composes all 5 outputs from a PredictionSnapshot", () => {
  const explanation = buildPredictionExplanation(buildSnapshot(), NOW);
  assert.equal(explanation.factors.length, 7);
  assert.equal(explanation.confidenceBreakdown.reduce((s, i) => s + i.percentage, 0), 100);
  assert.ok(Array.isArray(explanation.reasons));
  assert.ok(Array.isArray(explanation.risks));
  assert.ok(["A_PLUS", "A", "B_PLUS", "B", "C", "D"].includes(explanation.quality.grade));
});

test("buildPredictionExplanation: is deterministic for identical input", () => {
  const a = buildPredictionExplanation(buildSnapshot(), NOW);
  const b = buildPredictionExplanation(buildSnapshot(), NOW);
  assert.deepEqual(a, b);
});

test("buildPredictionExplanation: never mutates the input snapshot", () => {
  const snapshot = buildSnapshot();
  const before = JSON.stringify(snapshot);
  buildPredictionExplanation(snapshot, NOW);
  assert.equal(JSON.stringify(snapshot), before);
});
