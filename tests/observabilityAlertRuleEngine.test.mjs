import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAlerts } from "../src/services/observability/AlertRuleEngine.ts";
import { loadObservabilityConfig } from "../src/services/observability/ObservabilityConfig.ts";

const ENABLED_CONFIG = loadObservabilityConfig({ OBSERVABILITY_ALERTS_ENABLED: "true", OBSERVABILITY_ALERT_MIN_SEVERITY: "info" });

function emptyInput(overrides = {}) {
  return {
    snapshot: null,
    latestSyncRun: null,
    lastSuccessfulSyncAt: null,
    providerMetric: null,
    rateLimitMetrics: null,
    latency: null,
    fixtureComparison: null,
    configurationIssues: [],
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

test("alertsEnabled=false always yields an empty alert list regardless of how bad the metrics are", () => {
  const disabledConfig = loadObservabilityConfig({ OBSERVABILITY_ALERTS_ENABLED: "false" });
  const alerts = evaluateAlerts(emptyInput({ configurationIssues: ["boom"] }), disabledConfig);
  assert.deepEqual(alerts, []);
});

test("no metrics at all yields no alerts (nothing to evaluate)", () => {
  const alerts = evaluateAlerts(emptyInput(), ENABLED_CONFIG);
  assert.deepEqual(alerts, []);
});

test("a snapshot with low completeness/consistency/classification scores triggers the 3 matching LOW_* alerts", () => {
  const snapshot = {
    id: "s1", generatedAt: "2026-01-01T00:00:00.000Z", sampleSize: 100,
    completenessScore: 10, consistencyScore: 10, classificationScore: 10, duplicationScore: 100,
    freshnessScore: 100, providerReliabilityScore: 100, overallScore: 10, fieldMetrics: [], leagueMetrics: [], inconsistencies: [],
  };
  const alerts = evaluateAlerts(emptyInput({ snapshot }), ENABLED_CONFIG);
  const types = alerts.map((a) => a.type);
  assert.ok(types.includes("LOW_COMPLETENESS"));
  assert.ok(types.includes("LOW_CONSISTENCY"));
  assert.ok(types.includes("LOW_CLASSIFICATION_CONFIDENCE"));
});

test("a small sampleSize triggers LOW_SAMPLE_SIZE with info severity", () => {
  const snapshot = {
    id: "s1", generatedAt: "2026-01-01T00:00:00.000Z", sampleSize: 1,
    completenessScore: 100, consistencyScore: 100, classificationScore: 100, duplicationScore: 100,
    freshnessScore: 100, providerReliabilityScore: 100, overallScore: 100, fieldMetrics: [], leagueMetrics: [], inconsistencies: [],
  };
  const alerts = evaluateAlerts(emptyInput({ snapshot }), ENABLED_CONFIG);
  const alert = alerts.find((a) => a.type === "LOW_SAMPLE_SIZE");
  assert.ok(alert);
  assert.equal(alert.severity, "info");
});

test("a fully-failed provider window triggers both HIGH_ERROR_RATE and PROVIDER_UNAVAILABLE", () => {
  const providerMetric = {
    provider: "BETSAPI", windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-01T00:05:00.000Z",
    totalRequests: 3, successfulRequests: 0, failedRequests: 3, retryCount: 0, fallbackCount: 0,
    rateLimitHits: 0, lastError: "timeout",
  };
  const alerts = evaluateAlerts(emptyInput({ providerMetric }), ENABLED_CONFIG);
  const types = alerts.map((a) => a.type);
  assert.ok(types.includes("HIGH_ERROR_RATE"));
  assert.ok(types.includes("PROVIDER_UNAVAILABLE"));
});

test("latency p95 above threshold triggers HIGH_LATENCY_P95", () => {
  const alerts = evaluateAlerts(emptyInput({ latency: { count: 10, p50: 1000, p95: 9000, p99: 9500, averageMs: 2000 } }), ENABLED_CONFIG);
  assert.ok(alerts.some((a) => a.type === "HIGH_LATENCY_P95"));
});

test("a blocked rate-limit observation triggers the critical RATE_LIMIT_EXHAUSTED alert", () => {
  const alerts = evaluateAlerts(
    emptyInput({ rateLimitMetrics: { observationCount: 1, minRemainingObserved: 0, blockedCount: 1, reserveReachedCount: 1, lastObservedAt: "2026-01-01T00:00:00.000Z" } }),
    ENABLED_CONFIG,
  );
  const alert = alerts.find((a) => a.type === "RATE_LIMIT_EXHAUSTED");
  assert.ok(alert);
  assert.equal(alert.severity, "critical");
});

test("a failed sync run triggers SYNC_RUN_FAILED, a partial run triggers SYNC_RUN_PARTIAL", () => {
  const failedRun = { id: "r1", provider: "BETSAPI", mode: "live", startedAt: "x", finishedAt: "y", durationMs: 1, status: "failed", pagesFetched: 0, eventsReceived: 0, confirmedEsoccer: 0, probableEsoccer: 0, rejected: 0, duplicated: 0, imported: 0, updated: 0, errors: ["boom"], rateLimitRemaining: null };
  const failedAlerts = evaluateAlerts(emptyInput({ latestSyncRun: failedRun }), ENABLED_CONFIG);
  assert.ok(failedAlerts.some((a) => a.type === "SYNC_RUN_FAILED"));

  const partialRun = { ...failedRun, status: "partial" };
  const partialAlerts = evaluateAlerts(emptyInput({ latestSyncRun: partialRun }), ENABLED_CONFIG);
  assert.ok(partialAlerts.some((a) => a.type === "SYNC_RUN_PARTIAL"));
});

test("structural drift in fixtureComparison triggers the critical FIXTURE_STRUCTURAL_DRIFT alert", () => {
  const alerts = evaluateAlerts(
    emptyInput({ fixtureComparison: { comparedAt: "x", liveFieldCount: 5, fixtureFieldCount: 6, missingInLive: ["a"], missingInFixture: [], typeMismatches: [], structurallyEquivalent: false } }),
    ENABLED_CONFIG,
  );
  const alert = alerts.find((a) => a.type === "FIXTURE_STRUCTURAL_DRIFT");
  assert.ok(alert);
  assert.equal(alert.severity, "critical");
});

test("a stale lastSuccessfulSyncAt (more than 24h ago) triggers STALE_SYNC", () => {
  const alerts = evaluateAlerts(
    emptyInput({ lastSuccessfulSyncAt: "2025-12-01T00:00:00.000Z", now: () => new Date("2026-01-01T00:00:00.000Z") }),
    ENABLED_CONFIG,
  );
  assert.ok(alerts.some((a) => a.type === "STALE_SYNC"));
});

test("configurationIssues each produce a CONFIGURATION_INVALID critical alert", () => {
  const alerts = evaluateAlerts(emptyInput({ configurationIssues: ["issue one", "issue two"] }), ENABLED_CONFIG);
  const configAlerts = alerts.filter((a) => a.type === "CONFIGURATION_INVALID");
  assert.equal(configAlerts.length, 2);
  assert.ok(configAlerts.every((a) => a.severity === "critical"));
});

test("alertMinSeverity=critical filters out info/warning alerts, keeping only critical ones", () => {
  const criticalOnlyConfig = loadObservabilityConfig({ OBSERVABILITY_ALERTS_ENABLED: "true", OBSERVABILITY_ALERT_MIN_SEVERITY: "critical" });
  const snapshot = {
    id: "s1", generatedAt: "x", sampleSize: 1,
    completenessScore: 10, consistencyScore: 100, classificationScore: 100, duplicationScore: 100,
    freshnessScore: 100, providerReliabilityScore: 100, overallScore: 10, fieldMetrics: [], leagueMetrics: [], inconsistencies: [],
  };
  const alerts = evaluateAlerts(emptyInput({ snapshot, configurationIssues: ["boom"] }), criticalOnlyConfig);
  assert.ok(alerts.every((a) => a.severity === "critical"));
  assert.equal(alerts.some((a) => a.type === "LOW_COMPLETENESS"), false);
  assert.ok(alerts.some((a) => a.type === "CONFIGURATION_INVALID"));
});

test("no alert message or context ever mentions bet/edge/ev/kelly/stake", () => {
  const snapshot = {
    id: "s1", generatedAt: "x", sampleSize: 1,
    completenessScore: 10, consistencyScore: 10, classificationScore: 10, duplicationScore: 10,
    freshnessScore: 100, providerReliabilityScore: 100, overallScore: 10, fieldMetrics: [], leagueMetrics: [], inconsistencies: ["negative_score:1"],
  };
  const alerts = evaluateAlerts(emptyInput({ snapshot, configurationIssues: ["bad config"] }), ENABLED_CONFIG);
  const serialized = JSON.stringify(alerts).toLowerCase();
  for (const forbidden of ["bet", "edge", "kelly", "stake", " ev "]) {
    assert.equal(serialized.includes(forbidden), false, `alert output must never mention "${forbidden}"`);
  }
});
