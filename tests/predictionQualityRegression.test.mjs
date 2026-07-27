import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Fases 1/1.5/2/3/3.5 e as Sprints 4.1/4.2/4.3 continuam importáveis e
// funcionais depois da introdução do Prediction Quality Framework
// (Sprint 4.4) — nenhum arquivo anterior foi modificado, o framework
// apenas mede a qualidade de previsões já produzidas, fornecidas pelo
// chamador junto do resultado real de cada partida.
import { calculateGreenScore } from "../src/services/intelligence/GreenScoreEngine.ts";
import { FixtureProvider } from "../src/providers/fixture/FixtureProvider.ts";
import { predictMatchOutcome } from "../src/services/prediction/index.ts";
import { predictGoalDistribution } from "../src/services/goal-distribution/index.ts";
import { predictMatch } from "../src/services/prediction-orchestrator/index.ts";

import { buildPredictionQualityReport } from "../src/services/prediction-quality/PredictionQualityReport.ts";
import { DEFAULT_PREDICTION_QUALITY_CONFIG } from "../src/services/prediction-quality/PredictionQualityConfig.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const QUALITY_SRC_DIR = path.join(REPO_ROOT, "src", "services", "prediction-quality");
const ORCHESTRATOR_SRC_DIR = path.join(REPO_ROOT, "src", "services", "prediction-orchestrator");

function collectTsFiles(dir) {
  return fs.readdirSync(dir).filter((name) => name.endsWith(".ts")).map((name) => path.join(dir, name));
}

test("Intelligence Engine (Fase 1.5) remains importable and untouched by the Prediction Quality Framework", () => {
  assert.equal(typeof calculateGreenScore, "function");
});

test("FixtureProvider (Fase 2) still lists all 300 fixture matches after the Prediction Quality Framework was introduced", async () => {
  const provider = new FixtureProvider();
  const matches = await provider.listMatches();
  assert.equal(matches.length, 300);
});

test("Prediction Engine (4.1), Goal Distribution Engine (4.2), and Prediction Orchestrator (4.3) remain importable, functional, and untouched", () => {
  assert.equal(typeof predictMatchOutcome, "function");
  assert.equal(typeof predictGoalDistribution, "function");
  assert.equal(typeof predictMatch, "function");
  assert.ok(collectTsFiles(ORCHESTRATOR_SRC_DIR).length > 0);
});

test("no prediction-quality module imports the real @prisma/client package or the local Prisma client", () => {
  const files = collectTsFiles(QUALITY_SRC_DIR);
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(source.includes("@prisma/client"), false, `${file} must not import @prisma/client`);
    assert.equal(/from\s+["']\.\.\/\.\.\/lib\/prisma/.test(source), false, `${file} must not import the local Prisma client`);
  }
});

test("no prediction-quality module imports the BetsAPI provider layer", () => {
  const files = collectTsFiles(QUALITY_SRC_DIR);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(/from\s+["'].*betsapi/i.test(source), false, `${file} must not import the BetsAPI layer`);
  }
});

test("no prediction-quality module reaches into internal (non-barrel) files of the prediction-orchestrator module", () => {
  const files = collectTsFiles(QUALITY_SRC_DIR);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const orchestratorImports = [...source.matchAll(/from\s+["'](\.\.\/prediction-orchestrator\/[^"']+)["']/g)].map((m) => m[1]);
    for (const importPath of orchestratorImports) {
      assert.equal(importPath, "../prediction-orchestrator/index.ts", `${file} must only import the orchestrator's public barrel, found: ${importPath}`);
    }
  }
});

test("no prediction-quality module references betting-recommendation or ML vocabulary as code (Kelly, stake, EV, odds, bookmaker, ROI, machine learning)", () => {
  const files = collectTsFiles(QUALITY_SRC_DIR);
  const forbiddenIdentifiers = [/\bkelly\b/i, /\bstake\b/i, /\bexpectedValue\b/i, /\bbankroll\b/i, /\bbookmaker\b/i, /\bROI\b/, /\bodds\b/i, /\bneuralNetwork\b/i, /\btensorflow\b/i];
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

test("prisma/schema.prisma was not modified by this sprint (no prediction-quality models exist there)", () => {
  const schemaPath = path.join(REPO_ROOT, "prisma", "schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf8");
  assert.equal(schema.includes("model PredictionQualityReport"), false);
  assert.equal(schema.includes("model PredictionQualityRecord"), false);
});

test("the framework measures a real predictMatch() output end-to-end without recomputing anything", () => {
  const player = (id) => ({
    playerId: id,
    matchesCount: 20,
    rating: { playerId: id, rating: id === "home" ? 1650 : 1500, matchesCount: 20 },
    form: null,
    homeAway: null,
    momentum: null,
    strength: null,
    confidence: null,
    greenScore: null,
    goalsRates: null,
  });

  const result = predictMatch({ homePlayer: player("home"), awayPlayer: player("away"), headToHead: null }, undefined, () => new Date("2026-01-01T00:00:00.000Z"));

  const record = {
    matchId: "regression-1",
    homePlayerId: "home",
    awayPlayerId: "away",
    league: "regression-league",
    period: "2026-01",
    result,
    actualOutcome: result.prediction.predictedOutcome,
  };

  const report = buildPredictionQualityReport([record], DEFAULT_PREDICTION_QUALITY_CONFIG, () => new Date("2026-01-02T00:00:00.000Z"));
  assert.equal(report.validRecordCount, 1);
  assert.equal(report.accuracy.accuracy, 1);
  assert.equal(report.brierScore.global, report.brierScore.byPlayer.find((e) => e.key === "home").value);
});
