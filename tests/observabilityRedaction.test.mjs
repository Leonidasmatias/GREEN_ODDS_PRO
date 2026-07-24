import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeObservabilityContext,
  sanitizeObservabilityMessage,
  sanitizeObservabilityReport,
} from "../src/services/observability/ObservabilityRedaction.ts";

test("sanitizeObservabilityMessage redacts a token=... pattern embedded in an error message", () => {
  const sanitized = sanitizeObservabilityMessage("BetsAPI call failed: https://api.b365api.com/v3/x?token=abc123&foo=1");
  assert.equal(sanitized.includes("abc123"), false);
});

test("sanitizeObservabilityContext redacts token-like values nested deep in an object", () => {
  const sanitized = sanitizeObservabilityContext({ nested: { url: "https://x?token=zzz999", ok: true } });
  assert.equal(JSON.stringify(sanitized).includes("zzz999"), false);
  assert.equal(sanitized.nested.ok, true);
});

test("sanitizeObservabilityReport redacts an entire report object without dropping unrelated fields", () => {
  const report = { alerts: [{ context: { url: "https://x?token=secretvalue" } }], sampleSize: 42 };
  const sanitized = sanitizeObservabilityReport(report);
  assert.equal(JSON.stringify(sanitized).includes("secretvalue"), false);
  assert.equal(sanitized.sampleSize, 42);
});
