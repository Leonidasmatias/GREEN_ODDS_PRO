import test from "node:test";
import assert from "node:assert/strict";
import { FixtureProvider } from "../src/providers/fixture/FixtureProvider.ts";
import { esoccerFixtureCatalog, esoccerFixturePlayers } from "../src/providers/fixture/esoccerFixtureCatalog.ts";

test("catalog has exactly 300 simulated matches", () => {
  assert.equal(esoccerFixtureCatalog.length, 300);
});

test("listMatches returns every match in the catalog", async () => {
  const provider = new FixtureProvider();
  const matches = await provider.listMatches();
  assert.equal(matches.length, 300);
});

test("getMatch finds an existing match by id and returns null for an unknown id", async () => {
  const provider = new FixtureProvider();
  const found = await provider.getMatch("fixture-intel-001");
  assert.ok(found);
  assert.equal(found.id, "fixture-intel-001");

  const missing = await provider.getMatch("fixture-intel-does-not-exist");
  assert.equal(missing, null);
});

test("listMatchesByPeriod filters strictly by the scheduledAt range", async () => {
  const provider = new FixtureProvider();
  const all = await provider.listMatches();
  const sorted = [...all].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const from = sorted[0].scheduledAt;
  const to = sorted[9].scheduledAt;
  const inRange = await provider.listMatchesByPeriod(from, to);
  assert.ok(inRange.length >= 10);
  for (const match of inRange) {
    assert.ok(new Date(match.scheduledAt).getTime() >= new Date(from).getTime());
    assert.ok(new Date(match.scheduledAt).getTime() <= new Date(to).getTime());
  }
});

test("listMatchesByPeriod outside any match date returns an empty list", async () => {
  const provider = new FixtureProvider();
  const result = await provider.listMatchesByPeriod("2000-01-01T00:00:00.000Z", "2000-01-02T00:00:00.000Z");
  assert.deepEqual(result, []);
});

test("listMatchesByPlayer returns only matches involving that player, on either side", async () => {
  const provider = new FixtureProvider();
  const player = esoccerFixturePlayers[0];
  const matches = await provider.listMatchesByPlayer(player);
  assert.ok(matches.length > 0);
  for (const match of matches) {
    assert.ok(match.homePlayerId === player || match.awayPlayerId === player);
  }
});

test("listMatchesByPlayer for an unknown player returns an empty list", async () => {
  const provider = new FixtureProvider();
  const matches = await provider.listMatchesByPlayer("player-does-not-exist");
  assert.deepEqual(matches, []);
});

test("listMatchesByLeague returns only matches in that league", async () => {
  const provider = new FixtureProvider();
  const matches = await provider.listMatchesByLeague("Esoccer Battle - 8 mins play");
  assert.equal(matches.length, 300);
});

test("getResult behaves the same as getMatch (fixtures are already finished)", async () => {
  const provider = new FixtureProvider();
  const result = await provider.getResult("fixture-intel-050");
  assert.ok(result);
  assert.equal(result.status, "FINISHED");
});

test("checkHealth reports the provider as healthy with no error", async () => {
  const provider = new FixtureProvider();
  const health = await provider.checkHealth();
  assert.equal(health.provider, "FIXTURE");
  assert.equal(health.healthy, true);
  assert.equal(health.lastError, null);
  assert.ok(health.lastSyncAt);
});

test("a custom (smaller) record set can be injected instead of the full catalog", async () => {
  const custom = esoccerFixtureCatalog.slice(0, 3);
  const provider = new FixtureProvider(custom);
  const matches = await provider.listMatches();
  assert.equal(matches.length, 3);
});
