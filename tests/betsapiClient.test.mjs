import test from "node:test";
import assert from "node:assert/strict";
import { BetsApiClient } from "../src/providers/betsapi/BetsApiClient.ts";
import {
  BetsApiAuthenticationError,
  BetsApiNetworkError,
  BetsApiRateLimitError,
  BetsApiTimeoutError,
  BetsApiValidationError,
} from "../src/providers/betsapi/BetsApiErrors.ts";

const SECRET = "sk_live_test_token_xyz";

function baseConfig(overrides = {}) {
  return {
    enabled: true,
    mode: "live",
    token: SECRET,
    baseUrl: "https://primary.example",
    fallbackBaseUrl: "https://fallback.example",
    timeoutMs: 50,
    maxRetries: 3,
    retryBaseDelayMs: 1,
    rateLimitReserve: 5,
    sportId: "1",
    ...overrides,
  };
}

function jsonResponse(status, body, headers = {}) {
  const map = new Map(Object.entries(headers));
  return { status, headers: { get: (name) => map.get(name) ?? null }, text: async () => JSON.stringify(body) };
}

function scriptedFetch(steps) {
  let call = 0;
  const calls = [];
  const impl = async (url, init) => {
    calls.push(url);
    const step = steps[Math.min(call, steps.length - 1)];
    call += 1;
    return step(url, init);
  };
  impl.calls = calls;
  return impl;
}

const noopSleep = async () => {};

test("the token is appended only at send time and never appears anywhere except the actual request URL", async () => {
  const fetchImpl = scriptedFetch([() => jsonResponse(200, { success: 1, results: [] })]);
  const client = new BetsApiClient(baseConfig(), { fetchImpl, sleep: noopSleep });
  await client.getUpcomingEvents({ sport_id: "1" });
  assert.ok(fetchImpl.calls[0].includes(`token=${SECRET}`));
  // nada além da própria chamada HTTP deve conter o token: nenhuma exceção foi lançada, e getRateLimitState/getHostMetrics não o expõem.
  assert.equal(JSON.stringify(client.getRateLimitState()).includes(SECRET), false);
  assert.equal(JSON.stringify(client.getHostMetrics(baseConfig().baseUrl)).includes(SECRET), false);
});

test("BetsApiClient refuses to be constructed in fixture mode", () => {
  assert.throws(() => new BetsApiClient(baseConfig({ mode: "fixture" })), BetsApiValidationError);
});

test("BetsApiClient refuses to be constructed without a token", () => {
  assert.throws(() => new BetsApiClient(baseConfig({ token: null })), BetsApiValidationError);
});

test("a successful call parses the envelope and records host success metrics", async () => {
  const fetchImpl = scriptedFetch([() => jsonResponse(200, { success: 1, results: [{ id: "e1" }] })]);
  const client = new BetsApiClient(baseConfig(), { fetchImpl, sleep: noopSleep });
  const payload = await client.getUpcomingEvents({ sport_id: "1" });
  assert.equal(payload.results.length, 1);
  const metrics = client.getHostMetrics(baseConfig().baseUrl);
  assert.equal(metrics.lastError, null);
  assert.ok(metrics.lastSuccessAt);
});

test("timeout: an unresponsive fetch is aborted after timeoutMs and surfaces as BetsApiTimeoutError", async () => {
  const hangingFetch = () => new Promise((_resolve, reject) => {});
  const fetchImpl = async (url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  const client = new BetsApiClient(baseConfig({ timeoutMs: 15, maxRetries: 1 }), { fetchImpl, sleep: noopSleep });
  await assert.rejects(() => client.getUpcomingEvents({ sport_id: "1" }), BetsApiTimeoutError);
});

test("network errors are retried up to maxRetries and eventually succeed", async () => {
  let attempts = 0;
  const fetchImpl = scriptedFetch([
    () => {
      attempts += 1;
      throw new Error("ECONNRESET");
    },
    () => {
      attempts += 1;
      throw new Error("ECONNRESET");
    },
    () => {
      attempts += 1;
      return jsonResponse(200, { success: 1, results: [] });
    },
  ]);
  const client = new BetsApiClient(baseConfig({ maxRetries: 3 }), { fetchImpl, sleep: noopSleep });
  const payload = await client.getUpcomingEvents({ sport_id: "1" });
  assert.equal(payload.success, 1);
  assert.equal(attempts, 3);
});

test("retry uses exponential backoff with jitter, both observable via injected sleep/jitter", async () => {
  const waits = [];
  const fetchImpl = scriptedFetch([
    () => {
      throw new Error("ECONNRESET");
    },
    () => {
      throw new Error("ECONNRESET");
    },
    () => jsonResponse(200, { success: 1, results: [] }),
  ]);
  const client = new BetsApiClient(baseConfig({ maxRetries: 3, retryBaseDelayMs: 100 }), {
    fetchImpl,
    sleep: async (ms) => {
      waits.push(ms);
    },
    jitter: (attempt) => attempt, // jitter determinístico e trivial de verificar
  });
  await client.getUpcomingEvents({ sport_id: "1" });
  assert.equal(waits.length, 2);
  assert.equal(waits[0], 100 + 1); // baseDelay * 2^0 + jitter(1)
  assert.equal(waits[1], 200 + 2); // baseDelay * 2^1 + jitter(2)
});

test("a network failure exhausting the primary host falls back to the fallback host exactly once", async () => {
  const fetchImpl = async (url) => {
    if (url.startsWith("https://primary.example")) {
      throw new Error("primary down");
    }
    return jsonResponse(200, { success: 1, results: [{ id: "from-fallback" }] });
  };
  const client = new BetsApiClient(baseConfig({ maxRetries: 1 }), { fetchImpl, sleep: noopSleep });
  const payload = await client.getUpcomingEvents({ sport_id: "1" });
  assert.equal(payload.results[0].id, "from-fallback");
});

test("when both primary and fallback hosts fail, the client gives up rather than alternating forever", async () => {
  const calledUrls = [];
  const fetchImpl = async (url) => {
    calledUrls.push(url);
    throw new Error("down everywhere");
  };
  const client = new BetsApiClient(baseConfig({ maxRetries: 2 }), { fetchImpl, sleep: noopSleep });
  await assert.rejects(() => client.getUpcomingEvents({ sport_id: "1" }), BetsApiNetworkError);
  // 2 tentativas no primario + 2 no fallback = 4, nunca mais que isso (não alterna indefinidamente).
  assert.equal(calledUrls.length, 4);
});

test("HTTP 401-style AUTHORIZE_FAILED responses are never retried", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(200, { success: 0, error: { code: "AUTHORIZE_FAILED", message: "bad token" } });
  };
  const client = new BetsApiClient(baseConfig({ maxRetries: 3 }), { fetchImpl, sleep: noopSleep });
  await assert.rejects(() => client.getUpcomingEvents({ sport_id: "1" }), BetsApiAuthenticationError);
  assert.equal(calls, 1);
});

test("PARAM_INVALID (validation) responses are never retried", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(200, { success: 0, error: { code: "PARAM_INVALID" } });
  };
  const client = new BetsApiClient(baseConfig({ maxRetries: 3 }), { fetchImpl, sleep: noopSleep });
  await assert.rejects(() => client.getUpcomingEvents({ sport_id: "1" }));
  assert.equal(calls, 1);
});

test("HTTP 429 is retried and rate limit headers are captured", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return jsonResponse(429, { success: 0 }, { "X-RateLimit-Remaining": "3" });
    return jsonResponse(200, { success: 1, results: [] }, { "X-RateLimit-Remaining": "2" });
  };
  const client = new BetsApiClient(baseConfig({ maxRetries: 3 }), { fetchImpl, sleep: noopSleep });
  await client.getUpcomingEvents({ sport_id: "1" });
  assert.equal(calls, 2);
  assert.equal(client.getRateLimitState().remaining, 2);
});

test("once remaining <= reserve, the client refuses the next call without hitting the network", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(200, { success: 1, results: [] }, { "X-RateLimit-Remaining": "5" });
  };
  const client = new BetsApiClient(baseConfig({ rateLimitReserve: 5 }), { fetchImpl, sleep: noopSleep });
  await client.getUpcomingEvents({ sport_id: "1" });
  assert.equal(calls, 1);
  await assert.rejects(() => client.getUpcomingEvents({ sport_id: "1" }), BetsApiRateLimitError);
  assert.equal(calls, 1); // segunda chamada nunca chegou a rede
});

test("getEventView rejects an empty array without calling fetch", async () => {
  const fetchImpl = scriptedFetch([() => jsonResponse(200, { success: 1, results: [] })]);
  const client = new BetsApiClient(baseConfig(), { fetchImpl, sleep: noopSleep });
  await assert.rejects(() => client.getEventView([]), BetsApiValidationError);
  assert.equal(fetchImpl.calls.length, 0);
});

test("getEventView accepts between 1 and 10 ids", async () => {
  const fetchImpl = scriptedFetch([() => jsonResponse(200, { success: 1, results: [] })]);
  const client = new BetsApiClient(baseConfig(), { fetchImpl, sleep: noopSleep });
  await client.getEventView(["1", "2", "3"]);
  assert.ok(fetchImpl.calls[0].includes("event_id=1%2C2%2C3") || fetchImpl.calls[0].includes("event_id=1,2,3"));
});

test("getEventView rejects more than 10 ids without calling fetch", async () => {
  const fetchImpl = scriptedFetch([() => jsonResponse(200, { success: 1, results: [] })]);
  const client = new BetsApiClient(baseConfig(), { fetchImpl, sleep: noopSleep });
  const ids = Array.from({ length: 11 }, (_, i) => String(i));
  await assert.rejects(() => client.getEventView(ids), BetsApiValidationError);
  assert.equal(fetchImpl.calls.length, 0);
});

test("iterateLeagues paginates using a decreasing max_id and stops when results run out", async () => {
  const pages = [
    [{ id: "30", name: "L30" }, { id: "29", name: "L29" }],
    [{ id: "28", name: "L28" }],
    [],
  ];
  let call = 0;
  const fetchImpl = async () => {
    const page = pages[Math.min(call, pages.length - 1)];
    call += 1;
    return jsonResponse(200, { success: 1, results: page });
  };
  const client = new BetsApiClient(baseConfig(), { fetchImpl, sleep: noopSleep });
  const leagues = await client.iterateLeagues({ sport_id: "1" }, 10);
  assert.equal(leagues.length, 3);
  assert.equal(call, 3);
});

test("iterateLeagues stops (infinite-loop protection) when max_id does not make progress", async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    return jsonResponse(200, { success: 1, results: [{ id: "5", name: "Stuck" }] });
  };
  const client = new BetsApiClient(baseConfig(), { fetchImpl, sleep: noopSleep });
  const leagues = await client.iterateLeagues({ sport_id: "1", max_id: "4" }, 50);
  assert.equal(leagues.length, 1);
  assert.equal(call, 1);
});

test("iterateTeams respects the configured maxPages hard limit even if results never run out", async () => {
  const fetchImpl = async () => jsonResponse(200, { success: 1, results: [{ id: String(Math.random()), name: "T" }] });
  const client = new BetsApiClient(baseConfig(), { fetchImpl, sleep: noopSleep });
  const teams = await client.iterateTeams({ sport_id: "1" }, 4);
  assert.equal(teams.length, 4);
});
