import test from "node:test";
import assert from "node:assert/strict";
import { BetsApiClient } from "../src/providers/betsapi/BetsApiClient.ts";
import { BetsApiHealthCheck } from "../src/providers/betsapi/BetsApiHealthCheck.ts";

const SECRET = "sk_live_health_test";

function jsonResponse(body) {
  return { status: 200, headers: { get: () => null }, text: async () => JSON.stringify(body) };
}

function fixtureConfig() {
  return {
    enabled: false, mode: "fixture", token: null, baseUrl: "https://api.b365api.com",
    fallbackBaseUrl: "https://api.betsapi.com", timeoutMs: 10000, maxRetries: 3,
    retryBaseDelayMs: 500, rateLimitReserve: 20, sportId: "1",
  };
}

function liveConfig(overrides = {}) {
  return {
    enabled: true, mode: "live", token: SECRET, baseUrl: "https://primary.example",
    fallbackBaseUrl: "https://fallback.example", timeoutMs: 50, maxRetries: 1,
    retryBaseDelayMs: 1, rateLimitReserve: 5, sportId: "1", ...overrides,
  };
}

test("fixture mode never makes a real call and reports itself as not reachable, without a client", async () => {
  const health = new BetsApiHealthCheck(fixtureConfig());
  const detailed = await health.checkDetailed();
  assert.equal(detailed.mode, "fixture");
  assert.equal(detailed.reachable, false);
  assert.ok(detailed.safeError.includes("fixture"));
});

test("a successful minimal call reports reachable/authenticated/permissionGranted all true", async () => {
  const fetchImpl = async () => jsonResponse({ success: 1, results: [] });
  const client = new BetsApiClient(liveConfig(), { fetchImpl, sleep: async () => {} });
  const health = new BetsApiHealthCheck(liveConfig(), client);
  const detailed = await health.checkDetailed();
  assert.equal(detailed.reachable, true);
  assert.equal(detailed.authenticated, true);
  assert.equal(detailed.permissionGranted, true);
  assert.ok(detailed.latencyMs !== null);
  assert.ok(detailed.lastSuccessAt);
});

test("an authentication failure is reflected as authenticated=false, with a sanitized safeError", async () => {
  const fetchImpl = async () => jsonResponse({ success: 0, error: { code: "AUTHORIZE_FAILED", message: `bad token=${SECRET}` } });
  const client = new BetsApiClient(liveConfig(), { fetchImpl, sleep: async () => {} });
  const health = new BetsApiHealthCheck(liveConfig(), client);
  const detailed = await health.checkDetailed();
  assert.equal(detailed.reachable, false);
  assert.equal(detailed.authenticated, false);
  assert.ok(!detailed.safeError.includes(SECRET));
});

test("a permission failure is reflected as permissionGranted=false", async () => {
  const fetchImpl = async () => jsonResponse({ success: 0, error: { code: "PERMISSION_DENIED" } });
  const client = new BetsApiClient(liveConfig(), { fetchImpl, sleep: async () => {} });
  const health = new BetsApiHealthCheck(liveConfig(), client);
  const detailed = await health.checkDetailed();
  assert.equal(detailed.permissionGranted, false);
});

test("checkHealth() satisfies the plain HealthProvider contract (healthy boolean + provider name)", async () => {
  const fetchImpl = async () => jsonResponse({ success: 1, results: [] });
  const client = new BetsApiClient(liveConfig(), { fetchImpl, sleep: async () => {} });
  const health = new BetsApiHealthCheck(liveConfig(), client);
  const status = await health.checkHealth();
  assert.equal(status.provider, "BETSAPI");
  assert.equal(status.healthy, true);
});

test("checkHealth performs at most one HTTP call (a single minimal, controlled operation)", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse({ success: 1, results: [] });
  };
  const client = new BetsApiClient(liveConfig(), { fetchImpl, sleep: async () => {} });
  const health = new BetsApiHealthCheck(liveConfig(), client);
  await health.checkDetailed();
  assert.equal(calls, 1);
});

test("rateLimitRemaining is surfaced from the client's observed rate limit state", async () => {
  const fetchImpl = async () => ({
    status: 200,
    headers: { get: (name) => (name === "X-RateLimit-Remaining" ? "17" : null) },
    text: async () => JSON.stringify({ success: 1, results: [] }),
  });
  const client = new BetsApiClient(liveConfig(), { fetchImpl, sleep: async () => {} });
  const health = new BetsApiHealthCheck(liveConfig(), client);
  const detailed = await health.checkDetailed();
  assert.equal(detailed.rateLimitRemaining, 17);
});
