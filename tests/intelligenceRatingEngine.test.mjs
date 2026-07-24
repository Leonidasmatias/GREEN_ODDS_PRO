import test from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_RATING,
  K_FACTOR,
  calculateExpectedScore,
  calculateNewRatings,
  applyMatch,
  batchRecalculate,
} from "../src/services/intelligence/RatingEngine.ts";

test("initial rating and K factor match Fase 1.5 configuration", () => {
  assert.equal(INITIAL_RATING, 1500);
  assert.equal(K_FACTOR, 20);
});

test("expected score is 0.5 for equal ratings", () => {
  assert.equal(calculateExpectedScore(1500, 1500), 0.5);
});

test("expected score favors the higher rated player", () => {
  const expected = calculateExpectedScore(1600, 1400);
  assert.ok(expected > 0.5 && expected < 1);
});

test("expected scores for both sides sum to 1", () => {
  const a = calculateExpectedScore(1550, 1450);
  const b = calculateExpectedScore(1450, 1550);
  assert.ok(Math.abs(a + b - 1) < 1e-9);
});

test("equal ratings: winner gains K/2, loser loses K/2", () => {
  const { ratingA, ratingB } = calculateNewRatings(1500, 1500, "WIN");
  assert.equal(ratingA, 1510);
  assert.equal(ratingB, 1490);
});

test("draw between equal ratings does not change anything", () => {
  const { ratingA, ratingB } = calculateNewRatings(1500, 1500, "DRAW");
  assert.equal(ratingA, 1500);
  assert.equal(ratingB, 1500);
});

test("applyMatch derives result from the scoreline", () => {
  const win = applyMatch({ homeRatingBefore: 1500, awayRatingBefore: 1500, homeGoals: 2, awayGoals: 0 });
  assert.ok(win.homeRating > 1500 && win.awayRating < 1500);

  const draw = applyMatch({ homeRatingBefore: 1500, awayRatingBefore: 1500, homeGoals: 1, awayGoals: 1 });
  assert.equal(draw.homeRating, 1500);
  assert.equal(draw.awayRating, 1500);

  const loss = applyMatch({ homeRatingBefore: 1500, awayRatingBefore: 1500, homeGoals: 0, awayGoals: 3 });
  assert.ok(loss.homeRating < 1500 && loss.awayRating > 1500);
});

test("batchRecalculate with no matches returns an empty map", () => {
  const result = batchRecalculate([]);
  assert.equal(result.size, 0);
});

test("batchRecalculate with one match updates both players from the initial rating", () => {
  const result = batchRecalculate([
    { matchId: "m1", playedAt: "2026-01-01T00:00:00.000Z", homePlayerId: "a", awayPlayerId: "b", homeGoals: 2, awayGoals: 0 },
  ]);
  assert.equal(result.get("a").rating, 1510);
  assert.equal(result.get("b").rating, 1490);
  assert.equal(result.get("a").matchesCount, 1);
  assert.equal(result.get("b").matchesCount, 1);
});

test("batchRecalculate processes matches in chronological order regardless of input order", () => {
  const chronological = [
    { matchId: "m1", playedAt: "2026-01-01T00:00:00.000Z", homePlayerId: "a", awayPlayerId: "b", homeGoals: 1, awayGoals: 0 },
    { matchId: "m2", playedAt: "2026-01-02T00:00:00.000Z", homePlayerId: "a", awayPlayerId: "b", homeGoals: 0, awayGoals: 1 },
  ];
  const reversed = [chronological[1], chronological[0]];
  const resultChrono = batchRecalculate(chronological);
  const resultReversed = batchRecalculate(reversed);
  assert.equal(resultChrono.get("a").rating, resultReversed.get("a").rating);
  assert.equal(resultChrono.get("b").rating, resultReversed.get("b").rating);
});

test("batchRecalculate over 20 matches never leaves ratings undefined", () => {
  const matches = Array.from({ length: 20 }, (_, i) => ({
    matchId: `m${i}`,
    playedAt: new Date(2026, 0, i + 1).toISOString(),
    homePlayerId: "a",
    awayPlayerId: "b",
    homeGoals: i % 3,
    awayGoals: (i + 1) % 3,
  }));
  const result = batchRecalculate(matches);
  assert.equal(result.get("a").matchesCount, 20);
  assert.equal(result.get("b").matchesCount, 20);
  assert.ok(Number.isFinite(result.get("a").rating));
  assert.ok(Number.isFinite(result.get("b").rating));
});
