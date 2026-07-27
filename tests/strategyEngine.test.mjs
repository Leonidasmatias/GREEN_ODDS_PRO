import test from "node:test";
import assert from "node:assert/strict";
import { classifyStrategy } from "../src/services/prediction-adaptation/StrategyEngine.ts";
import { DEFAULT_PREDICTION_ADAPTATION_CONFIG } from "../src/services/prediction-adaptation/PredictionAdaptationConfig.ts";

function metrics(overrides = {}) {
  return {
    totalRecords: 20,
    validRecords: 20,
    ignoredRecords: 0,
    correct: 16,
    incorrect: 4,
    accuracy: 0.8,
    macroPrecision: 0.8,
    macroRecall: 0.8,
    brierScore: 0.4,
    logLoss: 0.6,
    averageConfidence: 70,
    averagePredictedProbability: 0.7,
    averageObservedOutcome: 0.8,
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

function signal(dimension, key, severity, direction) {
  return {
    id: `${dimension}:${key}:X:accuracy`,
    dimension,
    key,
    type: direction === "DEGRADATION" ? "PERFORMANCE_DEGRADATION" : "PERFORMANCE_IMPROVEMENT",
    severity,
    metric: "accuracy",
    baselineValue: 0.8,
    currentValue: 0.5,
    absoluteDelta: -0.3,
    relativeDelta: -37.5,
    threshold: 0.05,
    direction,
    reason: "x",
    baselineRecords: 20,
    currentRecords: 20,
  };
}

function ranking(entries) {
  return { entries, profileCount: entries.length };
}

function rankingEntry(dimension, key, reliabilityScore) {
  return { rank: 1, dimension, key, reliabilityScore, sampleSize: 20, status: "OK", metricContributions: [], warnings: [] };
}

const CONFIG = DEFAULT_PREDICTION_ADAPTATION_CONFIG;
const GLOBAL_PROFILE = profile("GLOBAL", "GLOBAL");
const GLOBAL_RANKING_HIGH = ranking([rankingEntry("GLOBAL", "GLOBAL", 90)]);

test("any CRITICAL-severity degradation signal (any profile) yields CRITICAL", () => {
  const signals = [signal("PLAYER", "alice", "CRITICAL", "DEGRADATION")];
  assert.equal(classifyStrategy([GLOBAL_PROFILE], signals, GLOBAL_RANKING_HIGH, CONFIG), "CRITICAL");
});

test("any WARNING-severity degradation signal (no CRITICAL) yields WARNING", () => {
  const signals = [signal("PLAYER", "alice", "WARNING", "DEGRADATION")];
  assert.equal(classifyStrategy([GLOBAL_PROFILE], signals, GLOBAL_RANKING_HIGH, CONFIG), "WARNING");
});

test("CRITICAL degradation takes priority over a simultaneous WARNING signal", () => {
  const signals = [signal("PLAYER", "alice", "WARNING", "DEGRADATION"), signal("PLAYER", "bob", "CRITICAL", "DEGRADATION")];
  assert.equal(classifyStrategy([GLOBAL_PROFILE], signals, GLOBAL_RANKING_HIGH, CONFIG), "CRITICAL");
});

test("an INFO-severity degradation signal (no WARNING/CRITICAL) yields WATCH", () => {
  const signals = [signal("PLAYER", "alice", "INFO", "DEGRADATION")];
  assert.equal(classifyStrategy([GLOBAL_PROFILE], signals, GLOBAL_RANKING_HIGH, CONFIG), "WATCH");
});

test("GLOBAL profile status other than OK yields at least WATCH, even without any drift signal", () => {
  const insufficientGlobal = profile("GLOBAL", "GLOBAL", { status: "INSUFFICIENT_SAMPLE" });
  assert.equal(classifyStrategy([insufficientGlobal], [], GLOBAL_RANKING_HIGH, CONFIG), "WATCH");
});

test("a missing GLOBAL profile yields at least WATCH", () => {
  const onlyPlayerProfile = profile("PLAYER", "alice");
  assert.equal(classifyStrategy([onlyPlayerProfile], [], ranking([]), CONFIG), "WATCH");
});

test("GLOBAL reliability score below strategyLowReliabilityThreshold yields at least WATCH", () => {
  const lowGlobalRanking = ranking([rankingEntry("GLOBAL", "GLOBAL", 10)]);
  assert.equal(classifyStrategy([GLOBAL_PROFILE], [], lowGlobalRanking, CONFIG), "WATCH");
});

test("no drift, GLOBAL status OK, and GLOBAL reliability above threshold yields NORMAL", () => {
  assert.equal(classifyStrategy([GLOBAL_PROFILE], [], GLOBAL_RANKING_HIGH, CONFIG), "NORMAL");
});

test("an improvement signal (no degradation) does not escalate beyond NORMAL", () => {
  const signals = [signal("PLAYER", "alice", "CRITICAL", "IMPROVEMENT")];
  assert.equal(classifyStrategy([GLOBAL_PROFILE], signals, GLOBAL_RANKING_HIGH, CONFIG), "NORMAL");
});

test("does not mutate the input profiles/driftSignals/reliabilityRanking", () => {
  const signals = [signal("PLAYER", "alice", "WARNING", "DEGRADATION")];
  const profilesSnapshot = JSON.parse(JSON.stringify([GLOBAL_PROFILE]));
  const signalsSnapshot = JSON.parse(JSON.stringify(signals));
  const rankingSnapshot = JSON.parse(JSON.stringify(GLOBAL_RANKING_HIGH));
  classifyStrategy([GLOBAL_PROFILE], signals, GLOBAL_RANKING_HIGH, CONFIG);
  assert.deepEqual([GLOBAL_PROFILE], profilesSnapshot);
  assert.deepEqual(signals, signalsSnapshot);
  assert.deepEqual(GLOBAL_RANKING_HIGH, rankingSnapshot);
});

test("is deterministic for identical input", () => {
  const signals = [signal("PLAYER", "alice", "WARNING", "DEGRADATION")];
  assert.equal(
    classifyStrategy([GLOBAL_PROFILE], signals, GLOBAL_RANKING_HIGH, CONFIG),
    classifyStrategy([GLOBAL_PROFILE], signals, GLOBAL_RANKING_HIGH, CONFIG),
  );
});
