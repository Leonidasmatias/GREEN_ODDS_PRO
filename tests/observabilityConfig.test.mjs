import test from "node:test";
import assert from "node:assert/strict";
import { loadObservabilityConfig } from "../src/services/observability/ObservabilityConfig.ts";

function weightSum(weights) {
  return (
    weights.completeness +
    weights.consistency +
    weights.classification +
    weights.duplicate +
    weights.freshness +
    weights.providerReliability
  );
}

test("default env yields observability disabled, memory storage, 6 weights summing to 1", () => {
  const config = loadObservabilityConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.alertsEnabled, false);
  assert.equal(config.storageMode, "memory");
  assert.equal(config.retentionDays, 30);
  assert.ok(Math.abs(weightSum(config.weights) - 1) < 1e-9, `weights must sum to 1, got ${weightSum(config.weights)}`);
});

test("default weights match the mandatory formula exactly (0.25/0.20/0.20/0.15/0.10/0.10)", () => {
  const config = loadObservabilityConfig({});
  assert.equal(config.weights.completeness, 0.25);
  assert.equal(config.weights.consistency, 0.2);
  assert.equal(config.weights.classification, 0.2);
  assert.equal(config.weights.duplicate, 0.15);
  assert.equal(config.weights.freshness, 0.1);
  assert.equal(config.weights.providerReliability, 0.1);
});

test("default readinessMinScore is on the 0..100 scale (75), not the old 0..1 scale", () => {
  const config = loadObservabilityConfig({});
  assert.equal(config.readinessMinScore, 75);
});

test("default staleDataMinutes is 60", () => {
  const config = loadObservabilityConfig({});
  assert.equal(config.staleDataMinutes, 60);
});

test("invalid storage mode falls back to memory", () => {
  const config = loadObservabilityConfig({ OBSERVABILITY_STORAGE_MODE: "s3-bucket" });
  assert.equal(config.storageMode, "memory");
});

test("invalid alert severity falls back to warning", () => {
  const config = loadObservabilityConfig({ OBSERVABILITY_ALERT_MIN_SEVERITY: "urgent" });
  assert.equal(config.alertMinSeverity, "warning");
});

test("weights are re-normalized when the configured sum deviates from 1 (all 6 weights equal)", () => {
  const config = loadObservabilityConfig({
    OBSERVABILITY_COMPLETENESS_WEIGHT: "1",
    OBSERVABILITY_CONSISTENCY_WEIGHT: "1",
    OBSERVABILITY_CLASSIFICATION_WEIGHT: "1",
    OBSERVABILITY_DUPLICATE_WEIGHT: "1",
    OBSERVABILITY_FRESHNESS_WEIGHT: "1",
    OBSERVABILITY_PROVIDER_RELIABILITY_WEIGHT: "1",
  });
  assert.ok(Math.abs(weightSum(config.weights) - 1) < 1e-9, `weights must still sum to 1 after normalization, got ${weightSum(config.weights)}`);
  assert.ok(Math.abs(config.weights.completeness - 1 / 6) < 1e-9);
});

test("weights fall back to the mandatory defaults when the configured sum is zero", () => {
  const config = loadObservabilityConfig({
    OBSERVABILITY_COMPLETENESS_WEIGHT: "0",
    OBSERVABILITY_CONSISTENCY_WEIGHT: "0",
    OBSERVABILITY_CLASSIFICATION_WEIGHT: "0",
    OBSERVABILITY_DUPLICATE_WEIGHT: "0",
    OBSERVABILITY_FRESHNESS_WEIGHT: "0",
    OBSERVABILITY_PROVIDER_RELIABILITY_WEIGHT: "0",
  });
  assert.equal(config.weights.completeness, 0.25);
  assert.equal(config.weights.freshness, 0.1);
});

test("enabling flags and overriding thresholds is respected, including the new freshness/reliability knobs", () => {
  const config = loadObservabilityConfig({
    OBSERVABILITY_ENABLED: "true",
    OBSERVABILITY_ALERTS_ENABLED: "true",
    OBSERVABILITY_READINESS_MIN_SAMPLE_SIZE: "10",
    OBSERVABILITY_READINESS_MIN_SCORE: "90",
    OBSERVABILITY_LATENCY_P95_THRESHOLD_MS: "2000",
    OBSERVABILITY_ERROR_RATE_THRESHOLD: "0.2",
    OBSERVABILITY_DUPLICATE_RATE_THRESHOLD: "0.1",
    OBSERVABILITY_RETENTION_DAYS: "7",
    OBSERVABILITY_SAMPLE_SIZE_MAX: "50",
    OBSERVABILITY_STALE_DATA_MINUTES: "15",
    OBSERVABILITY_FRESHNESS_WEIGHT: "0.2",
    OBSERVABILITY_PROVIDER_RELIABILITY_WEIGHT: "0.2",
  });
  assert.equal(config.enabled, true);
  assert.equal(config.alertsEnabled, true);
  assert.equal(config.readinessMinSampleSize, 10);
  assert.equal(config.readinessMinScore, 90);
  assert.equal(config.latencyP95ThresholdMs, 2000);
  assert.equal(config.errorRateThreshold, 0.2);
  assert.equal(config.duplicateRateThreshold, 0.1);
  assert.equal(config.retentionDays, 7);
  assert.equal(config.sampleSizeMax, 50);
  assert.equal(config.staleDataMinutes, 15);
});

test("readinessMinScore out of the 0..100 range falls back to the default (75)", () => {
  const tooHigh = loadObservabilityConfig({ OBSERVABILITY_READINESS_MIN_SCORE: "150" });
  assert.equal(tooHigh.readinessMinScore, 75);
  const negative = loadObservabilityConfig({ OBSERVABILITY_READINESS_MIN_SCORE: "-5" });
  assert.equal(negative.readinessMinScore, 75);
});

test("never touches BetsAPI credentials - config object has no token field at all", () => {
  const config = loadObservabilityConfig({ BETSAPI_TOKEN: "sk_should_never_leak" });
  assert.equal(JSON.stringify(config).includes("sk_should_never_leak"), false);
});
