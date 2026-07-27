import test from "node:test";
import assert from "node:assert/strict";
import { buildLearningReport } from "../src/services/prediction-learning/LearningReport.ts";
import { DEFAULT_PREDICTION_LEARNING_CONFIG, PredictionLearningConfigurationError } from "../src/services/prediction-learning/PredictionLearningConfig.ts";

function record(matchId, overrides = {}) {
  return {
    matchId,
    homePlayerId: "home",
    awayPlayerId: "away",
    virtualTeamHome: null,
    virtualTeamAway: null,
    league: "league-a",
    period: null,
    sequenceKey: null,
    predictedOutcome: "HOME_WIN",
    actualOutcome: "HOME_WIN",
    probabilities: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 },
    confidence: 70,
    greenScoreCategory: "HIGH",
    ...overrides,
  };
}

function buildDataset(count) {
  const records = Array.from({ length: count }, (_, i) => record(`m${i}`, { sequenceKey: i }));
  return { datasetId: "ds", records };
}

const CONFIG = { ...DEFAULT_PREDICTION_LEARNING_CONFIG, minimumRecordsPerProfile: 1, minimumRecordsPerWindow: 1, minimumRecordsForDrift: 1 };

function windows(splitAt, total) {
  return {
    baselineWindow: { label: "baseline", fromSequenceKey: 0, toSequenceKey: splitAt - 1 },
    currentWindow: { label: "current", fromSequenceKey: splitAt, toSequenceKey: total - 1 },
  };
}

test("a valid partial config override produces a report without throwing", () => {
  const config = { ...DEFAULT_PREDICTION_LEARNING_CONFIG, decimalPlaces: 2 };
  assert.doesNotThrow(() => buildLearningReport(buildDataset(6), config, { reportId: "r1", ...windows(3, 6) }));
});

test("an invalid config throws PredictionLearningConfigurationError before any evaluation runs", () => {
  const config = { ...DEFAULT_PREDICTION_LEARNING_CONFIG, decimalPlaces: -1 };
  assert.throws(() => buildLearningReport(buildDataset(6), config, { reportId: "r1", ...windows(3, 6) }), PredictionLearningConfigurationError);
});

test("the report is fully JSON-serializable", () => {
  const report = buildLearningReport(buildDataset(6), CONFIG, { reportId: "r1", generatedAt: "2026-01-01T00:00:00.000Z", ...windows(3, 6) });
  assert.doesNotThrow(() => JSON.stringify(report));
});

test("the report is deterministic across two separate calls", () => {
  const dataset = buildDataset(8);
  const options = { reportId: "r1", generatedAt: "2026-01-01T00:00:00.000Z", ...windows(4, 8) };
  const first = buildLearningReport(dataset, CONFIG, options);
  const second = buildLearningReport(dataset, CONFIG, options);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("reportId is always exactly what the caller supplied", () => {
  const report = buildLearningReport(buildDataset(6), CONFIG, { reportId: "fixed-id", ...windows(3, 6) });
  assert.equal(report.reportId, "fixed-id");
});

test("generatedAt is always exactly what the caller supplied, or null when omitted", () => {
  const withDate = buildLearningReport(buildDataset(6), CONFIG, { reportId: "r1", generatedAt: "2020-05-05T00:00:00.000Z", ...windows(3, 6) });
  assert.equal(withDate.generatedAt, "2020-05-05T00:00:00.000Z");
  const withoutDate = buildLearningReport(buildDataset(6), CONFIG, { reportId: "r1", ...windows(3, 6) });
  assert.equal(withoutDate.generatedAt, null);
});

test("config is preserved exactly, never rounded, even with a small decimalPlaces", () => {
  const config = { ...CONFIG, decimalPlaces: 1, numericTolerance: 0.000001 };
  const report = buildLearningReport(buildDataset(6), config, { reportId: "r1", ...windows(3, 6) });
  assert.equal(report.config.numericTolerance, 0.000001);
});

test("decimalPlaces rounds computed metrics", () => {
  const config = { ...CONFIG, decimalPlaces: 2 };
  const report = buildLearningReport(buildDataset(6), config, { reportId: "r1", ...windows(3, 6) });
  const globalProfile = report.historicalProfiles.find((p) => p.dimension === "GLOBAL");
  const decimalPart = String(globalProfile.metrics.brierScore).split(".")[1];
  assert.ok(!decimalPart || decimalPart.length <= 2);
});

test("an empty dataset produces a fully serializable report with status EMPTY", () => {
  const report = buildLearningReport({ datasetId: "ds", records: [] }, CONFIG, { reportId: "r1", ...windows(0, 0) });
  assert.equal(report.status, "EMPTY");
  assert.doesNotThrow(() => JSON.stringify(report));
});

test("extreme but valid inputs (probability exactly 0/1, confidence 0/100) are handled without producing NaN", () => {
  const records = [
    record("m1", { sequenceKey: 0, probabilities: { homeWin: 1, draw: 0, awayWin: 0 }, confidence: 0 }),
    record("m2", { sequenceKey: 1, probabilities: { homeWin: 0, draw: 0, awayWin: 1 }, confidence: 100, actualOutcome: "AWAY_WIN" }),
  ];
  const report = buildLearningReport({ datasetId: "ds", records }, CONFIG, {
    reportId: "r1",
    baselineWindow: { label: "b", fromSequenceKey: 0, toSequenceKey: 0 },
    currentWindow: { label: "c", fromSequenceKey: 1, toSequenceKey: 1 },
  });
  assert.ok(!JSON.stringify(report).includes("NaN"));
});

test("non-finite values in the input are rejected as invalid records, never silently propagated", () => {
  const records = [
    record("m1", { sequenceKey: 0, probabilities: { homeWin: Number.NaN, draw: 0.5, awayWin: 0.5 } }),
    record("m2", { sequenceKey: 1 }),
  ];
  const report = buildLearningReport({ datasetId: "ds", records }, CONFIG, {
    reportId: "r1",
    baselineWindow: { label: "b", fromSequenceKey: 0, toSequenceKey: 0 },
    currentWindow: { label: "c", fromSequenceKey: 1, toSequenceKey: 1 },
  });
  assert.equal(report.datasetSummary.validRecords, 1);
});

test("integrates with the historical profiles, window comparisons, drift signals, and reliability rankings all present", () => {
  const report = buildLearningReport(buildDataset(10), CONFIG, { reportId: "r1", ...windows(5, 10) });
  assert.ok(report.historicalProfiles.length > 0);
  assert.equal(report.windowComparisons.length, 1);
  assert.ok(Array.isArray(report.driftSignals));
  assert.ok(Array.isArray(report.reliabilityRankings.entries));
});

test("no reference to odds, ROI, EV, Kelly, or stake anywhere in a real report's serialized output", () => {
  const report = buildLearningReport(buildDataset(10), CONFIG, { reportId: "r1", ...windows(5, 10) });
  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of ["odds", "stake", "kelly", "expectedvalue", "roi", "bookmaker", "wager"]) {
    assert.ok(!serialized.includes(forbidden), `unexpected forbidden term: ${forbidden}`);
  }
});

test("no dependency on Date.now(), Math.random(), or randomUUID: reportId/generatedAt/ids are fully caller/data-derived", () => {
  const report = buildLearningReport(buildDataset(6), CONFIG, { reportId: "r1", generatedAt: null, ...windows(3, 6) });
  assert.equal(report.generatedAt, null);
  for (const signal of report.driftSignals) {
    assert.ok(!/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(signal.id));
  }
});

test("result is the same for a shuffled record order (order-independent aggregation)", () => {
  const dataset = buildDataset(6);
  const shuffled = { datasetId: "ds", records: [...dataset.records].reverse() };
  const a = buildLearningReport(dataset, CONFIG, { reportId: "r1", ...windows(3, 6) });
  const b = buildLearningReport(shuffled, CONFIG, { reportId: "r1", ...windows(3, 6) });
  assert.deepEqual(a.historicalProfiles, b.historicalProfiles);
  assert.deepEqual(a.driftSignals, b.driftSignals);
});
