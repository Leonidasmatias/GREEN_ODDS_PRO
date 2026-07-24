import test from "node:test";
import assert from "node:assert/strict";
import {
  computeRollingStatsForPlayer,
  computeHeadToHeadPairs,
  computeRatings,
} from "../src/services/intelligence/AggregationEngine.ts";
import { INITIAL_RATING } from "../src/services/intelligence/RatingEngine.ts";
import {
  esoccerIntelligencePlayers,
  esoccerIntelligenceMatchFixtures,
} from "./fixtures/esoccerIntelligenceMatches.mjs";

// Nota: apenas as funções puras (computeRollingStatsForPlayer,
// computeHeadToHeadPairs, computeRatings) são testadas aqui.
// runAggregation() acessa o Prisma/banco real e não é coberta por teste
// automatizado nesta fase (ver docs/INTELLIGENCE_ENGINE_V1.md).

function match(overrides = {}) {
  return {
    matchId: "m1",
    playedAt: "2026-01-01T00:00:00.000Z",
    homePlayerId: "player-01",
    awayPlayerId: "player-02",
    homeScore: 2,
    awayScore: 1,
    ...overrides,
  };
}

test("a player absent from every match yields all-zero rolling stats for the three windows", () => {
  const rows = computeRollingStatsForPlayer("player-99", [match()]);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((row) => row.windowSize),
    [5, 10, 20],
  );
  for (const row of rows) {
    assert.equal(row.matchesCount, 0);
    assert.equal(row.wins, 0);
    assert.equal(row.draws, 0);
    assert.equal(row.losses, 0);
    assert.equal(row.avgGoalsFor, 0);
    assert.equal(row.avgGoalsAgainst, 0);
  }
});

test("a player with exactly one match has matchesCount 1 in every window", () => {
  const rows = computeRollingStatsForPlayer("player-01", [match({ homePlayerId: "player-01", homeScore: 3, awayScore: 0 })]);
  for (const row of rows) {
    assert.equal(row.matchesCount, 1);
    assert.equal(row.wins, 1);
    assert.equal(row.goalsFor, 3);
    assert.equal(row.goalsAgainst, 0);
  }
});

test("rolling stats are oriented per player regardless of home/away side", () => {
  const matches = [
    match({ matchId: "m1", homePlayerId: "player-01", awayPlayerId: "player-02", homeScore: 3, awayScore: 1 }),
    match({ matchId: "m2", homePlayerId: "player-02", awayPlayerId: "player-01", homeScore: 0, awayScore: 2, playedAt: "2026-01-02T00:00:00.000Z" }),
  ];
  const rowsFor01 = computeRollingStatsForPlayer("player-01", matches);
  const last10 = rowsFor01.find((row) => row.windowSize === 10);
  // player-01: match 1 as home (3 for, 1 against, win), match 2 as away (2 for, 0 against, win).
  assert.equal(last10.matchesCount, 2);
  assert.equal(last10.wins, 2);
  assert.equal(last10.goalsFor, 5);
  assert.equal(last10.goalsAgainst, 1);
});

test("computeHeadToHeadPairs merges home and away meetings into a single canonical pair", () => {
  const matches = [
    match({ matchId: "m1", homePlayerId: "player-05", awayPlayerId: "player-03", homeScore: 1, awayScore: 1 }),
    match({ matchId: "m2", homePlayerId: "player-03", awayPlayerId: "player-05", homeScore: 2, awayScore: 0, playedAt: "2026-01-02T00:00:00.000Z" }),
  ];
  const pairs = computeHeadToHeadPairs(matches);
  assert.equal(pairs.length, 1);
  const [pair] = pairs;
  assert.equal(pair.matchesCount, 2);
  // canonical order: smaller id first (string comparison of "player-03" < "player-05").
  assert.equal(pair.playerAId, "player-03");
  assert.equal(pair.playerBId, "player-05");
});

test("computeHeadToHeadPairs returns an empty list for an empty match history", () => {
  assert.deepEqual(computeHeadToHeadPairs([]), []);
});

test("computeRatings: a decisive first match moves the winner above and the loser below the initial rating", () => {
  const ratings = computeRatings([match({ homePlayerId: "player-10", awayPlayerId: "player-11", homeScore: 4, awayScore: 0 })]);
  assert.equal(ratings.size, 2);
  assert.ok(ratings.get("player-10").rating > INITIAL_RATING);
  assert.ok(ratings.get("player-11").rating < INITIAL_RATING);
});

test("computeRatings on an empty match list yields an empty map", () => {
  const ratings = computeRatings([]);
  assert.equal(ratings.size, 0);
});

test("sanity pass over the full 300-match simulated fixture set", () => {
  const matches = esoccerIntelligenceMatchFixtures.map((fixture) => ({
    matchId: fixture.id,
    playedAt: fixture.scheduledAt,
    homePlayerId: fixture.homePlayerId,
    awayPlayerId: fixture.awayPlayerId,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
  }));
  assert.equal(matches.length, 300);

  const expectedPlayerIds = new Set();
  for (const m of matches) {
    expectedPlayerIds.add(m.homePlayerId);
    expectedPlayerIds.add(m.awayPlayerId);
  }
  assert.equal(expectedPlayerIds.size, esoccerIntelligencePlayers.length);

  for (const playerId of esoccerIntelligencePlayers) {
    const rows = computeRollingStatsForPlayer(playerId, matches);
    assert.equal(rows.length, 3);
    for (const row of rows) {
      assert.ok(row.matchesCount <= row.windowSize);
      assert.ok(Number.isFinite(row.avgGoalsFor));
      assert.ok(Number.isFinite(row.avgGoalsAgainst));
    }
  }

  const pairs = computeHeadToHeadPairs(matches);
  assert.ok(pairs.length > 0);
  for (const pair of pairs) {
    assert.ok(pair.playerAId < pair.playerBId);
    assert.ok(pair.matchesCount > 0);
    assert.equal(pair.playerAWins + pair.playerBWins + pair.draws, pair.matchesCount);
  }

  const ratings = computeRatings(matches);
  assert.equal(ratings.size, expectedPlayerIds.size);
  for (const rating of ratings.values()) {
    assert.ok(Number.isFinite(rating.rating));
    assert.ok(rating.matchesCount > 0);
  }
});
