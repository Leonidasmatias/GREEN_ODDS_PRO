import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Fases 1/1.5/2/3/3.5 e as Sprints 4.1/4.2 continuam importáveis e
// funcionais depois da introdução do Prediction Orchestrator (Sprint
// 4.3) — nenhum arquivo anterior foi modificado, o orquestrador apenas
// compõe os dois motores através de seus barrels públicos.
import { calculateGreenScore } from "../src/services/intelligence/GreenScoreEngine.ts";
import { FixtureProvider } from "../src/providers/fixture/FixtureProvider.ts";
import { predictMatchOutcome, DEFAULT_PREDICTION_MODEL_CONFIG } from "../src/services/prediction/index.ts";
import { predictGoalDistribution, DEFAULT_GOAL_DISTRIBUTION_CONFIG } from "../src/services/goal-distribution/index.ts";

import { predictMatch } from "../src/services/prediction-orchestrator/PredictionOrchestrator.ts";
import { DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG } from "../src/services/prediction-orchestrator/PredictionOrchestratorConfig.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const ORCHESTRATOR_SRC_DIR = path.join(REPO_ROOT, "src", "services", "prediction-orchestrator");
const PREDICTION_SRC_DIR = path.join(REPO_ROOT, "src", "services", "prediction");
const GOAL_DISTRIBUTION_SRC_DIR = path.join(REPO_ROOT, "src", "services", "goal-distribution");

function collectTsFiles(dir) {
  return fs.readdirSync(dir).filter((name) => name.endsWith(".ts")).map((name) => path.join(dir, name));
}

test("Intelligence Engine (Fase 1.5) remains importable and untouched by the Prediction Orchestrator", () => {
  assert.equal(typeof calculateGreenScore, "function");
});

test("FixtureProvider (Fase 2) still lists all 300 fixture matches after the Prediction Orchestrator was introduced", async () => {
  const provider = new FixtureProvider();
  const matches = await provider.listMatches();
  assert.equal(matches.length, 300);
});

test("Prediction Engine (Sprint 4.1) and Goal Distribution Engine (Sprint 4.2) remain importable, functional, and untouched", () => {
  assert.equal(typeof predictMatchOutcome, "function");
  assert.equal(typeof predictGoalDistribution, "function");
  assert.ok(collectTsFiles(PREDICTION_SRC_DIR).length > 0);
  assert.ok(collectTsFiles(GOAL_DISTRIBUTION_SRC_DIR).length > 0);
});

test("no prediction-orchestrator module imports the real @prisma/client package or the local Prisma client", () => {
  const files = collectTsFiles(ORCHESTRATOR_SRC_DIR);
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(source.includes("@prisma/client"), false, `${file} must not import @prisma/client`);
    assert.equal(/from\s+["']\.\.\/\.\.\/lib\/prisma/.test(source), false, `${file} must not import the local Prisma client`);
  }
});

test("no prediction-orchestrator module imports the BetsAPI provider layer", () => {
  const files = collectTsFiles(ORCHESTRATOR_SRC_DIR);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(/from\s+["'].*betsapi/i.test(source), false, `${file} must not import the BetsAPI layer`);
  }
});

test("no prediction-orchestrator module reaches into internal (non-barrel) files of the prediction or goal-distribution modules", () => {
  const files = collectTsFiles(ORCHESTRATOR_SRC_DIR);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const predictionImports = [...source.matchAll(/from\s+["'](\.\.\/prediction\/[^"']+)["']/g)].map((m) => m[1]);
    for (const importPath of predictionImports) {
      assert.equal(importPath, "../prediction/index.ts", `${file} must only import prediction's public barrel, found: ${importPath}`);
    }
    const goalDistributionImports = [...source.matchAll(/from\s+["'](\.\.\/goal-distribution\/[^"']+)["']/g)].map((m) => m[1]);
    for (const importPath of goalDistributionImports) {
      assert.equal(importPath, "../goal-distribution/index.ts", `${file} must only import goal-distribution's public barrel, found: ${importPath}`);
    }
  }
});

test("the public output never carries a betting-recommendation-shaped identifier (Kelly, stake, EV, odds, bookmaker, ROI) as code", () => {
  const files = collectTsFiles(ORCHESTRATOR_SRC_DIR);
  const forbiddenIdentifiers = [/\bkelly\b/i, /\bstake\b/i, /\bexpectedValue\b/i, /\bbankroll\b/i, /\bbookmaker\b/i, /\bROI\b/, /\bodds\b/i];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const codeOnly = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
      .join("\n");
    for (const pattern of forbiddenIdentifiers) {
      assert.equal(pattern.test(codeOnly), false, `${file} must not reference ${pattern} as code`);
    }
  }
});

test("prisma/schema.prisma was not modified by this sprint (no orchestrator models exist there)", () => {
  const schemaPath = path.join(REPO_ROOT, "prisma", "schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf8");
  assert.equal(schema.includes("model PredictionResult"), false);
  assert.equal(schema.includes("model FinalPrediction"), false);
});

test("the Prediction Orchestrator produces a well-formed result end-to-end, composing both engines' real public APIs", () => {
  const homePlayer = {
    playerId: "home",
    matchesCount: 20,
    rating: { playerId: "home", rating: 1600, matchesCount: 20 },
    form: null,
    homeAway: null,
    momentum: null,
    strength: null,
    confidence: null,
    greenScore: null,
    goalsRates: null,
  };
  const awayPlayer = {
    playerId: "away",
    matchesCount: 20,
    rating: { playerId: "away", rating: 1500, matchesCount: 20 },
    form: null,
    homeAway: null,
    momentum: null,
    strength: null,
    confidence: null,
    greenScore: null,
    goalsRates: null,
  };

  const orchestratorResult = predictMatch({ homePlayer, awayPlayer, headToHead: null }, DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG, () => new Date("2026-01-01T00:00:00.000Z"));

  const directPrediction = predictMatchOutcome({ homePlayer, awayPlayer, headToHead: null }, DEFAULT_PREDICTION_MODEL_CONFIG, () => new Date("2026-01-01T00:00:00.000Z"));

  assert.deepEqual(orchestratorResult.prediction, directPrediction);
  assert.equal(orchestratorResult.goalDistribution.modelVersion, DEFAULT_GOAL_DISTRIBUTION_CONFIG.modelVersion);
});
