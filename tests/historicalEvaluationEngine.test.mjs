import test from "node:test";
import assert from "node:assert/strict";
import { evaluateHistoricalDataset } from "../src/services/prediction-evaluation/HistoricalEvaluationEngine.ts";
import { DEFAULT_PREDICTION_EVALUATION_CONFIG } from "../src/services/prediction-evaluation/PredictionEvaluationConfig.ts";

function predictionResult({
  homeWin = 0.6,
  draw = 0.25,
  awayWin = 0.15,
  predictedOutcome = "HOME_WIN",
  confidence = 70,
  greenScoreValue = 60,
  greenScoreCategory = "HIGH",
} = {}) {
  return {
    prediction: { probabilities: { homeWin, draw, awayWin }, predictedOutcome, topProbability: Math.max(homeWin, draw, awayWin) },
    confidence,
    greenScore: { score: greenScoreValue, category: greenScoreCategory },
  };
}

function snapshot(matchId, overrides = {}) {
  const { resultOverrides, ...rest } = overrides;
  return {
    matchId,
    homePlayerId: "home",
    awayPlayerId: "away",
    virtualTeamHome: null,
    virtualTeamAway: null,
    league: null,
    period: null,
    sequenceKey: null,
    result: predictionResult(resultOverrides),
    ...rest,
  };
}

function actual(matchId, overrides = {}) {
  return { matchId, outcome: "HOME_WIN", homeGoals: 2, awayGoals: 1, ...overrides };
}

function dataset(predictions, actuals, datasetId = "ds") {
  return { datasetId, predictions, actuals };
}

const CONFIG = DEFAULT_PREDICTION_EVALUATION_CONFIG;

test("a valid dataset with all matched, valid records yields status OK", () => {
  const predictions = Array.from({ length: 5 }, (_, i) => snapshot(`m${i}`));
  const actuals = Array.from({ length: 5 }, (_, i) => actual(`m${i}`));
  const result = evaluateHistoricalDataset(dataset(predictions, actuals), { ...CONFIG, minRecordsForEvaluation: 1 });
  assert.equal(result.status, "OK");
  assert.equal(result.validRecords.length, 5);
  assert.equal(result.datasetSummary.matchedRecords, 5);
});

test("an empty dataset (no predictions, no actuals) yields status EMPTY by default", () => {
  const result = evaluateHistoricalDataset(dataset([], []), CONFIG);
  assert.equal(result.status, "EMPTY");
  assert.ok(result.warnings.some((w) => w.code === "EMPTY_DATASET"));
});

test("an empty dataset yields status REJECTED when emptyDatasetBehavior is REJECT", () => {
  const config = { ...CONFIG, emptyDatasetBehavior: "REJECT" };
  const result = evaluateHistoricalDataset(dataset([], []), config);
  assert.equal(result.status, "REJECTED");
});

test("a single valid record is evaluated without error (even below minRecordsForEvaluation)", () => {
  const result = evaluateHistoricalDataset(dataset([snapshot("m1")], [actual("m1")]), CONFIG);
  assert.equal(result.validRecords.length, 1);
  assert.equal(result.status, "INSUFFICIENT_SAMPLE");
});

test("probabilities of exactly 0 and 1 are accepted as valid", () => {
  const predictions = [snapshot("m1", { resultOverrides: { homeWin: 1, draw: 0, awayWin: 0 } })];
  const result = evaluateHistoricalDataset(dataset(predictions, [actual("m1")]), CONFIG);
  assert.equal(result.validRecords.length, 1);
  assert.equal(result.globalMetrics.brierScore, 0);
});

test("invalid probabilities (do not sum to 1) are excluded under the default (skip) policy, with a warning", () => {
  const predictions = [snapshot("m1", { resultOverrides: { homeWin: 0.9, draw: 0.9, awayWin: 0.9 } })];
  const result = evaluateHistoricalDataset(dataset(predictions, [actual("m1")]), { ...CONFIG, invalidRecordPolicy: "skip" });
  assert.equal(result.validRecords.length, 0);
  assert.ok(result.warnings.some((w) => w.code === "INVALID_RECORD_EXCLUDED"));
  assert.equal(result.rejectedRecords.length, 0);
});

test("NaN/Infinity probabilities are rejected as invalid, never silently coerced", () => {
  const predictions = [snapshot("m1", { resultOverrides: { homeWin: Number.NaN, draw: 0.5, awayWin: 0.5 } })];
  const result = evaluateHistoricalDataset(dataset(predictions, [actual("m1")]), CONFIG);
  assert.equal(result.validRecords.length, 0);
  assert.ok(result.warnings.some((w) => w.code === "INVALID_RECORD_EXCLUDED" && w.details === "invalid_probability_homeWin"));
});

test("does not mutate the input dataset (predictions/actuals arrays and their contents)", () => {
  const predictions = [snapshot("m1")];
  const actuals = [actual("m1")];
  const ds = dataset(predictions, actuals);
  const snapshotCopy = JSON.parse(JSON.stringify(ds));
  evaluateHistoricalDataset(ds, CONFIG);
  assert.deepEqual(ds, snapshotCopy);
});

test("is deterministic: identical input produces identical output on repeated calls", () => {
  const predictions = [snapshot("m1"), snapshot("m2")];
  const actuals = [actual("m1"), actual("m2")];
  const ds = dataset(predictions, actuals);
  const first = evaluateHistoricalDataset(ds, CONFIG);
  const second = evaluateHistoricalDataset(ds, CONFIG);
  assert.deepEqual(first, second);
});

test("duplicate matchIds: the first occurrence is kept, later ones are flagged, never silently overwritten", () => {
  const predictions = [snapshot("m1", { resultOverrides: { predictedOutcome: "HOME_WIN" } }), snapshot("m1", { resultOverrides: { predictedOutcome: "AWAY_WIN" } })];
  const result = evaluateHistoricalDataset(dataset(predictions, [actual("m1")]), CONFIG);
  assert.equal(result.validRecords.length, 1);
  assert.equal(result.validRecords[0].snapshot.result.prediction.predictedOutcome, "HOME_WIN");
  assert.ok(result.warnings.some((w) => w.code === "DUPLICATE_MATCH_ID" && w.matchId === "m1"));
});

test("a prediction without a matching actual result is excluded and flagged, not silently dropped", () => {
  const result = evaluateHistoricalDataset(dataset([snapshot("orphan-pred")], []), CONFIG);
  assert.equal(result.validRecords.length, 0);
  assert.ok(result.warnings.some((w) => w.code === "PREDICTION_WITHOUT_OUTCOME" && w.matchId === "orphan-pred"));
});

test("an actual result without a matching prediction is flagged, not silently dropped", () => {
  const result = evaluateHistoricalDataset(dataset([], [actual("orphan-actual")]), CONFIG);
  assert.ok(result.warnings.some((w) => w.code === "OUTCOME_WITHOUT_PREDICTION" && w.matchId === "orphan-actual"));
});

test("global metrics correctly aggregate across multiple matched, valid records", () => {
  const predictions = [
    snapshot("m1", { resultOverrides: { homeWin: 1, draw: 0, awayWin: 0, predictedOutcome: "HOME_WIN" } }),
    snapshot("m2", { resultOverrides: { homeWin: 0, draw: 0, awayWin: 1, predictedOutcome: "AWAY_WIN" } }),
  ];
  const actuals = [actual("m1", { outcome: "HOME_WIN" }), actual("m2", { outcome: "HOME_WIN" })];
  const result = evaluateHistoricalDataset(dataset(predictions, actuals), CONFIG);
  assert.equal(result.globalMetrics.correct, 1);
  assert.equal(result.globalMetrics.incorrect, 1);
  assert.equal(result.globalMetrics.accuracy, 0.5);
});

test("a dataset entirely below minRecordsForEvaluation yields INSUFFICIENT_SAMPLE with a warning", () => {
  const config = { ...CONFIG, minRecordsForEvaluation: 10 };
  const result = evaluateHistoricalDataset(dataset([snapshot("m1")], [actual("m1")]), config);
  assert.equal(result.status, "INSUFFICIENT_SAMPLE");
  assert.ok(result.warnings.some((w) => w.code === "INSUFFICIENT_SAMPLE_SIZE"));
});

test("policy 'reject': any data issue halts evaluation, producing status REJECTED with zero valid records", () => {
  const predictions = [snapshot("m1"), snapshot("orphan")];
  const actuals = [actual("m1")];
  const result = evaluateHistoricalDataset(dataset(predictions, actuals), { ...CONFIG, invalidRecordPolicy: "reject" });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.validRecords.length, 0);
});

test("policy 'skip': invalid/orphan records are ignored (warned) but evaluation proceeds over the rest", () => {
  const predictions = [snapshot("m1"), snapshot("orphan")];
  const actuals = [actual("m1")];
  const result = evaluateHistoricalDataset(dataset(predictions, actuals), { ...CONFIG, invalidRecordPolicy: "skip", minRecordsForEvaluation: 1 });
  assert.equal(result.status, "OK");
  assert.equal(result.validRecords.length, 1);
  assert.equal(result.rejectedRecords.length, 0);
});

test("policy 'collect': invalid/orphan records are recorded in rejectedRecords without halting evaluation", () => {
  const predictions = [snapshot("m1"), snapshot("orphan")];
  const actuals = [actual("m1")];
  const result = evaluateHistoricalDataset(dataset(predictions, actuals), { ...CONFIG, invalidRecordPolicy: "collect", minRecordsForEvaluation: 1 });
  assert.equal(result.status, "OK");
  assert.equal(result.validRecords.length, 1);
  assert.ok(result.rejectedRecords.some((r) => r.matchId === "orphan" && r.reason === "prediction_without_outcome"));
});

test("policy 'collect': a malformed (invalid-probability) record is recorded in rejectedRecords, distinct from an orphan", () => {
  const predictions = [snapshot("m1"), snapshot("malformed", { resultOverrides: { homeWin: 5, draw: 0.5, awayWin: 0.5 } })];
  const actuals = [actual("m1"), actual("malformed")];
  const result = evaluateHistoricalDataset(dataset(predictions, actuals), { ...CONFIG, invalidRecordPolicy: "collect", minRecordsForEvaluation: 1 });
  assert.equal(result.status, "OK");
  assert.equal(result.validRecords.length, 1);
  assert.ok(result.rejectedRecords.some((r) => r.matchId === "malformed" && r.reason === "invalid_probability_homeWin"));
});

test("global metrics are consistent with metrics recomputed independently from the same valid records", () => {
  const predictions = [snapshot("m1"), snapshot("m2", { resultOverrides: { predictedOutcome: "AWAY_WIN", homeWin: 0, draw: 0, awayWin: 1 } })];
  const actuals = [actual("m1"), actual("m2")];
  const result = evaluateHistoricalDataset(dataset(predictions, actuals), CONFIG);
  assert.equal(result.globalMetrics.validRecords, result.validRecords.length);
  assert.equal(result.globalMetrics.totalRecords, 2);
});

test("a partially-invalid dataset (mix of valid, orphan, and malformed records) is handled without crashing, isolating only the bad records", () => {
  const predictions = [
    snapshot("valid-1"),
    snapshot("malformed", { resultOverrides: { homeWin: 5, draw: 0.5, awayWin: 0.5 } }),
    snapshot("orphan-pred"),
  ];
  const actuals = [actual("valid-1"), actual("malformed"), actual("orphan-actual")];
  const result = evaluateHistoricalDataset(dataset(predictions, actuals), { ...CONFIG, minRecordsForEvaluation: 1 });
  assert.equal(result.validRecords.length, 1);
  assert.equal(result.validRecords[0].snapshot.matchId, "valid-1");
  assert.ok(result.warnings.some((w) => w.code === "INVALID_RECORD_EXCLUDED" && w.matchId === "malformed"));
  assert.ok(result.warnings.some((w) => w.code === "PREDICTION_WITHOUT_OUTCOME" && w.matchId === "orphan-pred"));
  assert.ok(result.warnings.some((w) => w.code === "OUTCOME_WITHOUT_PREDICTION" && w.matchId === "orphan-actual"));
});
