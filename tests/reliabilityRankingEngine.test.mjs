import test from "node:test";
import assert from "node:assert/strict";
import { buildReliabilityRanking } from "../src/services/prediction-learning/ReliabilityRankingEngine.ts";
import { DEFAULT_PREDICTION_LEARNING_CONFIG } from "../src/services/prediction-learning/PredictionLearningConfig.ts";

function metrics(overrides = {}) {
  return {
    totalRecords: 20,
    validRecords: 20,
    ignoredRecords: 0,
    correct: 18,
    incorrect: 2,
    accuracy: 0.9,
    macroPrecision: 0.9,
    macroRecall: 0.9,
    brierScore: 0.2,
    logLoss: 0.3,
    averageConfidence: 80,
    averagePredictedProbability: 0.85,
    averageObservedOutcome: 0.9,
    ...overrides,
  };
}

function profile(dimension, key, overrides = {}) {
  return {
    dimension,
    key,
    totalRecords: 20,
    validRecords: 20,
    status: "OK",
    metrics: metrics(overrides.metricsOverrides ?? {}),
    firstSequenceKey: null,
    lastSequenceKey: null,
    warnings: [],
    ...overrides,
  };
}

const CONFIG = DEFAULT_PREDICTION_LEARNING_CONFIG;

test("ranks a single profile with rank 1", () => {
  const ranking = buildReliabilityRanking([profile("PLAYER", "alice")], CONFIG);
  assert.equal(ranking.entries.length, 1);
  assert.equal(ranking.entries[0].rank, 1);
});

test("ranks profiles by descending reliabilityScore", () => {
  const good = profile("PLAYER", "alice", { metricsOverrides: { accuracy: 0.95, brierScore: 0.1, logLoss: 0.2 } });
  const bad = profile("PLAYER", "bob", { metricsOverrides: { accuracy: 0.4, brierScore: 1.5, logLoss: 1.5 } });
  const ranking = buildReliabilityRanking([bad, good], CONFIG);
  assert.equal(ranking.entries[0].key, "alice");
  assert.equal(ranking.entries[1].key, "bob");
});

test("a profile with insufficient sample is penalized: capped well below a high-quality OK profile", () => {
  const smallSample = profile("PLAYER", "rookie", { status: "INSUFFICIENT_SAMPLE", validRecords: 2, metricsOverrides: { accuracy: 1, brierScore: 0, logLoss: 0.01 } });
  const okProfile = profile("PLAYER", "veteran", { status: "OK", validRecords: 100, metricsOverrides: { accuracy: 0.9, brierScore: 0.2, logLoss: 0.3 } });
  const ranking = buildReliabilityRanking([smallSample, okProfile], CONFIG);
  const rookieEntry = ranking.entries.find((e) => e.key === "rookie");
  const veteranEntry = ranking.entries.find((e) => e.key === "veteran");
  assert.ok(rookieEntry.reliabilityScore < veteranEntry.reliabilityScore);
  assert.ok(rookieEntry.reliabilityScore <= 40);
});

test("ties are broken deterministically by dimension (fixed order), then key (alphabetical)", () => {
  const a = profile("LEAGUE", "zeta");
  const b = profile("PLAYER", "alpha");
  const ranking = buildReliabilityRanking([a, b], CONFIG);
  // Same metrics/status -> identical raw scores -> tie-break by dimension order: PLAYER before LEAGUE.
  assert.equal(ranking.entries[0].dimension, "PLAYER");
  assert.equal(ranking.entries[1].dimension, "LEAGUE");
});

test("ties within the same dimension are broken alphabetically by key", () => {
  const a = profile("PLAYER", "zeta");
  const b = profile("PLAYER", "alpha");
  const ranking = buildReliabilityRanking([a, b], CONFIG);
  assert.equal(ranking.entries[0].key, "alpha");
  assert.equal(ranking.entries[1].key, "zeta");
});

test("reliabilityScore is always within [0, 100]", () => {
  const extremeGood = profile("PLAYER", "perfect", { metricsOverrides: { accuracy: 1, macroPrecision: 1, macroRecall: 1, brierScore: 0, logLoss: 0 } });
  const extremeBad = profile("PLAYER", "terrible", { metricsOverrides: { accuracy: 0, macroPrecision: 0, macroRecall: 0, brierScore: 2, logLoss: 10 } });
  const ranking = buildReliabilityRanking([extremeGood, extremeBad], CONFIG);
  for (const entry of ranking.entries) {
    assert.ok(entry.reliabilityScore >= 0);
    assert.ok(entry.reliabilityScore <= 100);
  }
});

test("metricContributions sum to the reliability score for a status-OK profile (no ceiling applied)", () => {
  const ranking = buildReliabilityRanking([profile("PLAYER", "alice")], CONFIG);
  const entry = ranking.entries[0];
  const sum = entry.metricContributions.reduce((total, c) => total + c.contribution, 0);
  assert.ok(Math.abs(sum - entry.reliabilityScore) < 1e-9);
});

test("drift signals for a profile reduce its stability sub-score (and therefore its reliabilityScore)", () => {
  const stableProfile = profile("PLAYER", "alice");
  const unstableProfile = profile("PLAYER", "bob");
  const driftSignals = [
    { id: "d1", dimension: "PLAYER", key: "bob", type: "PERFORMANCE_DEGRADATION", severity: "CRITICAL", metric: "accuracy", baselineValue: 0.9, currentValue: 0.4, absoluteDelta: -0.5, relativeDelta: -55, threshold: 0.05, direction: "DEGRADATION", reason: "x", baselineRecords: 20, currentRecords: 20 },
  ];
  const ranking = buildReliabilityRanking([stableProfile, unstableProfile], CONFIG, driftSignals);
  const aliceEntry = ranking.entries.find((e) => e.key === "alice");
  const bobEntry = ranking.entries.find((e) => e.key === "bob");
  assert.ok(bobEntry.reliabilityScore < aliceEntry.reliabilityScore);
});

test("does not favor a minuscule sample over a properly-sized one with the same raw metrics", () => {
  const config = { ...CONFIG, minimumRecordsPerProfile: 10 };
  const tiny = profile("PLAYER", "tiny", { validRecords: 1 });
  const proper = profile("PLAYER", "proper", { validRecords: 50 });
  const ranking = buildReliabilityRanking([tiny, proper], config);
  const tinyEntry = ranking.entries.find((e) => e.key === "tiny");
  const properEntry = ranking.entries.find((e) => e.key === "proper");
  assert.ok(tinyEntry.reliabilityScore < properEntry.reliabilityScore);
});

test("is deterministic for identical input", () => {
  const profiles = [profile("PLAYER", "alice"), profile("PLAYER", "bob", { metricsOverrides: { accuracy: 0.5 } })];
  assert.deepEqual(buildReliabilityRanking(profiles, CONFIG), buildReliabilityRanking(profiles, CONFIG));
});

test("result is order-independent for the same set of profiles", () => {
  const profiles = [profile("PLAYER", "alice"), profile("LEAGUE", "league-a", { metricsOverrides: { accuracy: 0.5 } })];
  const a = buildReliabilityRanking(profiles, CONFIG);
  const b = buildReliabilityRanking([...profiles].reverse(), CONFIG);
  assert.deepEqual(a, b);
});

test("handles an empty profile list", () => {
  const ranking = buildReliabilityRanking([], CONFIG);
  assert.deepEqual(ranking.entries, []);
  assert.equal(ranking.profileCount, 0);
});

test("non-finite metric values are treated as a zero-score component, never propagated as NaN", () => {
  const brokenProfile = profile("PLAYER", "broken", {
    metricsOverrides: { accuracy: Number.NaN, macroPrecision: Number.NaN, macroRecall: Number.NaN, brierScore: Number.NaN, logLoss: Number.NaN },
  });
  const ranking = buildReliabilityRanking([brokenProfile], CONFIG);
  assert.ok(Number.isFinite(ranking.entries[0].reliabilityScore));
});

test("sampleSizeScore treats minimumRecordsPerProfile of zero as trivially satisfied by any sample, and zero as worst-case", () => {
  const config = { ...CONFIG, minimumRecordsPerProfile: 0 };
  const withRecords = profile("PLAYER", "has-records", { validRecords: 5 });
  const noRecords = profile("PLAYER", "no-records", { validRecords: 0 });
  const ranking = buildReliabilityRanking([withRecords, noRecords], config);
  const withRecordsContribution = ranking.entries.find((e) => e.key === "has-records").metricContributions.find((c) => c.metricName === "sampleSize");
  const noRecordsContribution = ranking.entries.find((e) => e.key === "no-records").metricContributions.find((c) => c.metricName === "sampleSize");
  assert.equal(withRecordsContribution.normalizedValue, 1);
  assert.equal(noRecordsContribution.normalizedValue, 0);
});

test("insufficientSampleScoreCeiling is read from config, not hardcoded", () => {
  const config = { ...CONFIG, insufficientSampleScoreCeiling: 10 };
  const notOk = profile("PLAYER", "rookie", { status: "INSUFFICIENT_SAMPLE", metricsOverrides: { accuracy: 1, brierScore: 0, logLoss: 0.01 } });
  const ranking = buildReliabilityRanking([notOk], config);
  assert.ok(ranking.entries[0].reliabilityScore <= 10);
});

test("driftSeverityPenalty is read from config, not hardcoded", () => {
  const config = { ...CONFIG, driftSeverityPenalty: { INFO: 0, WARNING: 0, CRITICAL: 1 } };
  const stableProfile = profile("PLAYER", "alice");
  const unstableProfile = profile("PLAYER", "bob");
  const criticalDrift = [
    { id: "d1", dimension: "PLAYER", key: "bob", type: "PERFORMANCE_DEGRADATION", severity: "CRITICAL", metric: "accuracy", baselineValue: 0.9, currentValue: 0.4, absoluteDelta: -0.5, relativeDelta: -55, threshold: 0.05, direction: "DEGRADATION", reason: "x", baselineRecords: 20, currentRecords: 20 },
  ];
  const ranking = buildReliabilityRanking([stableProfile, unstableProfile], config, criticalDrift);
  const bobStability = ranking.entries.find((e) => e.key === "bob").metricContributions.find((c) => c.metricName === "stability");
  assert.equal(bobStability.normalizedValue, 0);
});

test("reliabilityLogLossCap is read from config, not hardcoded", () => {
  const config = { ...CONFIG, reliabilityLogLossCap: 1 };
  const highLogLoss = profile("PLAYER", "alice", { metricsOverrides: { logLoss: 1 } });
  const ranking = buildReliabilityRanking([highLogLoss], config);
  const logLossContribution = ranking.entries[0].metricContributions.find((c) => c.metricName === "logLoss");
  assert.equal(logLossContribution.normalizedValue, 0);
});

test("reliabilityWeights of zero for a component excludes it from contributing to the score", () => {
  const config = { ...CONFIG, reliabilityWeights: { accuracy: 1, macroPrecision: 0, macroRecall: 0, brierScore: 0, logLoss: 0, sampleSize: 0, stability: 0 } };
  const highAccuracy = profile("PLAYER", "alice", { metricsOverrides: { accuracy: 1, brierScore: 2, logLoss: 10 } });
  const ranking = buildReliabilityRanking([highAccuracy], config);
  assert.ok(Math.abs(ranking.entries[0].reliabilityScore - 100) < 1e-6);
});
