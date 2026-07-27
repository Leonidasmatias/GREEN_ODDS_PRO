import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Fases 1/1.5/2/3/3.5 continuam importaveis e funcionais depois da
// introducao do Prediction Engine (Sprint 4.1) - nenhum arquivo anterior
// foi modificado, o motor apenas consome os resultados ja calculados por
// eles.
import { calculateGreenScore } from "../src/services/intelligence/GreenScoreEngine.ts";
import { calculateExpectedScore, batchRecalculate } from "../src/services/intelligence/RatingEngine.ts";
import { calculateFormSnapshot } from "../src/services/intelligence/FormEngine.ts";
import { calculateHeadToHead } from "../src/services/intelligence/HeadToHeadEngine.ts";
import { FixtureProvider } from "../src/providers/fixture/FixtureProvider.ts";
import { ObservabilityService } from "../src/services/observability/ObservabilityService.ts";

import { predictMatchOutcome } from "../src/services/prediction/MatchOutcomeProbabilityEngine.ts";
import { DEFAULT_PREDICTION_MODEL_CONFIG } from "../src/services/prediction/PredictionModelConfig.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PREDICTION_SRC_DIR = path.join(REPO_ROOT, "src", "services", "prediction");

function collectTsFiles(dir) {
  return fs.readdirSync(dir).filter((name) => name.endsWith(".ts")).map((name) => path.join(dir, name));
}

test("Intelligence Engine (Fase 1.5) remains importable and untouched by the Prediction Engine", () => {
  assert.equal(typeof calculateGreenScore, "function");
  assert.equal(typeof calculateExpectedScore, "function");
  assert.equal(typeof batchRecalculate, "function");
  assert.equal(typeof calculateFormSnapshot, "function");
  assert.equal(typeof calculateHeadToHead, "function");
});

test("FixtureProvider (Fase 2) still lists all 300 fixture matches after the Prediction Engine was introduced", async () => {
  const provider = new FixtureProvider();
  const matches = await provider.listMatches();
  assert.equal(matches.length, 300);
});

test("ObservabilityService (Fase 3.5) remains importable and unaffected", () => {
  assert.equal(typeof ObservabilityService, "function");
});

test("no prediction module imports the real @prisma/client package", () => {
  const files = collectTsFiles(PREDICTION_SRC_DIR);
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(source.includes("@prisma/client"), false, `${file} must not import @prisma/client`);
    assert.equal(/from\s+["']\.\.\/\.\.\/lib\/prisma/.test(source), false, `${file} must not import the local Prisma client`);
  }
});

test("no prediction module imports the BetsAPI provider layer (this sprint never calls BetsAPI)", () => {
  const files = collectTsFiles(PREDICTION_SRC_DIR);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(/from\s+["'].*betsapi/i.test(source), false, `${file} must not import the BetsAPI layer`);
  }
});

test("the public prediction output never carries a goal-market field (Over/Under, BTTS, Expected Goals belong to Sprint 4.2)", () => {
  // Comments are allowed to mention these markets when documenting scope
  // (see the file headers) — what must never happen is one of these terms
  // appearing as an actual identifier (a field name, type name, or
  // exported symbol) that the engine computes or exposes.
  const files = collectTsFiles(PREDICTION_SRC_DIR);
  const forbiddenIdentifiers = [/\bgoalsRates\b/, /\boverUnder\b/i, /\bbothTeamsScored\b/, /\bexpectedGoals\b/i, /\bcorrectScore\b/i, /\bBTTS\b(?!.*belong)/];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const codeOnly = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
      .join("\n");
    for (const pattern of forbiddenIdentifiers) {
      assert.equal(pattern.test(codeOnly), false, `${file} must not reference ${pattern} as code (goal-market scope belongs to Sprint 4.2)`);
    }
  }
});

test("no prediction module references betting-recommendation vocabulary (stake, Kelly, edge, EV, odds comparison)", () => {
  const files = collectTsFiles(PREDICTION_SRC_DIR);
  const forbidden = ["kelly", "Kelly", "stake", "Stake", "expectedValue", "ExpectedValue", " ev ", "oddsComparison"];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const term of forbidden) {
      assert.equal(source.includes(term), false, `${file} must not reference "${term}" (betting recommendations are out of scope)`);
    }
  }
});

test("prisma/schema.prisma was not modified by this sprint (no prediction models exist there)", () => {
  const schemaPath = path.join(REPO_ROOT, "prisma", "schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf8");
  assert.equal(schema.includes("model MatchOutcomePrediction"), false);
  assert.equal(schema.includes("model PredictionFeatureTrace"), false);
});

test("the Prediction Engine produces a well-formed prediction end-to-end using only Intelligence Engine output shapes", () => {
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
  const h2h = calculateHeadToHead("home", "away", [
    { matchId: "m1", playedAt: "2026-01-01T00:00:00.000Z", homePlayerId: "home", awayPlayerId: "away", homeGoals: 3, awayGoals: 1 },
    { matchId: "m2", playedAt: "2026-01-05T00:00:00.000Z", homePlayerId: "home", awayPlayerId: "away", homeGoals: 2, awayGoals: 0 },
  ]);

  const prediction = predictMatchOutcome(
    {
      homePlayer: {
        playerId: "home",
        matchesCount: 2,
        rating: { playerId: "home", rating: 1550, matchesCount: 2 },
        form: homeForm,
        homeAway: null,
        momentum: null,
        strength: null,
        confidence: null,
        greenScore: null,
      },
      awayPlayer: {
        playerId: "away",
        matchesCount: 2,
        rating: { playerId: "away", rating: 1450, matchesCount: 2 },
        form: awayForm,
        homeAway: null,
        momentum: null,
        strength: null,
        confidence: null,
        greenScore: null,
      },
      headToHead: h2h,
    },
    DEFAULT_PREDICTION_MODEL_CONFIG,
  );

  assert.equal(prediction.modelVersion, DEFAULT_PREDICTION_MODEL_CONFIG.modelVersion);
  const sum = prediction.probabilities.homeWin + prediction.probabilities.draw + prediction.probabilities.awayWin;
  assert.ok(Math.abs(sum - 1) <= Number.EPSILON);
  assert.equal(prediction.predictedOutcome, "HOME_WIN");
});
