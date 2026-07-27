import test from "node:test";
import assert from "node:assert/strict";
import { predictMatch } from "../src/services/prediction-orchestrator/index.ts";
import { buildLearningReport, toLearningHistoricalRecord, DEFAULT_PREDICTION_LEARNING_CONFIG } from "../src/services/prediction-learning/index.ts";
import { buildAdaptiveReport, DEFAULT_PREDICTION_ADAPTATION_CONFIG } from "../src/services/prediction-adaptation/index.ts";
import { buildObservabilityReport, DEFAULT_PREDICTION_OBSERVABILITY_CONFIG } from "../src/services/prediction-observability/index.ts";

const FIXED_NOW = () => new Date("2026-07-27T00:00:00.000Z");

function player(id, ratingValue) {
  return {
    playerId: id,
    matchesCount: 20,
    rating: { playerId: id, rating: ratingValue, matchesCount: 20 },
    form: null,
    homeAway: null,
    momentum: null,
    strength: null,
    confidence: null,
    greenScore: null,
    goalsRates: null,
  };
}

function buildRealLearningReport(size, splitAt) {
  const records = [];
  for (let i = 0; i < size; i += 1) {
    const homeStronger = i % 3 !== 0;
    const homePlayer = player(`home-${i}`, homeStronger ? 1700 : 1400);
    const awayPlayer = player(`away-${i}`, homeStronger ? 1400 : 1700);
    const result = predictMatch({ homePlayer, awayPlayer, headToHead: null }, undefined, FIXED_NOW);
    const actualOutcome = i % 5 === 0 ? "DRAW" : result.prediction.predictedOutcome;

    records.push(
      toLearningHistoricalRecord({
        snapshot: {
          matchId: `m${i}`,
          homePlayerId: homePlayer.playerId,
          awayPlayerId: awayPlayer.playerId,
          virtualTeamHome: i % 2 === 0 ? "Bologna" : "Juventus",
          virtualTeamAway: i % 2 === 0 ? "Roma" : "Napoli",
          league: i % 2 === 0 ? "league-a" : "league-b",
          period: i < size / 2 ? "2026-06" : "2026-07",
          sequenceKey: i,
          result,
        },
        actual: { matchId: `m${i}`, outcome: actualOutcome, homeGoals: 2, awayGoals: 1 },
      }),
    );
  }
  const learningConfig = { ...DEFAULT_PREDICTION_LEARNING_CONFIG, minimumRecordsPerProfile: 1, minimumRecordsPerWindow: 1, minimumRecordsForDrift: 1 };
  return buildLearningReport(
    { datasetId: "regression-ds", records },
    learningConfig,
    {
      reportId: "learning-r1",
      baselineWindow: { label: "baseline", fromSequenceKey: 0, toSequenceKey: splitAt - 1 },
      currentWindow: { label: "current", fromSequenceKey: splitAt, toSequenceKey: size - 1 },
    },
  );
}

const OBSERVABILITY_CONFIG = DEFAULT_PREDICTION_OBSERVABILITY_CONFIG;

test("integrates end-to-end with real LearningReport (5.1) and AdaptiveReport (5.2), built from real predictMatch() outputs (4.3)", () => {
  const learning = buildRealLearningReport(20, 10);
  const adaptive = buildAdaptiveReport(learning, DEFAULT_PREDICTION_ADAPTATION_CONFIG, { reportId: "adaptive-r1" });
  const observability = buildObservabilityReport(learning, adaptive, OBSERVABILITY_CONFIG, { reportId: "observability-r1" });
  assert.equal(observability.monitoredProfiles.length, learning.historicalProfiles.length);
  assert.equal(observability.dashboardMetrics.totalProfiles, learning.historicalProfiles.length);
});

test("every monitored profile's dimension+key corresponds to a real profile produced by Sprint 5.1", () => {
  const learning = buildRealLearningReport(15, 8);
  const adaptive = buildAdaptiveReport(learning, DEFAULT_PREDICTION_ADAPTATION_CONFIG, { reportId: "adaptive-r2" });
  const observability = buildObservabilityReport(learning, adaptive, OBSERVABILITY_CONFIG, { reportId: "observability-r2" });
  const profileKeys = new Set(learning.historicalProfiles.map((p) => `${p.dimension}::${p.key}`));
  for (const monitored of observability.monitoredProfiles) {
    assert.ok(profileKeys.has(`${monitored.dimension}::${monitored.key}`));
  }
});

test("does not mutate the real LearningReport/AdaptiveReport produced by Sprints 5.1/5.2", () => {
  const learning = buildRealLearningReport(12, 6);
  const adaptive = buildAdaptiveReport(learning, DEFAULT_PREDICTION_ADAPTATION_CONFIG, { reportId: "adaptive-r3" });
  const learningSnapshot = JSON.parse(JSON.stringify(learning));
  const adaptiveSnapshot = JSON.parse(JSON.stringify(adaptive));
  buildObservabilityReport(learning, adaptive, OBSERVABILITY_CONFIG, { reportId: "observability-r3" });
  assert.deepEqual(learning, learningSnapshot);
  assert.deepEqual(adaptive, adaptiveSnapshot);
});

test("produces a fully deterministic report across two separate calls against real upstream reports", () => {
  const learning = buildRealLearningReport(14, 7);
  const adaptive = buildAdaptiveReport(learning, DEFAULT_PREDICTION_ADAPTATION_CONFIG, { reportId: "adaptive-r4" });
  const options = { reportId: "observability-r4", generatedAt: "2026-07-27T00:00:00.000Z", timelineTimestamp: "2026-07-27T00:00:00.000Z" };
  const first = buildObservabilityReport(learning, adaptive, OBSERVABILITY_CONFIG, options);
  const second = buildObservabilityReport(learning, adaptive, OBSERVABILITY_CONFIG, options);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("regression: Sprints 4.1-4.5, 5.1, and 5.2 public barrels remain importable and functional alongside prediction-observability", () => {
  assert.equal(typeof predictMatch, "function");
  assert.equal(typeof buildLearningReport, "function");
  assert.equal(typeof buildAdaptiveReport, "function");
  assert.doesNotThrow(() => buildRealLearningReport(5, 2));
});

test("never introduces betting/financial vocabulary anywhere in a real observability report's serialized output", () => {
  const learning = buildRealLearningReport(10, 5);
  const adaptive = buildAdaptiveReport(learning, DEFAULT_PREDICTION_ADAPTATION_CONFIG, { reportId: "adaptive-r5" });
  const observability = buildObservabilityReport(learning, adaptive, OBSERVABILITY_CONFIG, { reportId: "observability-r5" });
  const serialized = JSON.stringify(observability).toLowerCase();
  for (const forbidden of ["odds", "stake", "kelly", "expectedvalue", "roi", "bookmaker", "wager"]) {
    assert.ok(!serialized.includes(forbidden), `unexpected forbidden term: ${forbidden}`);
  }
});

test("dashboardMetrics.recommendationDistribution sums to the number of profiles with a non-null recommendation", () => {
  const learning = buildRealLearningReport(16, 8);
  const adaptive = buildAdaptiveReport(learning, DEFAULT_PREDICTION_ADAPTATION_CONFIG, { reportId: "adaptive-r6" });
  const observability = buildObservabilityReport(learning, adaptive, OBSERVABILITY_CONFIG, { reportId: "observability-r6" });
  const sum = Object.values(observability.dashboardMetrics.recommendationDistribution).reduce((a, b) => a + b, 0);
  const withRecommendation = observability.monitoredProfiles.filter((p) => p.recommendation !== null).length;
  assert.equal(sum, withRecommendation);
});

test("a profile that disappeared between baseline and current window produces a PROFILE_DISABLED alert", () => {
  const learning = buildRealLearningReport(20, 10);
  const adaptive = buildAdaptiveReport(learning, DEFAULT_PREDICTION_ADAPTATION_CONFIG, { reportId: "adaptive-r7" });
  const observability = buildObservabilityReport(learning, adaptive, OBSERVABILITY_CONFIG, { reportId: "observability-r7" });
  const disappearedSignal = learning.driftSignals.find((s) => s.type === "PROFILE_DISAPPEARED");
  if (disappearedSignal) {
    assert.ok(observability.alerts.some((a) => a.dimension === disappearedSignal.dimension && a.key === disappearedSignal.key && a.type === "PROFILE_DISABLED"));
  }
});
