import test from "node:test";
import assert from "node:assert/strict";
import { calculateFormWindow, calculateFormSnapshot } from "../src/services/intelligence/FormEngine.ts";

function makeRecord(index, { goalsFor, goalsAgainst, isHome = true }) {
  return {
    matchId: `m${index}`,
    playedAt: new Date(2026, 0, index + 1).toISOString(),
    isHome,
    opponentPlayerId: "opponent",
    goalsFor,
    goalsAgainst,
  };
}

test("no matches returns all zeros without dividing by zero", () => {
  const stats = calculateFormWindow([], 5);
  assert.equal(stats.matchesCount, 0);
  assert.equal(stats.winRate, 0);
  assert.equal(stats.pointsPerGame, 0);
  assert.equal(stats.avgGoalsFor, 0);
  assert.equal(stats.avgGoalsAgainst, 0);
});

test("one match fills a window smaller than the requested size", () => {
  const records = [makeRecord(0, { goalsFor: 2, goalsAgainst: 1 })];
  const stats = calculateFormWindow(records, 5);
  assert.equal(stats.matchesCount, 1);
  assert.equal(stats.wins, 1);
  assert.equal(stats.winRate, 1);
  assert.equal(stats.pointsPerGame, 3);
  assert.equal(stats.goalDifference, 1);
});

test("five matches with a mixed record compute correct rates", () => {
  const records = [
    makeRecord(0, { goalsFor: 2, goalsAgainst: 0 }), // win
    makeRecord(1, { goalsFor: 1, goalsAgainst: 1 }), // draw
    makeRecord(2, { goalsFor: 0, goalsAgainst: 2 }), // loss
    makeRecord(3, { goalsFor: 3, goalsAgainst: 1 }), // win
    makeRecord(4, { goalsFor: 1, goalsAgainst: 0 }), // win
  ];
  const stats = calculateFormWindow(records, 5);
  assert.equal(stats.matchesCount, 5);
  assert.equal(stats.wins, 3);
  assert.equal(stats.draws, 1);
  assert.equal(stats.losses, 1);
  assert.equal(stats.winRate, 0.6);
  assert.equal(stats.pointsPerGame, (3 * 3 + 1) / 5);
  assert.equal(stats.goalsFor, 7);
  assert.equal(stats.goalsAgainst, 4);
});

test("twenty matches: window uses exactly the requested size", () => {
  const records = Array.from({ length: 20 }, (_, i) => makeRecord(i, { goalsFor: 1, goalsAgainst: 0 }));
  const stats = calculateFormWindow(records, 20);
  assert.equal(stats.matchesCount, 20);
  assert.equal(stats.wins, 20);
  assert.equal(stats.winRate, 1);
});

test("one hundred matches: only the most recent N are used per window", () => {
  // Os primeiros 80 jogos são derrotas antigas; os últimos 20 são vitórias
  // recentes — só estas devem aparecer nas janelas de 5/10/20.
  const oldLosses = Array.from({ length: 80 }, (_, i) => makeRecord(i, { goalsFor: 0, goalsAgainst: 1 }));
  const recentWins = Array.from({ length: 20 }, (_, i) => makeRecord(80 + i, { goalsFor: 2, goalsAgainst: 0 }));
  const records = [...oldLosses, ...recentWins];

  const snapshot = calculateFormSnapshot(records);
  assert.equal(snapshot.last5.matchesCount, 5);
  assert.equal(snapshot.last5.wins, 5);
  assert.equal(snapshot.last10.wins, 10);
  assert.equal(snapshot.last20.wins, 20);
  assert.equal(snapshot.last20.losses, 0);
});

test("input order does not matter — the engine sorts internally", () => {
  const records = [
    makeRecord(2, { goalsFor: 0, goalsAgainst: 2 }),
    makeRecord(0, { goalsFor: 2, goalsAgainst: 0 }),
    makeRecord(1, { goalsFor: 1, goalsAgainst: 1 }),
  ];
  const sortedInput = [...records].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt));
  const statsShuffled = calculateFormWindow(records, 3);
  const statsSorted = calculateFormWindow(sortedInput, 3);
  assert.deepEqual(statsShuffled, statsSorted);
});
