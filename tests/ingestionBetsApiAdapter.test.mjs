import test from "node:test";
import assert from "node:assert/strict";
import { BetsApiAdapter, betsApiTimeToISO } from "../src/providers/betsapi/BetsApiAdapter.ts";

function payload(overrides = {}) {
  return {
    id: "bf-001",
    league: { id: "l1", name: "Esoccer Battle - 8 mins play" },
    time: "1767225600", // 2026-01-01T00:00:00Z
    time_status: "3",
    home: { name: "TeamB (player-07)" },
    away: { name: "TeamA (player-05)" },
    ss: "2-1",
    ...overrides,
  };
}

test("betsApiTimeToISO converts a unix-seconds string to an ISO timestamp", () => {
  assert.equal(betsApiTimeToISO("1767225600"), "2026-01-01T00:00:00.000Z");
});

test("betsApiTimeToISO throws a structured error for a non-numeric time field", () => {
  assert.throws(() => betsApiTimeToISO("not-a-number"), /time/i);
});

test("listMatches returns the injected simulated payloads (no real HTTP call)", async () => {
  const adapter = new BetsApiAdapter({ payloads: [payload()] });
  const matches = await adapter.listMatches();
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, "bf-001");
});

test("getMatch parses the nickname out of the raw BetsAPI-style name for player filtering", async () => {
  const adapter = new BetsApiAdapter({ payloads: [payload()] });
  const byPlayer = await adapter.listMatchesByPlayer("player-07");
  assert.equal(byPlayer.length, 1);
  assert.equal(byPlayer[0].id, "bf-001");
});

test("listMatchesByLeague filters by the raw league name", async () => {
  const adapter = new BetsApiAdapter({ payloads: [payload(), payload({ id: "bf-002", league: { id: "l2", name: "Other League" } })] });
  const matches = await adapter.listMatchesByLeague("Other League");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, "bf-002");
});

test("checkHealth reports healthy with no error under normal conditions", async () => {
  const adapter = new BetsApiAdapter({ payloads: [payload()] });
  await adapter.listMatches();
  const health = await adapter.checkHealth();
  assert.equal(health.provider, "BETSAPI");
  assert.equal(health.healthy, true);
  assert.equal(health.lastError, null);
  assert.ok(health.lastSyncAt);
});

test("a forced-unavailable provider fails every call and reports unhealthy", async () => {
  const adapter = new BetsApiAdapter({ payloads: [payload()], forceUnavailable: true, retryPolicy: { maxAttempts: 1, baseDelayMs: 1, backoffFactor: 1 } });
  await assert.rejects(() => adapter.listMatches());
  const health = await adapter.checkHealth();
  assert.equal(health.healthy, false);
  assert.ok(health.lastError);
});

test("retry policy recovers from transient simulated failures within maxAttempts", async () => {
  const adapter = new BetsApiAdapter({
    payloads: [payload()],
    simulatedFailureCount: 2,
    retryPolicy: { maxAttempts: 3, baseDelayMs: 1, backoffFactor: 1 },
  });
  const matches = await adapter.listMatches();
  assert.equal(matches.length, 1);
});

test("retry policy gives up and rejects once maxAttempts is exhausted", async () => {
  const adapter = new BetsApiAdapter({
    payloads: [payload()],
    simulatedFailureCount: 5,
    retryPolicy: { maxAttempts: 3, baseDelayMs: 1, backoffFactor: 1 },
  });
  await assert.rejects(() => adapter.listMatches());
});

test("rate limiter blocks calls once the request budget for the window is exhausted", async () => {
  const adapter = new BetsApiAdapter({
    payloads: [payload()],
    rateLimiterConfig: { maxRequests: 1, windowMs: 60_000 },
    retryPolicy: { maxAttempts: 1, baseDelayMs: 1, backoffFactor: 1 },
  });
  await adapter.listMatches();
  await assert.rejects(() => adapter.listMatches());
});
