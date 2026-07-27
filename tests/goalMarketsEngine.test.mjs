import test from "node:test";
import assert from "node:assert/strict";
import {
  computeGoalLineProbability,
  computeOverUnder,
  computeBothTeamsToScore,
  computeScoreDerivedOutcomeProbabilities,
} from "../src/services/goal-distribution/GoalMarketsEngine.ts";
import { buildScoreMatrix } from "../src/services/goal-distribution/ScoreMatrixEngine.ts";
import { buildPoissonDistribution } from "../src/services/goal-distribution/PoissonDistribution.ts";
import { DEFAULT_OVER_UNDER_LINES } from "../src/services/goal-distribution/GoalDistributionConfig.ts";

function matrixFor(homeLambda, awayLambda, maxGoals = 10) {
  return buildScoreMatrix(buildPoissonDistribution(homeLambda, maxGoals), buildPoissonDistribution(awayLambda, maxGoals));
}

test("Under 2.5 means total goals <= 2, Over 2.5 means total goals >= 3", () => {
  const matrix = matrixFor(1.3, 1.1);
  const { over, under } = computeGoalLineProbability(matrix, 2.5);
  let expectedUnder = 0;
  for (let h = 0; h < matrix.length; h += 1) {
    for (let a = 0; a < matrix[h].length; a += 1) {
      if (h + a <= 2) expectedUnder += matrix[h][a];
    }
  }
  assert.ok(Math.abs(under - expectedUnder) < 1e-12);
  assert.ok(Math.abs(over - (1 - expectedUnder)) < 1e-12);
});

test("over + under sum to 1 within Number.EPSILON for every default line", () => {
  const matrix = matrixFor(1.8, 1.4);
  for (const line of DEFAULT_OVER_UNDER_LINES) {
    const { over, under } = computeGoalLineProbability(matrix, line);
    assert.ok(Math.abs(over + under - 1) <= Number.EPSILON, `line=${line}`);
  }
});

test("computeOverUnder returns one entry per configured line, each carrying its own line value", () => {
  const matrix = matrixFor(1.5, 1.5);
  const results = computeOverUnder(matrix, DEFAULT_OVER_UNDER_LINES);
  assert.equal(results.length, DEFAULT_OVER_UNDER_LINES.length);
  results.forEach((result, index) => assert.equal(result.line, DEFAULT_OVER_UNDER_LINES[index]));
});

test("a low-scoring distribution has high Under probability at low lines", () => {
  const matrix = matrixFor(0.3, 0.2);
  const { over } = computeGoalLineProbability(matrix, 0.5);
  assert.ok(over < 0.5);
});

test("a high-scoring distribution has high Over probability even at high lines", () => {
  const matrix = matrixFor(4, 4);
  const { over } = computeGoalLineProbability(matrix, 3.5);
  assert.ok(over > 0.5);
});

test("an additional, non-standard configurable line works correctly", () => {
  const matrix = matrixFor(2, 2);
  const { line, over, under } = computeGoalLineProbability(matrix, 10.5);
  assert.equal(line, 10.5);
  assert.ok(Math.abs(over + under - 1) <= Number.EPSILON);
});

test("BTTS yes + no sum to 1 within Number.EPSILON", () => {
  const matrix = matrixFor(1.6, 1.3);
  const { yes, no } = computeBothTeamsToScore(matrix);
  assert.ok(Math.abs(yes + no - 1) <= Number.EPSILON);
});

test("BTTS yes matches the exact definition: homeGoals > 0 && awayGoals > 0", () => {
  const matrix = matrixFor(1.5, 1.2);
  const { yes } = computeBothTeamsToScore(matrix);
  let expectedYes = 0;
  for (let h = 1; h < matrix.length; h += 1) {
    for (let a = 1; a < matrix[h].length; a += 1) {
      expectedYes += matrix[h][a];
    }
  }
  assert.ok(Math.abs(yes - expectedYes) < 1e-12);
});

test("a high-scoring scenario has high BTTS yes probability", () => {
  const matrix = matrixFor(2.5, 2.2);
  const { yes } = computeBothTeamsToScore(matrix);
  assert.ok(yes > 0.6);
});

test("a defensive scenario (very low lambdas) has high BTTS no probability", () => {
  const matrix = matrixFor(0.15, 0.1);
  const { no } = computeBothTeamsToScore(matrix);
  assert.ok(no > 0.8);
});

test("scoreDerivedOutcomeProbabilities sum to 1 within Number.EPSILON", () => {
  const matrix = matrixFor(1.7, 1.1);
  const { homeWin, draw, awayWin } = computeScoreDerivedOutcomeProbabilities(matrix);
  assert.ok(Math.abs(homeWin + draw + awayWin - 1) <= Number.EPSILON);
});

test("scoreDerivedOutcomeProbabilities favor the side with the higher lambda", () => {
  const matrix = matrixFor(3, 0.5);
  const { homeWin, awayWin } = computeScoreDerivedOutcomeProbabilities(matrix);
  assert.ok(homeWin > awayWin);
});

test("scoreDerivedOutcomeProbabilities are symmetric for identical lambdas", () => {
  const matrix = matrixFor(1.4, 1.4);
  const { homeWin, awayWin } = computeScoreDerivedOutcomeProbabilities(matrix);
  assert.ok(Math.abs(homeWin - awayWin) < 1e-9);
});

test("no probability in any market is ever negative or exceeds 1", () => {
  const matrix = matrixFor(2.5, 0.4);
  for (const line of DEFAULT_OVER_UNDER_LINES) {
    const { over, under } = computeGoalLineProbability(matrix, line);
    assert.ok(over >= 0 && over <= 1);
    assert.ok(under >= 0 && under <= 1);
  }
  const btts = computeBothTeamsToScore(matrix);
  assert.ok(btts.yes >= 0 && btts.yes <= 1);
  assert.ok(btts.no >= 0 && btts.no <= 1);
  const outcome = computeScoreDerivedOutcomeProbabilities(matrix);
  assert.ok(outcome.homeWin >= 0 && outcome.homeWin <= 1);
  assert.ok(outcome.draw >= 0 && outcome.draw <= 1);
  assert.ok(outcome.awayWin >= 0 && outcome.awayWin <= 1);
});
