import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProductionReadiness } from "../src/services/observability/ProductionReadinessEvaluator.ts";
import { loadObservabilityConfig } from "../src/services/observability/ObservabilityConfig.ts";

const CONFIG = loadObservabilityConfig({ OBSERVABILITY_READINESS_MIN_SAMPLE_SIZE: "30", OBSERVABILITY_READINESS_MIN_SCORE: "0.75" });

function snapshot(overrides = {}) {
  return {
    id: "s1", generatedAt: "2026-01-01T00:00:00.000Z", sampleSize: 100,
    completenessScore: 1, consistencyScore: 1, classificationConfidenceScore: 1, duplicateHealthScore: 1,
    overallScore: 1, fieldMetrics: [], leagueMetrics: [], inconsistencies: [],
    ...overrides,
  };
}

test("no snapshot at all yields insufficient_data with collect_more_data", () => {
  const result = evaluateProductionReadiness({ snapshot: null, alerts: [] }, CONFIG);
  assert.equal(result.status, "insufficient_data");
  assert.equal(result.recommendedNextAction, "collect_more_data");
});

test("sampleSize below the configured minimum yields insufficient_data even with a perfect score", () => {
  const result = evaluateProductionReadiness({ snapshot: snapshot({ sampleSize: 5 }), alerts: [] }, CONFIG);
  assert.equal(result.status, "insufficient_data");
});

test("a CONFIGURATION_INVALID alert forces not_ready with resolve_configuration_before_proceeding", () => {
  const alerts = [{ type: "CONFIGURATION_INVALID", severity: "critical", message: "bad", triggeredAt: "x", context: {} }];
  const result = evaluateProductionReadiness({ snapshot: snapshot(), alerts }, CONFIG);
  assert.equal(result.status, "not_ready");
  assert.equal(result.recommendedNextAction, "resolve_configuration_before_proceeding");
});

test("a critical alert (non-configuration) forces not_ready with investigate_active_alerts", () => {
  const alerts = [{ type: "PROVIDER_UNAVAILABLE", severity: "critical", message: "down", triggeredAt: "x", context: {} }];
  const result = evaluateProductionReadiness({ snapshot: snapshot(), alerts }, CONFIG);
  assert.equal(result.status, "not_ready");
  assert.equal(result.recommendedNextAction, "investigate_active_alerts");
});

test("a very low overallScore forces not_ready even with zero alerts", () => {
  const result = evaluateProductionReadiness({ snapshot: snapshot({ overallScore: 0.1 }), alerts: [] }, CONFIG);
  assert.equal(result.status, "not_ready");
});

test("a perfect score with zero alerts and enough sample size yields ready / safe_to_expand_observation_window", () => {
  const result = evaluateProductionReadiness({ snapshot: snapshot(), alerts: [] }, CONFIG);
  assert.equal(result.status, "ready");
  assert.equal(result.recommendedNextAction, "safe_to_expand_observation_window");
});

test("a good-but-not-perfect score with a warning alert yields conditionally_ready / monitor_before_expanding_persistence", () => {
  const alerts = [{ type: "LOW_SAMPLE_SIZE", severity: "warning", message: "low", triggeredAt: "x", context: {} }];
  const result = evaluateProductionReadiness({ snapshot: snapshot({ overallScore: 0.8 }), alerts }, CONFIG);
  assert.equal(result.status, "conditionally_ready");
  assert.equal(result.recommendedNextAction, "monitor_before_expanding_persistence");
});

test("recommendedNextAction vocabulary never mentions bet/edge/ev/kelly/stake in any status", () => {
  const scenarios = [
    { snapshot: null, alerts: [] },
    { snapshot: snapshot({ overallScore: 0.1 }), alerts: [] },
    { snapshot: snapshot(), alerts: [] },
    { snapshot: snapshot({ overallScore: 0.8 }), alerts: [{ type: "LOW_SAMPLE_SIZE", severity: "warning", message: "x", triggeredAt: "x", context: {} }] },
  ];
  for (const scenario of scenarios) {
    const result = evaluateProductionReadiness(scenario, CONFIG);
    const text = result.recommendedNextAction.toLowerCase();
    for (const forbidden of ["bet", "edge", "kelly", "stake", "ev"]) {
      assert.equal(text.includes(forbidden), false, `recommendedNextAction "${text}" must never mention "${forbidden}"`);
    }
  }
});
