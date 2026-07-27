import test from "node:test";
import assert from "node:assert/strict";
import { predictMatch } from "../src/services/prediction-orchestrator/index.ts";
import { buildLearningReport, toLearningHistoricalRecord, DEFAULT_PREDICTION_LEARNING_CONFIG } from "../src/services/prediction-learning/index.ts";
import { buildAdaptiveReport, DEFAULT_PREDICTION_ADAPTATION_CONFIG } from "../src/services/prediction-adaptation/index.ts";

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

function buildRealLearningRecords(size) {
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
  return records;
}

const LEARNING_CONFIG = { ...DEFAULT_PREDICTION_LEARNING_CONFIG, minimumRecordsPerProfile: 1, minimumRecordsPerWindow: 1, minimumRecordsForDrift: 1 };
const ADAPTATION_CONFIG = DEFAULT_PREDICTION_ADAPTATION_CONFIG;

function buildRealLearningReport(size, splitAt) {
  const records = buildRealLearningRecords(size);
  return buildLearningReport(
    { datasetId: "regression-ds", records },
    LEARNING_CONFIG,
    {
      reportId: "learning-r1",
      baselineWindow: { label: "baseline", fromSequenceKey: 0, toSequenceKey: splitAt - 1 },
      currentWindow: { label: "current", fromSequenceKey: splitAt, toSequenceKey: size - 1 },
    },
  );
}

test("integrates end-to-end with a real LearningReport (Sprint 5.1), built from real predictMatch() outputs (Sprint 4.3)", () => {
  const source = buildRealLearningReport(20, 10);
  const report = buildAdaptiveReport(source, ADAPTATION_CONFIG, { reportId: "adaptive-r1" });
  assert.equal(report.decisions.length, source.historicalProfiles.length);
  assert.ok(["NORMAL", "WATCH", "WARNING", "CRITICAL"].includes(report.strategyStatus));
});

test("every decision's dimension+key corresponds to a real profile produced by Sprint 5.1", () => {
  const source = buildRealLearningReport(15, 8);
  const report = buildAdaptiveReport(source, ADAPTATION_CONFIG, { reportId: "adaptive-r2" });
  const profileKeys = new Set(source.historicalProfiles.map((p) => `${p.dimension}::${p.key}`));
  for (const decision of report.decisions) {
    assert.ok(profileKeys.has(`${decision.dimension}::${decision.key}`));
  }
});

test("does not mutate the real LearningReport produced by Sprint 5.1", () => {
  const source = buildRealLearningReport(12, 6);
  const snapshot = JSON.parse(JSON.stringify(source));
  buildAdaptiveReport(source, ADAPTATION_CONFIG, { reportId: "adaptive-r3" });
  assert.deepEqual(source, snapshot);
});

test("produces a fully deterministic report across two separate calls against a real LearningReport", () => {
  const source = buildRealLearningReport(14, 7);
  const options = { reportId: "adaptive-r4", generatedAt: "2026-07-27T00:00:00.000Z" };
  const first = buildAdaptiveReport(source, ADAPTATION_CONFIG, options);
  const second = buildAdaptiveReport(source, ADAPTATION_CONFIG, options);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("regression: Sprints 4.1-4.5 and 5.1 public barrels remain importable and functional alongside prediction-adaptation", () => {
  assert.equal(typeof predictMatch, "function");
  assert.equal(typeof buildLearningReport, "function");
  assert.doesNotThrow(() => buildRealLearningReport(5, 2));
});

test("never introduces betting/financial vocabulary anywhere in a real adaptive report's serialized output", () => {
  const source = buildRealLearningReport(10, 5);
  const report = buildAdaptiveReport(source, ADAPTATION_CONFIG, { reportId: "adaptive-r5" });
  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of ["odds", "stake", "kelly", "expectedvalue", "roi", "bookmaker", "wager"]) {
    assert.ok(!serialized.includes(forbidden), `unexpected forbidden term: ${forbidden}`);
  }
});

test("a profile that disappeared between baseline and current window is recommended TEMPORARILY_DISABLE_PROFILE", () => {
  const source = buildRealLearningReport(20, 10);
  const report = buildAdaptiveReport(source, ADAPTATION_CONFIG, { reportId: "adaptive-r6" });
  const disappearedSignal = source.driftSignals.find((s) => s.type === "PROFILE_DISAPPEARED");
  if (disappearedSignal) {
    const decision = report.decisions.find((d) => d.dimension === disappearedSignal.dimension && d.key === disappearedSignal.key);
    assert.equal(decision.recommendation.type, "TEMPORARILY_DISABLE_PROFILE");
  }
});
