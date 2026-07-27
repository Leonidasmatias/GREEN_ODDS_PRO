import test from "node:test";
import assert from "node:assert/strict";
import { buildHistoricalProfiles, computeHistoricalProfiles } from "../src/services/prediction-learning/HistoricalProfileEngine.ts";
import { DEFAULT_PREDICTION_LEARNING_CONFIG } from "../src/services/prediction-learning/PredictionLearningConfig.ts";

function record(matchId, overrides = {}) {
  return {
    matchId,
    homePlayerId: "home",
    awayPlayerId: "away",
    virtualTeamHome: null,
    virtualTeamAway: null,
    league: null,
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

const CONFIG = { ...DEFAULT_PREDICTION_LEARNING_CONFIG, minimumRecordsPerProfile: 1 };

test("a valid dataset produces status OK and non-empty profiles", () => {
  const records = Array.from({ length: 5 }, (_, i) => record(`m${i}`));
  const result = buildHistoricalProfiles(records, CONFIG);
  assert.equal(result.status, "OK");
  assert.equal(result.validRecords.length, 5);
  assert.ok(result.profiles.length > 0);
});

test("an empty dataset yields status EMPTY with an EMPTY_DATASET warning", () => {
  const result = buildHistoricalProfiles([], CONFIG);
  assert.equal(result.status, "EMPTY");
  assert.ok(result.warnings.some((w) => w.code === "EMPTY_DATASET"));
  assert.equal(result.profiles.length, 0);
});

test("a single valid record is processed without error", () => {
  const result = buildHistoricalProfiles([record("m1")], CONFIG);
  assert.equal(result.validRecords.length, 1);
  assert.equal(result.status, "OK");
});

test("invalid probabilities are excluded under the default (skip) policy, with a warning", () => {
  const records = [record("m1", { probabilities: { homeWin: 0.9, draw: 0.9, awayWin: 0.9 } })];
  const result = buildHistoricalProfiles(records, { ...CONFIG, invalidRecordPolicy: "skip" });
  assert.equal(result.validRecords.length, 0);
  assert.ok(result.warnings.some((w) => w.code === "INVALID_RECORD_EXCLUDED"));
});

test("an invalid sequenceKey type (not string/number/null) is rejected as invalid", () => {
  const records = [record("m1", { sequenceKey: true })];
  const result = buildHistoricalProfiles(records, CONFIG);
  assert.equal(result.validRecords.length, 0);
  assert.ok(result.warnings.some((w) => w.code === "INVALID_RECORD_EXCLUDED" && w.details?.includes("invalid_sequenceKey_type")));
});

test("CONFIDENCE_BUCKET excludes a record whose confidence falls outside every configured bucket boundary", () => {
  const records = [record("m1", { league: "a", confidence: 15 })];
  // Directly exercises computeHistoricalProfiles (already-valid records) with a boundary set that
  // does not cover the record's confidence, since findInvalidLearningReason only enforces [0,100].
  const profiles = computeHistoricalProfiles(records, { ...CONFIG, confidenceBuckets: [20, 100] });
  const confidenceProfiles = profiles.filter((p) => p.dimension === "CONFIDENCE_BUCKET");
  assert.equal(confidenceProfiles.reduce((sum, p) => sum + p.totalRecords, 0), 0);
});

test("NaN/Infinity probabilities are rejected as invalid, never silently coerced", () => {
  const records = [record("m1", { probabilities: { homeWin: Number.NaN, draw: 0.5, awayWin: 0.5 } })];
  const result = buildHistoricalProfiles(records, CONFIG);
  assert.equal(result.validRecords.length, 0);
});

test("does not mutate the input records array or its contents", () => {
  const records = [record("m1"), record("m2")];
  const snapshot = JSON.parse(JSON.stringify(records));
  buildHistoricalProfiles(records, CONFIG);
  assert.deepEqual(records, snapshot);
});

test("global profile aggregates across the full valid dataset", () => {
  const records = [record("m1", { actualOutcome: "HOME_WIN" }), record("m2", { predictedOutcome: "AWAY_WIN", probabilities: { homeWin: 0, draw: 0, awayWin: 1 }, actualOutcome: "AWAY_WIN" })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const globalProfile = result.profiles.find((p) => p.dimension === "GLOBAL");
  assert.ok(globalProfile);
  assert.equal(globalProfile.key, "GLOBAL");
  assert.equal(globalProfile.metrics.totalRecords, 2);
  assert.equal(globalProfile.metrics.correct, 2);
});

test("player profile groups each match under both home and away player", () => {
  const records = [record("m1", { homePlayerId: "alice", awayPlayerId: "bob" }), record("m2", { homePlayerId: "carol", awayPlayerId: "bob" })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const bobProfile = result.profiles.find((p) => p.dimension === "PLAYER" && p.key === "bob");
  assert.ok(bobProfile);
  assert.equal(bobProfile.totalRecords, 2);
});

test("league profile groups by league, excluding null leagues", () => {
  const records = [record("m1", { league: "league-a" }), record("m2", { league: null })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const leagueProfiles = result.profiles.filter((p) => p.dimension === "LEAGUE");
  assert.equal(leagueProfiles.length, 1);
  assert.equal(leagueProfiles[0].key, "league-a");
});

test("virtual team profile groups by home and away virtual team, excluding null teams", () => {
  const records = [record("m1", { virtualTeamHome: "Bologna", virtualTeamAway: "Roma" }), record("m2", { virtualTeamHome: null, virtualTeamAway: null })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const virtualTeamProfiles = result.profiles.filter((p) => p.dimension === "VIRTUAL_TEAM");
  assert.equal(virtualTeamProfiles.length, 2);
  assert.deepEqual(virtualTeamProfiles.map((p) => p.key).sort(), ["Bologna", "Roma"]);
});

test("HOME_AWAY profile splits into HOME/AWAY/NEUTRAL by predicted outcome", () => {
  const records = [record("m1", { predictedOutcome: "HOME_WIN" }), record("m2", { predictedOutcome: "AWAY_WIN" }), record("m3", { predictedOutcome: "DRAW" })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const homeAwayProfiles = result.profiles.filter((p) => p.dimension === "HOME_AWAY");
  assert.equal(homeAwayProfiles.length, 3);
  assert.equal(homeAwayProfiles.find((p) => p.key === "HOME").totalRecords, 1);
  assert.equal(homeAwayProfiles.find((p) => p.key === "AWAY").totalRecords, 1);
  assert.equal(homeAwayProfiles.find((p) => p.key === "NEUTRAL").totalRecords, 1);
});

test("period profile groups by period, excluding null periods", () => {
  const records = [record("m1", { period: "2026-06" }), record("m2", { period: null })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const periodProfiles = result.profiles.filter((p) => p.dimension === "PERIOD");
  assert.equal(periodProfiles.length, 1);
  assert.equal(periodProfiles[0].key, "2026-06");
});

test("PREDICTED_OUTCOME profile always reports all three outcomes, even with zero sample", () => {
  const records = [record("m1", { predictedOutcome: "HOME_WIN" })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const predictedOutcomeProfiles = result.profiles.filter((p) => p.dimension === "PREDICTED_OUTCOME");
  assert.equal(predictedOutcomeProfiles.length, 3);
  const drawProfile = predictedOutcomeProfiles.find((p) => p.key === "DRAW");
  assert.equal(drawProfile.totalRecords, 0);
  assert.equal(drawProfile.status, "EMPTY");
});

test("GREEN_SCORE profile always reports all four categories, even with zero sample", () => {
  const records = [record("m1", { greenScoreCategory: "HIGH" })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const greenScoreProfiles = result.profiles.filter((p) => p.dimension === "GREEN_SCORE");
  assert.equal(greenScoreProfiles.length, 4);
  const lowProfile = greenScoreProfiles.find((p) => p.key === "LOW");
  assert.equal(lowProfile.totalRecords, 0);
});

test("CONFIDENCE_BUCKET profile assigns records to the correct configured bucket", () => {
  const records = [record("m1", { confidence: 15 }), record("m2", { confidence: 85 })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const lowBucket = result.profiles.find((p) => p.dimension === "CONFIDENCE_BUCKET" && p.key === "0-20");
  const highBucket = result.profiles.find((p) => p.dimension === "CONFIDENCE_BUCKET" && p.key === "80-100");
  assert.equal(lowBucket.totalRecords, 1);
  assert.equal(highBucket.totalRecords, 1);
});

test("a profile below minimumRecordsPerProfile is flagged INSUFFICIENT_SAMPLE with a warning", () => {
  const records = [record("m1", { league: "small-league" })];
  const config = { ...CONFIG, minimumRecordsPerProfile: 5 };
  const result = buildHistoricalProfiles(records, config);
  const leagueProfile = result.profiles.find((p) => p.dimension === "LEAGUE" && p.key === "small-league");
  assert.equal(leagueProfile.status, "INSUFFICIENT_SAMPLE");
  assert.ok(leagueProfile.warnings.some((w) => w.code === "PROFILE_INSUFFICIENT_SAMPLE"));
});

test("profiles are ordered deterministically: fixed dimension order, then alphabetical key within dimension", () => {
  const records = [record("m1", { league: "zeta" }), record("m2", { league: "alpha" })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const leagueProfiles = result.profiles.filter((p) => p.dimension === "LEAGUE");
  assert.deepEqual(leagueProfiles.map((p) => p.key), ["alpha", "zeta"]);
});

test("firstSequenceKey/lastSequenceKey reflect the min/max sequenceKey within a profile", () => {
  const records = [record("m1", { league: "a", sequenceKey: 5 }), record("m2", { league: "a", sequenceKey: 1 }), record("m3", { league: "a", sequenceKey: 3 })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const leagueProfile = result.profiles.find((p) => p.dimension === "LEAGUE" && p.key === "a");
  assert.equal(leagueProfile.firstSequenceKey, 1);
  assert.equal(leagueProfile.lastSequenceKey, 5);
});

test("firstSequenceKey/lastSequenceKey are null when sequenceKey types are mixed within a profile", () => {
  const records = [record("m1", { league: "a", sequenceKey: 1 }), record("m2", { league: "a", sequenceKey: "2026-01-01" })];
  const result = buildHistoricalProfiles(records, CONFIG);
  const leagueProfile = result.profiles.find((p) => p.dimension === "LEAGUE" && p.key === "a");
  assert.equal(leagueProfile.firstSequenceKey, null);
  assert.equal(leagueProfile.lastSequenceKey, null);
  assert.ok(leagueProfile.warnings.some((w) => w.code === "MIXED_SEQUENCE_KEY_TYPES"));
});

test("policy 'reject': any data issue halts profile building, producing status REJECTED with zero profiles", () => {
  const records = [record("m1"), record("m2", { probabilities: { homeWin: 5, draw: 0.5, awayWin: 0.5 } })];
  const result = buildHistoricalProfiles(records, { ...CONFIG, invalidRecordPolicy: "reject" });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.profiles.length, 0);
});

test("policy 'skip': invalid records are ignored (warned) but profile building proceeds over the rest", () => {
  const records = [record("m1"), record("m2", { probabilities: { homeWin: 5, draw: 0.5, awayWin: 0.5 } })];
  const result = buildHistoricalProfiles(records, { ...CONFIG, invalidRecordPolicy: "skip" });
  assert.equal(result.status, "OK");
  assert.equal(result.validRecords.length, 1);
  assert.equal(result.rejectedRecords.length, 0);
});

test("policy 'collect': invalid records are recorded in rejectedRecords without halting", () => {
  const records = [record("m1"), record("m2", { probabilities: { homeWin: 5, draw: 0.5, awayWin: 0.5 } })];
  const result = buildHistoricalProfiles(records, { ...CONFIG, invalidRecordPolicy: "collect" });
  assert.equal(result.status, "OK");
  assert.ok(result.rejectedRecords.some((r) => r.matchId === "m2"));
});

test("duplicate matchIds: the first occurrence is kept, later ones are flagged", () => {
  const records = [record("m1", { predictedOutcome: "HOME_WIN" }), record("m1", { predictedOutcome: "AWAY_WIN" })];
  const result = buildHistoricalProfiles(records, CONFIG);
  assert.equal(result.validRecords.length, 1);
  assert.equal(result.validRecords[0].predictedOutcome, "HOME_WIN");
  assert.ok(result.warnings.some((w) => w.code === "DUPLICATE_MATCH_ID"));
});

test("a dataset entirely below minimumRecordsPerProfile (global) yields INSUFFICIENT_SAMPLE with a warning", () => {
  const config = { ...CONFIG, minimumRecordsPerProfile: 10 };
  const result = buildHistoricalProfiles([record("m1")], config);
  assert.equal(result.status, "INSUFFICIENT_SAMPLE");
  assert.ok(result.warnings.some((w) => w.code === "INSUFFICIENT_SAMPLE_SIZE"));
});

test("only enabled dimensions are computed", () => {
  const records = [record("m1", { league: "league-a" })];
  const config = { ...CONFIG, enabledDimensions: ["GLOBAL", "LEAGUE"] };
  const result = buildHistoricalProfiles(records, config);
  assert.ok(result.profiles.every((p) => p.dimension === "GLOBAL" || p.dimension === "LEAGUE"));
});

test("is deterministic for identical input, regardless of computeHistoricalProfiles vs buildHistoricalProfiles", () => {
  const records = [record("m1", { league: "a" }), record("m2", { league: "b" })];
  const first = buildHistoricalProfiles(records, CONFIG);
  const second = buildHistoricalProfiles(records, CONFIG);
  assert.deepEqual(first, second);
  assert.deepEqual(computeHistoricalProfiles(records, CONFIG), computeHistoricalProfiles(records, CONFIG));
});

test("result is the same for a shuffled input order (order-independent aggregation)", () => {
  const records = [record("m1", { league: "a" }), record("m2", { league: "a" }), record("m3", { league: "b" })];
  const shuffled = [records[2], records[0], records[1]];
  const a = buildHistoricalProfiles(records, CONFIG);
  const b = buildHistoricalProfiles(shuffled, CONFIG);
  assert.deepEqual(
    a.profiles.map((p) => ({ dimension: p.dimension, key: p.key, metrics: p.metrics })),
    b.profiles.map((p) => ({ dimension: p.dimension, key: p.key, metrics: p.metrics })),
  );
});
