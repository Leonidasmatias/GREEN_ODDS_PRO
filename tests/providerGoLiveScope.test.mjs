// Sprint 9.2.1 — Provider Go Live & Live Data Pipeline.
// Auditoria estrutural: nenhum arquivo tocado por esta sprint (provider
// The Odds API, sync, dashboard, health) importa Prediction
// Engine/Green Score/Explainability/Calibration/Backtests/Threshold
// Optimizer — a missao e explicita que esses modulos nao podem ser
// alterados nem acoplados por esta sprint.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function read(relativePath) {
  return readFileSync(`${ROOT}${relativePath}`, "utf8");
}

function stripComments(source) {
  return source.split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
}

const SPRINT_9_2_1_FILES = [
  "src/providers/theOddsApi/index.ts",
  "src/providers/theOddsApi/LiveSportsDiscoveryService.ts",
  "src/providers/theOddsApi/LeagueSelectionService.ts",
  "src/providers/theOddsApi/LiveSportsTypes.ts",
  "src/providers/types.ts",
  "src/providers/providerManager.ts",
  "src/services/syncService.ts",
  "src/services/providerEconomyService.ts",
  "src/services/providerSyncMetadata.ts",
  "src/services/dashboardSnapshotService.ts",
];

const FORBIDDEN_PATHS = [
  "src/services/prediction/",
  "src/services/prediction-orchestrator/",
  "src/services/prediction-explanation/",
  "src/services/explainability-calibration/",
  "src/services/prediction-evaluation/",
  "src/repositories/prediction/",
  "predictionExplanationConstants",
];

test("scope: no Sprint 9.2.1 file imports Prediction Engine/Green Score/Explainability/Calibration/Backtests/Threshold Optimizer", () => {
  for (const file of SPRINT_9_2_1_FILES) {
    const code = stripComments(read(file));
    for (const forbidden of FORBIDDEN_PATHS) {
      assert.ok(!code.includes(forbidden), `${file} must not reference "${forbidden}"`);
    }
  }
});

test("scope: predictionExplanationConstants.ts thresholds remain exactly as documented (untouched by this sprint)", () => {
  const code = read("src/services/prediction-explanation/predictionExplanationConstants.ts");
  assert.match(code, /export const HIGH_VOLATILITY_MARGIN_THRESHOLD = 0\.08;/);
  assert.match(code, /export const INSUFFICIENT_CONFIDENCE_HIGH_THRESHOLD = 40;/);
  assert.match(code, /export const INSUFFICIENT_CONFIDENCE_MEDIUM_THRESHOLD = 60;/);
});

test("scope: no Sprint 9.2.1 file introduces a Prisma migration file reference or schema edit", () => {
  for (const file of SPRINT_9_2_1_FILES) {
    const code = stripComments(read(file));
    assert.ok(!code.includes("migrate deploy"), `${file} must not reference migrations`);
    assert.ok(!code.includes("db push"), `${file} must not reference schema pushes`);
  }
});

test("scope: TheOddsApiProvider still exposes the full OddsProvider contract (id, licensed, isConfigured, getMatches, getOdds, getMarkets, getResults)", () => {
  const code = read("src/providers/theOddsApi/index.ts");
  for (const member of ["readonly id", "readonly licensed", "isConfigured()", "async getMatches()", "async getOdds()", "async getMarkets()", "async getResults()"]) {
    assert.ok(code.includes(member), `TheOddsApiProvider must still expose ${member}`);
  }
});
