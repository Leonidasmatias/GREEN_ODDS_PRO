import test from "node:test";
import assert from "node:assert/strict";
import { calculateHomeAwaySnapshot } from "../src/services/intelligence/HomeAwayEngine.ts";

function makeRecord(index, { goalsFor, goalsAgainst, isHome }) {
  return {
    matchId: `m${index}`,
    playedAt: new Date(2026, 0, index + 1).toISOString(),
    isHome,
    opponentPlayerId: "opponent",
    goalsFor,
    goalsAgainst,
  };
}

test("no matches returns zeroed splits for both sides", () => {
  const snapshot = calculateHomeAwaySnapshot([]);
  assert.equal(snapshot.home.matchesCount, 0);
  assert.equal(snapshot.away.matchesCount, 0);
  assert.equal(snapshot.home.winRate, 0);
  assert.equal(snapshot.away.winRate, 0);
});

test("splits home and away records independently", () => {
  const records = [
    makeRecord(0, { goalsFor: 2, goalsAgainst: 0, isHome: true }),
    makeRecord(1, { goalsFor: 1, goalsAgainst: 1, isHome: true }),
    makeRecord(2, { goalsFor: 0, goalsAgainst: 3, isHome: false }),
  ];
  const snapshot = calculateHomeAwaySnapshot(records);
  assert.equal(snapshot.home.matchesCount, 2);
  assert.equal(snapshot.away.matchesCount, 1);
  assert.equal(snapshot.home.winRate, 0.5);
  assert.equal(snapshot.away.winRate, 0);
});

test("goals and averages are computed correctly per side", () => {
  const records = [
    makeRecord(0, { goalsFor: 3, goalsAgainst: 1, isHome: true }),
    makeRecord(1, { goalsFor: 1, goalsAgainst: 1, isHome: true }),
  ];
  const snapshot = calculateHomeAwaySnapshot(records);
  assert.equal(snapshot.home.goalsFor, 4);
  assert.equal(snapshot.home.goalsAgainst, 2);
  assert.equal(snapshot.home.avgGoalsFor, 2);
  assert.equal(snapshot.home.avgGoalsAgainst, 1);
});

test("a player with only away matches has an empty home split", () => {
  const records = [makeRecord(0, { goalsFor: 1, goalsAgainst: 0, isHome: false })];
  const snapshot = calculateHomeAwaySnapshot(records);
  assert.equal(snapshot.home.matchesCount, 0);
  assert.equal(snapshot.away.matchesCount, 1);
});

test("one hundred matches split correctly between home and away", () => {
  const records = Array.from({ length: 100 }, (_, i) =>
    makeRecord(i, { goalsFor: i % 3, goalsAgainst: (i + 1) % 3, isHome: i % 2 === 0 }),
  );
  const snapshot = calculateHomeAwaySnapshot(records);
  assert.equal(snapshot.home.matchesCount + snapshot.away.matchesCount, 100);
  assert.equal(snapshot.home.matchesCount, 50);
  assert.equal(snapshot.away.matchesCount, 50);
});
