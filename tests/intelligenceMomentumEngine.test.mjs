import test from "node:test";
import assert from "node:assert/strict";
import { calculateMomentum, MOMENTUM_MIN, MOMENTUM_MAX } from "../src/services/intelligence/MomentumEngine.ts";

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

test("no matches yields a neutral momentum of zero", () => {
  const result = calculateMomentum([]);
  assert.equal(result.momentumScore, 0);
});

test("one match is not enough to diverge meaningfully but never crashes", () => {
  assert.doesNotThrow(() => calculateMomentum([makeRecord(0, 1, 0)]));
});

test("score always stays within -100..100", () => {
  const allWins = Array.from({ length: 20 }, (_, i) => makeRecord(i, 5, 0));
  const allLosses = Array.from({ length: 20 }, (_, i) => makeRecord(i, 0, 5));
  for (const records of [allWins, allLosses, []]) {
    const result = calculateMomentum(records);
    assert.ok(result.momentumScore >= MOMENTUM_MIN && result.momentumScore <= MOMENTUM_MAX);
  }
});

test("recent wins after a long losing streak produce a positive score", () => {
  const oldLosses = Array.from({ length: 15 }, (_, i) => makeRecord(i, 0, 2));
  const recentWins = Array.from({ length: 5 }, (_, i) => makeRecord(15 + i, 2, 0));
  const result = calculateMomentum([...oldLosses, ...recentWins]);
  assert.ok(result.momentumScore > 0, `esperado score positivo, obtido ${result.momentumScore}`);
});

test("recent losses after a long winning streak produce a negative score", () => {
  const oldWins = Array.from({ length: 15 }, (_, i) => makeRecord(i, 2, 0));
  const recentLosses = Array.from({ length: 5 }, (_, i) => makeRecord(15 + i, 0, 2));
  const result = calculateMomentum([...oldWins, ...recentLosses]);
  assert.ok(result.momentumScore < 0, `esperado score negativo, obtido ${result.momentumScore}`);
});

test("consistent form (all draws) produces a score close to zero", () => {
  const records = Array.from({ length: 20 }, (_, i) => makeRecord(i, 1, 1));
  const result = calculateMomentum(records);
  assert.equal(result.momentumScore, 0);
});

test("one hundred matches: momentum still bounded and finite", () => {
  const records = Array.from({ length: 100 }, (_, i) => makeRecord(i, i % 4, (i + 2) % 4));
  const result = calculateMomentum(records);
  assert.ok(Number.isFinite(result.momentumScore));
  assert.ok(result.momentumScore >= MOMENTUM_MIN && result.momentumScore <= MOMENTUM_MAX);
});
