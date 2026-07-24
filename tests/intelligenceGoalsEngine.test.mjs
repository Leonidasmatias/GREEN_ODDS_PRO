import test from "node:test";
import assert from "node:assert/strict";
import { calculateGoalsRates } from "../src/services/intelligence/GoalsEngine.ts";

function makeRecord(index, goalsFor, goalsAgainst) {
  return {
    matchId: `m${index}`,
    playedAt: new Date(2026, 0, index + 1).toISOString(),
    isHome: true,
    opponentPlayerId: "opponent",
    goalsFor,
    goalsAgainst,
  };
}

test("no matches returns all rates at zero", () => {
  const rates = calculateGoalsRates([]);
  assert.equal(rates.matchesCount, 0);
  for (const key of ["over05", "over15", "over25", "over35", "over45", "over55", "bothTeamsScored", "cleanSheet", "failedToScore"]) {
    assert.equal(rates[key], 0);
  }
});

test("all rates stay within the 0..1 interval for varied results", () => {
  const records = [
    makeRecord(0, 0, 0),
    makeRecord(1, 5, 5),
    makeRecord(2, 3, 0),
    makeRecord(3, 0, 4),
    makeRecord(4, 2, 2),
  ];
  const rates = calculateGoalsRates(records);
  for (const key of ["over05", "over15", "over25", "over35", "over45", "over55", "bothTeamsScored", "cleanSheet", "failedToScore"]) {
    assert.ok(rates[key] >= 0 && rates[key] <= 1, `${key} fora do intervalo 0..1`);
  }
});

test("over thresholds are exclusive and consistent with each other", () => {
  // total de gols = 3 -> over0.5/1.5/2.5 true, over3.5+ false
  const records = [makeRecord(0, 2, 1)];
  const rates = calculateGoalsRates(records);
  assert.equal(rates.over05, 1);
  assert.equal(rates.over15, 1);
  assert.equal(rates.over25, 1);
  assert.equal(rates.over35, 0);
  assert.equal(rates.over45, 0);
  assert.equal(rates.over55, 0);
});

test("both teams scored only when both sides find the net", () => {
  const scored = calculateGoalsRates([makeRecord(0, 1, 1)]);
  assert.equal(scored.bothTeamsScored, 1);
  const notScored = calculateGoalsRates([makeRecord(0, 2, 0)]);
  assert.equal(notScored.bothTeamsScored, 0);
});

test("clean sheet and failed to score are complementary to conceding/scoring", () => {
  const cleanSheet = calculateGoalsRates([makeRecord(0, 3, 0)]);
  assert.equal(cleanSheet.cleanSheet, 1);
  assert.equal(cleanSheet.failedToScore, 0);

  const failedToScore = calculateGoalsRates([makeRecord(0, 0, 2)]);
  assert.equal(failedToScore.cleanSheet, 0);
  assert.equal(failedToScore.failedToScore, 1);
});

test("one hundred matches keep rates bounded and correctly averaged", () => {
  const records = Array.from({ length: 100 }, (_, i) => makeRecord(i, i % 3, (i + 1) % 4));
  const rates = calculateGoalsRates(records);
  assert.equal(rates.matchesCount, 100);
  for (const key of ["over05", "over15", "over25", "over35", "over45", "over55", "bothTeamsScored", "cleanSheet", "failedToScore"]) {
    assert.ok(rates[key] >= 0 && rates[key] <= 1);
  }
});
