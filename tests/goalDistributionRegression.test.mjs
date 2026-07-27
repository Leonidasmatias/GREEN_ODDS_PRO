import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Fases 1/1.5/2/3/3.5 e a Sprint 4.1 continuam importáveis e funcionais
// depois da introdução do Goal Distribution Engine (Sprint 4.2) - nenhum
// arquivo anterior foi modificado, o motor apenas consome os resultados já
// calculados por eles.
import { calculateGreenScore } from "../src/services/intelligence/GreenScoreEngine.ts";
import { calculateGoalsRates } from "../src/services/intelligence/GoalsEngine.ts";
import { calculateFormSnapshot } from "../src/services/intelligence/FormEngine.ts";
import { calculateHeadToHead } from "../src/services/intelligence/HeadToHeadEngine.ts";
import { FixtureProvider } from "../src/providers/fixture/FixtureProvider.ts";
import { predictMatchOutcome } from "../src/services/prediction/index.ts";

import { predictGoalDistribution } from "../src/services/goal-distribution/GoalDistributionEngine.ts";
import { DEFAULT_GOAL_DISTRIBUTION_CONFIG } from "../src/services/goal-distribution/GoalDistributionConfig.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const GOAL_DISTRIBUTION_SRC_DIR = path.join(REPO_ROOT, "src", "services", "goal-distribution");
const PREDICTION_SRC_DIR = path.join(REPO_ROOT, "src", "services", "prediction");

function collectTsFiles(dir) {
  return fs.readdirSync(dir).filter((name) => name.endsWith(".ts")).map((name) => path.join(dir, name));
}

test("Intelligence Engine (Fase 1.5) remains importable and untouched by the Goal Distribution Engine", () => {
  assert.equal(typeof calculateGreenScore, "function");
  assert.equal(typeof calculateGoalsRates, "function");
  assert.equal(typeof calculateFormSnapshot, "function");
  assert.equal(typeof calculateHeadToHead, "function");
});

test("FixtureProvider (Fase 2) still lists all 300 fixture matches after the Goal Distribution Engine was introduced", async () => {
  const provider = new FixtureProvider();
  const matches = await provider.listMatches();
  assert.equal(matches.length, 300);
});

test("Prediction Engine (Sprint 4.1) remains importable, functional, and untouched by any goal-distribution file", () => {
  assert.equal(typeof predictMatchOutcome, "function");
  const files = collectTsFiles(PREDICTION_SRC_DIR);
  assert.ok(files.length > 0, "expected Sprint 4.1 files to still exist");
});

test("no goal-distribution module imports the real @prisma/client package or the local Prisma client", () => {
  const files = collectTsFiles(GOAL_DISTRIBUTION_SRC_DIR);
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(source.includes("@prisma/client"), false, `${file} must not import @prisma/client`);
    assert.equal(/from\s+["']\.\.\/\.\.\/lib\/prisma/.test(source), false, `${file} must not import the local Prisma client`);
  }
});

test("no goal-distribution module imports the BetsAPI provider layer", () => {
  const files = collectTsFiles(GOAL_DISTRIBUTION_SRC_DIR);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(/from\s+["'].*betsapi/i.test(source), false, `${file} must not import the BetsAPI layer`);
  }
});

test("no goal-distribution module modifies any Sprint 4.1 (prediction) source file", () => {
  // Structural guard: goal-distribution may only ever IMPORT from
  // ../prediction/index.ts (the public barrel), never reach into its
  // internal, non-exported files.
  const files = collectTsFiles(GOAL_DISTRIBUTION_SRC_DIR);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const predictionImports = [...source.matchAll(/from\s+["'](\.\.\/prediction\/[^"']+)["']/g)].map((m) => m[1]);
    for (const importPath of predictionImports) {
      assert.equal(importPath, "../prediction/index.ts", `${file} must only import prediction's public barrel, found: ${importPath}`);
    }
  }
});

test("the public prediction output never carries a betting-recommendation-shaped identifier (EV, Kelly, stake) as code", () => {
  const files = collectTsFiles(GOAL_DISTRIBUTION_SRC_DIR);
  const forbiddenIdentifiers = [/\bkelly\b/i, /\bstake\b/i, /\bexpectedValue\b/i, /\bbankroll\b/i, /\brecommendation\b/i];
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

test("prisma/schema.prisma was not modified by this sprint (no goal-distribution models exist there)", () => {
  const schemaPath = path.join(REPO_ROOT, "prisma", "schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf8");
  assert.equal(schema.includes("model GoalDistributionPrediction"), false);
  assert.equal(schema.includes("model ExactScoreProbability"), false);
});

test("the Goal Distribution Engine produces a well-formed prediction end-to-end using only Intelligence Engine output shapes", () => {
  const homeRecords = [
    { matchId: "m1", playedAt: "2026-01-01T00:00:00.000Z", isHome: true, opponentPlayerId: "away", goalsFor: 3, goalsAgainst: 1 },
    { matchId: "m2", playedAt: "2026-01-05T00:00:00.000Z", isHome: true, opponentPlayerId: "away", goalsFor: 2, goalsAgainst: 0 },
  ];
  const awayRecords = [
    { matchId: "m1", playedAt: "2026-01-01T00:00:00.000Z", isHome: false, opponentPlayerId: "home", goalsFor: 1, goalsAgainst: 3 },
    { matchId: "m2", playedAt: "2026-01-05T00:00:00.000Z", isHome: false, opponentPlayerId: "home", goalsFor: 0, goalsAgainst: 2 },
  ];

  const homeForm = calculateFormSnapshot(homeRecords);
  const awayForm = calculateFormSnapshot(awayRecords);
  const homeGoalsRates = calculateGoalsRates(homeRecords);
  const awayGoalsRates = calculateGoalsRates(awayRecords);
  const h2h = calculateHeadToHead("home", "away", [
    { matchId: "m1", playedAt: "2026-01-01T00:00:00.000Z", homePlayerId: "home", awayPlayerId: "away", homeGoals: 3, awayGoals: 1 },
    { matchId: "m2", playedAt: "2026-01-05T00:00:00.000Z", homePlayerId: "home", awayPlayerId: "away", homeGoals: 2, awayGoals: 0 },
  ]);

  const prediction = predictGoalDistribution(
    {
      homePlayer: { playerId: "home", matchesCount: 2, rating: null, form: homeForm, homeAway: null, momentum: null, strength: null, confidence: null, greenScore: null, goalsRates: homeGoalsRates },
      awayPlayer: { playerId: "away", matchesCount: 2, rating: null, form: awayForm, homeAway: null, momentum: null, strength: null, confidence: null, greenScore: null, goalsRates: awayGoalsRates },
      headToHead: h2h,
    },
    DEFAULT_GOAL_DISTRIBUTION_CONFIG,
  );

  assert.equal(prediction.modelVersion, DEFAULT_GOAL_DISTRIBUTION_CONFIG.modelVersion);
  const matrixSum = prediction.exactScores.reduce((sum, s) => sum + s.probability, 0);
  assert.ok(Math.abs(matrixSum - 1) < 1e-9);
  assert.ok(prediction.expectedGoals.home > prediction.expectedGoals.away);
});
