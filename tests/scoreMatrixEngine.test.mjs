import test from "node:test";
import assert from "node:assert/strict";
import { buildScoreMatrix, extractExactScores, rankExactScores } from "../src/services/goal-distribution/ScoreMatrixEngine.ts";
import { buildPoissonDistribution } from "../src/services/goal-distribution/PoissonDistribution.ts";

test("buildScoreMatrix has the correct dimensions for a given maxGoals", () => {
  const home = buildPoissonDistribution(1.5, 10);
  const away = buildPoissonDistribution(1.2, 10);
  const matrix = buildScoreMatrix(home, away);
  assert.equal(matrix.length, 11);
  for (const row of matrix) assert.equal(row.length, 11);
});

test("buildScoreMatrix supports at least 0-0 through 10-10", () => {
  const home = buildPoissonDistribution(2, 10);
  const away = buildPoissonDistribution(2, 10);
  const matrix = buildScoreMatrix(home, away);
  assert.ok(matrix[0][0] >= 0);
  assert.ok(matrix[10][10] >= 0);
});

test("buildScoreMatrix sums to 1 within tolerance", () => {
  const home = buildPoissonDistribution(1.8, 10);
  const away = buildPoissonDistribution(1.3, 10);
  const matrix = buildScoreMatrix(home, away);
  const sum = matrix.flat().reduce((total, cell) => total + cell, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("buildScoreMatrix falls back to an all-zero matrix (never NaN/divide-by-zero) for a degenerate all-zero input distribution", () => {
  // A real `buildPoissonDistribution` output is never all-zero (k=0
  // always carries at least the safe fallback mass), but the matrix
  // builder must still defend against a synthetic/degenerate input whose
  // total is exactly 0, rather than dividing by zero.
  const allZero = [
    { goals: 0, probability: 0 },
    { goals: 1, probability: 0 },
  ];
  const matrix = buildScoreMatrix(allZero, allZero);
  assert.equal(matrix.length, 2);
  for (const row of matrix) {
    assert.equal(row.length, 2);
    for (const cell of row) {
      assert.equal(cell, 0);
      assert.equal(Number.isNaN(cell), false);
    }
  }
});

test("buildScoreMatrix never produces a negative cell", () => {
  const home = buildPoissonDistribution(3, 10);
  const away = buildPoissonDistribution(0.2, 10);
  const matrix = buildScoreMatrix(home, away);
  for (const row of matrix) for (const cell of row) assert.ok(cell >= 0);
});

test("draw probability aggregates correctly (sum of the diagonal)", () => {
  const home = buildPoissonDistribution(1.5, 10);
  const away = buildPoissonDistribution(1.5, 10);
  const matrix = buildScoreMatrix(home, away);
  let diagonalSum = 0;
  for (let i = 0; i < matrix.length; i += 1) diagonalSum += matrix[i][i];
  const scores = extractExactScores(matrix);
  const drawSum = scores.filter((s) => s.homeGoals === s.awayGoals).reduce((sum, s) => sum + s.probability, 0);
  assert.ok(Math.abs(diagonalSum - drawSum) < 1e-12);
});

test("home win probability aggregates correctly (sum where home > away)", () => {
  const home = buildPoissonDistribution(3, 10);
  const away = buildPoissonDistribution(0.5, 10);
  const matrix = buildScoreMatrix(home, away);
  const scores = extractExactScores(matrix);
  const homeWinSum = scores.filter((s) => s.homeGoals > s.awayGoals).reduce((sum, s) => sum + s.probability, 0);
  assert.ok(homeWinSum > 0.5, "a strongly favored home side should have home win mass > 0.5");
});

test("away win probability aggregates correctly (sum where away > home)", () => {
  const home = buildPoissonDistribution(0.5, 10);
  const away = buildPoissonDistribution(3, 10);
  const matrix = buildScoreMatrix(home, away);
  const scores = extractExactScores(matrix);
  const awayWinSum = scores.filter((s) => s.awayGoals > s.homeGoals).reduce((sum, s) => sum + s.probability, 0);
  assert.ok(awayWinSum > 0.5, "a strongly favored away side should have away win mass > 0.5");
});

test("extractExactScores produces (maxGoals+1)^2 entries with correct totalGoals", () => {
  const home = buildPoissonDistribution(1, 5);
  const away = buildPoissonDistribution(1, 5);
  const matrix = buildScoreMatrix(home, away);
  const scores = extractExactScores(matrix);
  assert.equal(scores.length, 36);
  for (const score of scores) assert.equal(score.totalGoals, score.homeGoals + score.awayGoals);
});

test("the most likely score for identical, moderate lambdas is 1-1", () => {
  const home = buildPoissonDistribution(1.3, 10);
  const away = buildPoissonDistribution(1.3, 10);
  const matrix = buildScoreMatrix(home, away);
  const ranked = rankExactScores(extractExactScores(matrix), 1);
  assert.equal(ranked[0].homeGoals, 1);
  assert.equal(ranked[0].awayGoals, 1);
});

test("rankExactScores tie-break: equal probability resolves by lower total goals first", () => {
  const scores = [
    { homeGoals: 2, awayGoals: 2, totalGoals: 4, probability: 0.05 },
    { homeGoals: 0, awayGoals: 1, totalGoals: 1, probability: 0.05 },
    { homeGoals: 1, awayGoals: 0, totalGoals: 1, probability: 0.05 },
  ];
  const ranked = rankExactScores(scores, 3);
  assert.equal(ranked[0].totalGoals, 1);
  assert.equal(ranked[1].totalGoals, 1);
  assert.equal(ranked[2].totalGoals, 4);
});

test("rankExactScores tie-break: equal probability and total goals resolves by lower home goals", () => {
  const scores = [
    { homeGoals: 1, awayGoals: 0, totalGoals: 1, probability: 0.05 },
    { homeGoals: 0, awayGoals: 1, totalGoals: 1, probability: 0.05 },
  ];
  const ranked = rankExactScores(scores, 2);
  assert.equal(ranked[0].homeGoals, 0);
  assert.equal(ranked[0].awayGoals, 1);
  assert.equal(ranked[1].homeGoals, 1);
});

test("rankExactScores tie-break: equal probability, totalGoals, and homeGoals resolves by lower awayGoals", () => {
  // A real, internally-consistent exact-score list can never have two
  // entries share totalGoals AND homeGoals with different awayGoals
  // (awayGoals = totalGoals - homeGoals is then forced identical too) —
  // this synthetic, deliberately inconsistent pair exists purely to
  // exercise the fourth and final tie-break level of the comparator in
  // isolation.
  const scores = [
    { homeGoals: 1, awayGoals: 2, totalGoals: 3, probability: 0.02 },
    { homeGoals: 1, awayGoals: 1, totalGoals: 3, probability: 0.02 },
  ];
  const ranked = rankExactScores(scores, 2);
  assert.equal(ranked[0].awayGoals, 1);
  assert.equal(ranked[1].awayGoals, 2);
});

test("rankExactScores respects topN, or returns all scores if topN exceeds the count", () => {
  const home = buildPoissonDistribution(1.5, 5);
  const away = buildPoissonDistribution(1.5, 5);
  const matrix = buildScoreMatrix(home, away);
  const scores = extractExactScores(matrix);
  assert.equal(rankExactScores(scores, 5).length, 5);
  assert.equal(rankExactScores(scores, 10000).length, scores.length);
});

test("rankExactScores ordering is deterministic for the same input", () => {
  const home = buildPoissonDistribution(2.1, 10);
  const away = buildPoissonDistribution(1.4, 10);
  const matrix = buildScoreMatrix(home, away);
  const scores = extractExactScores(matrix);
  const first = rankExactScores(scores, 10);
  const second = rankExactScores(scores, 10);
  assert.deepEqual(first, second);
});
