import test from "node:test";
import assert from "node:assert/strict";
import { parseBetsApiEnvelope, parseRateLimitHeaders } from "../src/providers/betsapi/BetsApiResponse.ts";
import {
  BetsApiAuthenticationError,
  BetsApiPermissionError,
  BetsApiRateLimitError,
  BetsApiResponseError,
  BetsApiUnavailableError,
  BetsApiValidationError,
} from "../src/providers/betsapi/BetsApiErrors.ts";

function headerMap(entries) {
  const map = new Map(Object.entries(entries));
  return { get: (name) => map.get(name) ?? null };
}

test("parseBetsApiEnvelope returns the parsed payload when success=1", () => {
  const body = JSON.stringify({ success: 1, results: [{ id: "1" }] });
  const parsed = parseBetsApiEnvelope(body, "/v3/events/upcoming");
  assert.equal(parsed.success, 1);
  assert.equal(parsed.results.length, 1);
});

test("parseBetsApiEnvelope throws BetsApiResponseError on invalid JSON", () => {
  assert.throws(() => parseBetsApiEnvelope("not-json{{{", "/v3/events/upcoming"), BetsApiResponseError);
});

test("parseBetsApiEnvelope throws BetsApiResponseError when the success field is missing entirely", () => {
  assert.throws(() => parseBetsApiEnvelope(JSON.stringify({ results: [] }), "/v3/events/upcoming"), BetsApiResponseError);
});

test("success=false maps AUTHORIZE_FAILED to BetsApiAuthenticationError", () => {
  const body = JSON.stringify({ success: 0, error: { code: "AUTHORIZE_FAILED", message: "bad token" } });
  assert.throws(() => parseBetsApiEnvelope(body, "/v3/events/upcoming"), BetsApiAuthenticationError);
});

test("success=false maps PERMISSION_DENIED to BetsApiPermissionError", () => {
  const body = JSON.stringify({ success: 0, error: { code: "PERMISSION_DENIED" } });
  assert.throws(() => parseBetsApiEnvelope(body, "/v3/events/upcoming"), BetsApiPermissionError);
});

test("success=false maps TOO_MANY_REQUESTS to BetsApiRateLimitError", () => {
  const body = JSON.stringify({ success: 0, error: { code: "TOO_MANY_REQUESTS" } });
  assert.throws(() => parseBetsApiEnvelope(body, "/v3/events/upcoming"), BetsApiRateLimitError);
});

test("success=false maps PARAM_REQUIRED and PARAM_INVALID to BetsApiValidationError", () => {
  assert.throws(
    () => parseBetsApiEnvelope(JSON.stringify({ success: 0, error: { code: "PARAM_REQUIRED" } }), "/x"),
    BetsApiValidationError,
  );
  assert.throws(
    () => parseBetsApiEnvelope(JSON.stringify({ success: 0, error: { code: "PARAM_INVALID" } }), "/x"),
    BetsApiValidationError,
  );
});

test("success=false maps UNDER_MAINTENANCE to BetsApiUnavailableError", () => {
  const body = JSON.stringify({ success: 0, error: { code: "UNDER_MAINTENANCE" } });
  assert.throws(() => parseBetsApiEnvelope(body, "/v3/events/upcoming"), BetsApiUnavailableError);
});

test("success=false with an unrecognized code falls back to a generic BetsApiResponseError", () => {
  const body = JSON.stringify({ success: 0, error: { code: "SOMETHING_NEW" } });
  assert.throws(() => parseBetsApiEnvelope(body, "/v3/events/upcoming"), BetsApiResponseError);
});

test("parseRateLimitHeaders reads limit/remaining and computes an ISO resetAt from the epoch seconds header", () => {
  const now = () => new Date("2026-01-01T00:00:00.000Z");
  const headers = headerMap({ "X-RateLimit-Limit": "100", "X-RateLimit-Remaining": "42", "X-RateLimit-Reset": "1767225600" });
  const state = parseRateLimitHeaders(headers, 20, now);
  assert.equal(state.limit, 100);
  assert.equal(state.remaining, 42);
  assert.equal(state.resetAt, "2026-01-01T00:00:00.000Z");
  assert.equal(state.observedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(state.blocked, false);
  assert.equal(state.reserveReached, false);
});

test("parseRateLimitHeaders flags reserveReached/blocked once remaining drops to the configured reserve", () => {
  const headers = headerMap({ "X-RateLimit-Limit": "100", "X-RateLimit-Remaining": "20" });
  const state = parseRateLimitHeaders(headers, 20);
  assert.equal(state.reserveReached, true);
  assert.equal(state.blocked, true);
});

test("parseRateLimitHeaders tolerates missing headers, returning nulls rather than throwing", () => {
  const state = parseRateLimitHeaders(headerMap({}), 20);
  assert.equal(state.limit, null);
  assert.equal(state.remaining, null);
  assert.equal(state.resetAt, null);
  assert.equal(state.blocked, false);
});
