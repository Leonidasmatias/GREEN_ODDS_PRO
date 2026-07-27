import test from "node:test";
import assert from "node:assert/strict";
import * as PredictionObservability from "../src/services/prediction-observability/index.ts";

const EXPECTED_PUBLIC_EXPORTS = [
  "buildObservabilityReport",
  "buildMonitoringProfiles",
  "analyzeTrends",
  "buildAlerts",
  "buildDashboardMetrics",
  "buildTimeline",
  "PREDICTION_OBSERVABILITY_MODEL_VERSION",
  "DEFAULT_PREDICTION_OBSERVABILITY_CONFIG",
  "DEFAULT_MONITORING_STATUS_BY_RECOMMENDATION",
  "validatePredictionObservabilityConfig",
  "PredictionObservabilityConfigurationError",
  "isFiniteNumber",
];

test("the public barrel exports exactly the documented public API (function/value bindings)", () => {
  const actualExports = Object.keys(PredictionObservability).sort();
  assert.deepEqual(actualExports, [...EXPECTED_PUBLIC_EXPORTS].sort());
});

test("every documented export is defined and of the expected kind", () => {
  assert.equal(typeof PredictionObservability.buildObservabilityReport, "function");
  assert.equal(typeof PredictionObservability.buildMonitoringProfiles, "function");
  assert.equal(typeof PredictionObservability.analyzeTrends, "function");
  assert.equal(typeof PredictionObservability.buildAlerts, "function");
  assert.equal(typeof PredictionObservability.buildDashboardMetrics, "function");
  assert.equal(typeof PredictionObservability.buildTimeline, "function");
  assert.equal(typeof PredictionObservability.validatePredictionObservabilityConfig, "function");
  assert.equal(typeof PredictionObservability.isFiniteNumber, "function");
  assert.equal(typeof PredictionObservability.PredictionObservabilityConfigurationError, "function");
  assert.equal(typeof PredictionObservability.PREDICTION_OBSERVABILITY_MODEL_VERSION, "string");
  assert.equal(typeof PredictionObservability.DEFAULT_PREDICTION_OBSERVABILITY_CONFIG, "object");
  assert.equal(typeof PredictionObservability.DEFAULT_MONITORING_STATUS_BY_RECOMMENDATION, "object");
});

test("PredictionObservabilityConfigurationError is a real Error subclass, throwable and catchable", () => {
  const error = new PredictionObservability.PredictionObservabilityConfigurationError("test message");
  assert.ok(error instanceof Error);
  assert.equal(error.message, "test message");
  assert.equal(error.name, "PredictionObservabilityConfigurationError");
});

test("internal-only helpers are never re-exported (profile grouping, comparators, rounding)", () => {
  const forbiddenNames = ["groupSignalsByProfile", "profileMapKey", "reliabilityScoreFor", "roundDeep", "roundNumber", "compareEvents", "average"];
  for (const name of forbiddenNames) {
    assert.ok(!(name in PredictionObservability), `${name} should not be part of the public barrel`);
  }
});

test("the module only imports prediction-learning/prediction-adaptation public barrels, never internal files of any prior sprint", async () => {
  const fs = await import("node:fs/promises");
  const files = [
    "types.ts",
    "PredictionObservabilityConfig.ts",
    "ProfileMonitoringEngine.ts",
    "TrendAnalysisEngine.ts",
    "AlertEngine.ts",
    "DashboardMetricsEngine.ts",
    "TimelineEngine.ts",
    "ObservabilityReport.ts",
    "index.ts",
  ];
  for (const file of files) {
    const content = await fs.readFile(new URL(`../src/services/prediction-observability/${file}`, import.meta.url), "utf-8");
    assert.ok(!content.includes("prediction-orchestrator"), `${file} must not import prediction-orchestrator directly`);
    assert.ok(!content.includes("prediction-evaluation"), `${file} must not import prediction-evaluation directly`);
    assert.ok(!content.includes('from "../prediction/'), `${file} must not import prediction/ internal files`);
    for (const cross of ["../prediction-learning/", "../prediction-adaptation/"]) {
      if (content.includes(cross)) {
        assert.ok(content.includes(`${cross}index.ts`), `${file} must only import ${cross} via its public index.ts barrel`);
      }
    }
  }
});
