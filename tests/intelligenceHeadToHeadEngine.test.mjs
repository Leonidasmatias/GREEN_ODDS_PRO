import test from "node:test";
import assert from "node:assert/strict";
import { calculateHeadToHead } from "../src/services/intelligence/HeadToHeadEngine.ts";

function makeMatch(index, { homePlayerId, awayPlayerId, homeGoals, awayGoals }) {
  return {
    matchId: `m${index}`,
    playedAt: new Date(2026, 0, index + 1).toISOString(),
    homePlayerId,
    awayPlayerId,
    homeGoals,
    awayGoals,
  };
}

test("no matches between the two players returns a zeroed result", () => {
  const result = calculateHeadToHead("player-a", "player-b", []);
  assert.equal(result.matchesCount, 0);
  assert.equal(result.lastMatch, null);
  assert.deepEqual(result.lastFiveMatches, []);
});

test("same player on both sides never crashes and yields no matches", () => {
  const matches = [makeMatch(0, { homePlayerId: "player-a", awayPlayerId: "player-b", homeGoals: 1, awayGoals: 0 })];
  assert.doesNotThrow(() => calculateHeadToHead("player-a", "player-a", matches));
  const result = calculateHeadToHead("player-a", "player-a", matches);
  assert.equal(result.matchesCount, 0);
});

test("uses canonical pair ordering regardless of argument order", () => {
  const matches = [makeMatch(0, { homePlayerId: "player-b", awayPlayerId: "player-a", homeGoals: 2, awayGoals: 1 })];
  const orderOne = calculateHeadToHead("player-a", "player-b", matches);
  const orderTwo = calculateHeadToHead("player-b", "player-a", matches);
  assert.deepEqual(orderOne, orderTwo);
  assert.equal(orderOne.playerAId, "player-a");
  assert.equal(orderOne.playerBId, "player-b");
});

test("aggregates wins, draws and goals from the correct side each match", () => {
  const matches = [
    makeMatch(0, { homePlayerId: "player-a", awayPlayerId: "player-b", homeGoals: 2, awayGoals: 1 }), // A wins
    makeMatch(1, { homePlayerId: "player-b", awayPlayerId: "player-a", homeGoals: 0, awayGoals: 0 }), // draw
    makeMatch(2, { homePlayerId: "player-b", awayPlayerId: "player-a", homeGoals: 3, awayGoals: 1 }), // B wins
  ];
  const result = calculateHeadToHead("player-a", "player-b", matches);
  assert.equal(result.matchesCount, 3);
  assert.equal(result.playerAWins, 1);
  assert.equal(result.playerBWins, 1);
  assert.equal(result.draws, 1);
  assert.equal(result.playerAGoals, 3);
  assert.equal(result.playerBGoals, 4);
});

test("ignores matches that do not involve both requested players", () => {
  const matches = [
    makeMatch(0, { homePlayerId: "player-a", awayPlayerId: "player-c", homeGoals: 1, awayGoals: 0 }),
    makeMatch(1, { homePlayerId: "player-a", awayPlayerId: "player-b", homeGoals: 2, awayGoals: 2 }),
  ];
  const result = calculateHeadToHead("player-a", "player-b", matches);
  assert.equal(result.matchesCount, 1);
});

test("lastMatch and lastFiveMatches reflect the most recent encounters", () => {
  const matches = Array.from({ length: 7 }, (_, i) =>
    makeMatch(i, { homePlayerId: "player-a", awayPlayerId: "player-b", homeGoals: i, awayGoals: 0 }),
  );
  const result = calculateHeadToHead("player-a", "player-b", matches);
  assert.equal(result.matchesCount, 7);
  assert.equal(result.lastMatch.matchId, "m6");
  assert.equal(result.lastFiveMatches.length, 5);
  assert.equal(result.lastFiveMatches[0].matchId, "m6");
});
