import test from "node:test";
import assert from "node:assert/strict";
import { loadBetsApiConfig, loadBetsApiFeatureFlags } from "../src/providers/betsapi/BetsApiConfig.ts";
import { BetsApiConfigurationError } from "../src/providers/betsapi/BetsApiErrors.ts";

test("default env (nothing set) yields the safe fixture-mode default, disabled", () => {
  const config = loadBetsApiConfig({});
  assert.equal(config.mode, "fixture");
  assert.equal(config.enabled, false);
  assert.equal(config.token, null);
  assert.equal(config.baseUrl, "https://api.b365api.com");
  assert.equal(config.fallbackBaseUrl, "https://api.betsapi.com");
});

test("BETSAPI_ENABLED=false and BETSAPI_MODE=fixture (the documented safe defaults) load cleanly", () => {
  const config = loadBetsApiConfig({ BETSAPI_ENABLED: "false", BETSAPI_MODE: "fixture" });
  assert.equal(config.enabled, false);
  assert.equal(config.mode, "fixture");
});

test("an invalid BETSAPI_MODE is rejected with a configuration error", () => {
  assert.throws(() => loadBetsApiConfig({ BETSAPI_MODE: "production" }), BetsApiConfigurationError);
});

test("sandbox mode requires a token even though it does not require BETSAPI_ENABLED=true", () => {
  assert.throws(() => loadBetsApiConfig({ BETSAPI_MODE: "sandbox" }), BetsApiConfigurationError);
  const config = loadBetsApiConfig({ BETSAPI_MODE: "sandbox", BETSAPI_TOKEN: "shhh" });
  assert.equal(config.mode, "sandbox");
  assert.equal(config.token, "shhh");
});

test("live mode requires BETSAPI_ENABLED=true, even with a token present", () => {
  assert.throws(
    () => loadBetsApiConfig({ BETSAPI_MODE: "live", BETSAPI_TOKEN: "shhh", BETSAPI_ENABLED: "false" }),
    BetsApiConfigurationError,
  );
});

test("live mode requires a token, even with BETSAPI_ENABLED=true", () => {
  assert.throws(() => loadBetsApiConfig({ BETSAPI_MODE: "live", BETSAPI_ENABLED: "true" }), BetsApiConfigurationError);
});

test("live mode with both enabled=true and a token succeeds", () => {
  const config = loadBetsApiConfig({ BETSAPI_MODE: "live", BETSAPI_ENABLED: "true", BETSAPI_TOKEN: "real-token-value" });
  assert.equal(config.enabled, true);
  assert.equal(config.mode, "live");
  assert.equal(config.token, "real-token-value");
});

test("numeric fields fall back to their documented defaults when unset", () => {
  const config = loadBetsApiConfig({});
  assert.equal(config.timeoutMs, 10_000);
  assert.equal(config.maxRetries, 3);
  assert.equal(config.retryBaseDelayMs, 500);
  assert.equal(config.rateLimitReserve, 20);
  assert.equal(config.sportId, "1");
});

test("numeric fields are parsed from the environment when present", () => {
  const config = loadBetsApiConfig({ BETSAPI_TIMEOUT_MS: "5000", BETSAPI_MAX_RETRIES: "5", BETSAPI_SPORT_ID: "78" });
  assert.equal(config.timeoutMs, 5000);
  assert.equal(config.maxRetries, 5);
  assert.equal(config.sportId, "78");
});

test("a non-numeric value for a numeric field is rejected", () => {
  assert.throws(() => loadBetsApiConfig({ BETSAPI_TIMEOUT_MS: "not-a-number" }), BetsApiConfigurationError);
});

test("feature flags default to every persistence/aggregation path disabled", () => {
  const flags = loadBetsApiFeatureFlags({});
  assert.equal(flags.persistEnabled, false);
  assert.equal(flags.aggregationEnabled, false);
  assert.equal(flags.maxPagesPerSync, 3);
  assert.equal(flags.maxEventsPerSync, 200);
  assert.deepEqual(flags.esoccerAllowlist, []);
  assert.deepEqual(flags.esoccerDenylist, []);
});

test("feature flags parse comma-separated allowlist/denylist strings", () => {
  const flags = loadBetsApiFeatureFlags({ BETSAPI_ESOCCER_ALLOWLIST: "Esoccer Battle - 8 mins play, GT Leagues" });
  assert.deepEqual(flags.esoccerAllowlist, ["Esoccer Battle - 8 mins play", "GT Leagues"]);
});

test("feature flags can enable persistence/aggregation explicitly", () => {
  const flags = loadBetsApiFeatureFlags({ BETSAPI_PERSIST_ENABLED: "true", BETSAPI_AGGREGATION_ENABLED: "true" });
  assert.equal(flags.persistEnabled, true);
  assert.equal(flags.aggregationEnabled, true);
});
