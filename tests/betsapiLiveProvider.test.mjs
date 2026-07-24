import test from "node:test";
import assert from "node:assert/strict";
import { BetsApiClient } from "../src/providers/betsapi/BetsApiClient.ts";
import { LiveBetsApiProvider } from "../src/providers/betsapi/LiveBetsApiProvider.ts";

const SECRET = "sk_live_provider_test";

function jsonResponse(status, body) {
  return { status, headers: { get: () => null }, text: async () => JSON.stringify(body) };
}

function rawEvent(overrides = {}) {
  return {
    id: "e1",
    league: { id: "l1", name: "Esoccer Battle - 8 mins play" },
    time: "1767225600",
    time_status: "3",
    home: { id: "h1", name: "TeamB (player-07)" },
    away: { id: "a1", name: "TeamA (player-05)" },
    ss: "2-1",
    ...overrides,
  };
}

function makeProvider(fetchImpl) {
  const client = new BetsApiClient(
    {
      enabled: true,
      mode: "live",
      token: SECRET,
      baseUrl: "https://primary.example",
      fallbackBaseUrl: "https://fallback.example",
      timeoutMs: 50,
      maxRetries: 1,
      retryBaseDelayMs: 1,
      rateLimitReserve: 5,
      sportId: "1",
    },
    { fetchImpl, sleep: async () => {} },
  );
  return new LiveBetsApiProvider(client, { sportId: "1" });
}

test("listMatches converts real upcoming events into the BetsApiRawMatch shape expected by the normalizer", async () => {
  const fetchImpl = async () => jsonResponse(200, { success: 1, results: [rawEvent()] });
  const provider = makeProvider(fetchImpl);
  const matches = await provider.listMatches();
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, "e1");
  assert.equal(matches[0].home.name, "TeamB (player-07)");
});

test("getMatch fetches a single event by id via getEventView and returns null when not found", async () => {
  const fetchImpl = async () => jsonResponse(200, { success: 1, results: [] });
  const provider = makeProvider(fetchImpl);
  const missing = await provider.getMatch("does-not-exist");
  assert.equal(missing, null);
});

test("getMatch returns the mapped match when found", async () => {
  const fetchImpl = async () => jsonResponse(200, { success: 1, results: [rawEvent({ id: "e42" })] });
  const provider = makeProvider(fetchImpl);
  const match = await provider.getMatch("e42");
  assert.equal(match.id, "e42");
});

test("listMatchesByPlayer filters by nickname parsed from the raw participant string", async () => {
  const fetchImpl = async () => jsonResponse(200, { success: 1, results: [rawEvent(), rawEvent({ id: "e2", home: { id: "h2", name: "TeamC (player-11)" }, away: { id: "a2", name: "TeamD (player-12)" } })] });
  const provider = makeProvider(fetchImpl);
  const matches = await provider.listMatchesByPlayer("player-11");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, "e2");
});

test("listMatchesByLeague filters by exact league name", async () => {
  const fetchImpl = async () => jsonResponse(200, { success: 1, results: [rawEvent(), rawEvent({ id: "e2", league: { id: "l2", name: "Other League" } })] });
  const provider = makeProvider(fetchImpl);
  const matches = await provider.listMatchesByLeague("Other League");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, "e2");
});

test("listMatchesByPeriod filters by the epoch-derived scheduledAt", async () => {
  const fetchImpl = async () =>
    jsonResponse(200, {
      success: 1,
      results: [rawEvent({ id: "in-range", time: "1767225600" }), rawEvent({ id: "out-of-range", time: "1700000000" })],
    });
  const provider = makeProvider(fetchImpl);
  const matches = await provider.listMatchesByPeriod("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, "in-range");
});

test("checkHealth reports healthy=true after a successful minimal call", async () => {
  const fetchImpl = async () => jsonResponse(200, { success: 1, results: [] });
  const provider = makeProvider(fetchImpl);
  const health = await provider.checkHealth();
  assert.equal(health.provider, "BETSAPI");
  assert.equal(health.healthy, true);
  assert.equal(health.lastError, null);
});

test("checkHealth reports healthy=false with a sanitized error when the call fails, never leaking the token", async () => {
  const fetchImpl = async () => jsonResponse(200, { success: 0, error: { code: "AUTHORIZE_FAILED", message: `bad token=${SECRET}` } });
  const provider = makeProvider(fetchImpl);
  const health = await provider.checkHealth();
  assert.equal(health.healthy, false);
  assert.ok(health.lastError);
  assert.ok(!health.lastError.includes(SECRET));
});
