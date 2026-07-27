import test from "node:test";
import assert from "node:assert/strict";
import * as PredictionAdaptation from "../src/services/prediction-adaptation/index.ts";

const EXPECTED_PUBLIC_EXPORTS = [
  "buildAdaptiveReport",
  "buildRecommendations",
  "classifyStrategy",
  "buildConfidenceAdjustments",
  "buildRiskAssessments",
  "PREDICTION_ADAPTATION_MODEL_VERSION",
  "DEFAULT_PREDICTION_ADAPTATION_CONFIG",
  "DEFAULT_CONFIDENCE_MULTIPLIERS",
  "DEFAULT_RISK_LEVEL_BY_RECOMMENDATION",
  "validatePredictionAdaptationConfig",
  "PredictionAdaptationConfigurationError",
  "isFiniteNumber",
];

test("the public barrel exports exactly the documented public API (function/value bindings)", () => {
  const actualExports = Object.keys(PredictionAdaptation).sort();
  assert.deepEqual(actualExports, [...EXPECTED_PUBLIC_EXPORTS].sort());
});

test("every documented export is defined and of the expected kind", () => {
  assert.equal(typeof PredictionAdaptation.buildAdaptiveReport, "function");
  assert.equal(typeof PredictionAdaptation.buildRecommendations, "function");
  assert.equal(typeof PredictionAdaptation.classifyStrategy, "function");
  assert.equal(typeof PredictionAdaptation.buildConfidenceAdjustments, "function");
  assert.equal(typeof PredictionAdaptation.buildRiskAssessments, "function");
  assert.equal(typeof PredictionAdaptation.validatePredictionAdaptationConfig, "function");
  assert.equal(typeof PredictionAdaptation.isFiniteNumber, "function");
  assert.equal(typeof PredictionAdaptation.PredictionAdaptationConfigurationError, "function");
  assert.equal(typeof PredictionAdaptation.PREDICTION_ADAPTATION_MODEL_VERSION, "string");
  assert.equal(typeof PredictionAdaptation.DEFAULT_PREDICTION_ADAPTATION_CONFIG, "object");
  assert.equal(typeof PredictionAdaptation.DEFAULT_CONFIDENCE_MULTIPLIERS, "object");
  assert.equal(typeof PredictionAdaptation.DEFAULT_RISK_LEVEL_BY_RECOMMENDATION, "object");
});

test("PredictionAdaptationConfigurationError is a real Error subclass, throwable and catchable", () => {
  const error = new PredictionAdaptation.PredictionAdaptationConfigurationError("test message");
  assert.ok(error instanceof Error);
  assert.equal(error.message, "test message");
  assert.equal(error.name, "PredictionAdaptationConfigurationError");
});

test("internal-only helpers are never re-exported (profile grouping, escalation, rounding)", () => {
  const forbiddenNames = ["groupSignalsByProfile", "reliabilityScoreFor", "escalate", "roundDeep", "roundNumber", "hasDegradationOfSeverity"];
  for (const name of forbiddenNames) {
    assert.ok(!(name in PredictionAdaptation), `${name} should not be part of the public barrel`);
  }
});

test("the module does not directly import prediction-orchestrator or prediction-evaluation (integration only via LearningReport)", async () => {
  const fs = await import("node:fs/promises");
  const files = ["types.ts", "PredictionAdaptationConfig.ts", "RecommendationEngine.ts", "StrategyEngine.ts", "ConfidenceAdjustmentEngine.ts", "RiskAssessmentEngine.ts", "AdaptiveReport.ts", "index.ts"];
  for (const file of files) {
    const content = await fs.readFile(new URL(`../src/services/prediction-adaptation/${file}`, import.meta.url), "utf-8");
    assert.ok(!content.includes("prediction-orchestrator"), `${file} must not import prediction-orchestrator directly`);
    assert.ok(!content.includes("prediction-evaluation"), `${file} must not import prediction-evaluation directly`);
  }
});
