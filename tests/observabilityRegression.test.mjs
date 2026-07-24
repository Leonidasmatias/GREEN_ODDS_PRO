import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Fase 1/1.5/2/3 continuam importaveis e funcionais depois da introducao
// da camada de observabilidade (Fase 3.5) - nenhum arquivo anterior foi
// modificado, apenas composto por fora.
import { FixtureProvider } from "../src/providers/fixture/FixtureProvider.ts";
import { IngestionPipeline } from "../src/providers/pipeline/IngestionPipeline.ts";
import { calculateGreenScore } from "../src/services/intelligence/GreenScoreEngine.ts";
import { classifyEsoccerEvent } from "../src/providers/betsapi/EsoccerClassifier.ts";
import { BetsApiSyncService } from "../src/providers/betsapi/BetsApiSyncService.ts";
import { ProviderHealthService } from "../src/providers/pipeline/ProviderHealthService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OBSERVABILITY_SRC_DIR = path.join(REPO_ROOT, "src", "services", "observability");
const OBSERVABILITY_REPO_DIR = path.join(REPO_ROOT, "src", "repositories", "observability");

test("FixtureProvider (Fase 2) still lists all 300 fixture matches after Fase 3.5 was introduced", async () => {
  const provider = new FixtureProvider();
  const matches = await provider.listMatches();
  assert.equal(matches.length, 300);
});

test("IngestionPipeline, BetsApiSyncService and ProviderHealthService (Fases 2/3) remain importable and are still classes/functions", () => {
  assert.equal(typeof IngestionPipeline, "function");
  assert.equal(typeof BetsApiSyncService, "function");
  assert.equal(typeof ProviderHealthService, "function");
});

test("calculateGreenScore (Intelligence Engine, Fase 1.5) remains importable and untouched by the observability layer", () => {
  assert.equal(typeof calculateGreenScore, "function");
});

test("classifyEsoccerEvent (Fase 3) keeps its documented >=2-signal rule for confirmed_esoccer", () => {
  const result = classifyEsoccerEvent(
    { id: "e1", is_esports: true, league: { id: "l1", name: "Any League" }, home: { name: "TeamA (player-01)" }, away: { name: "TeamB (player-02)" }, time: "1735689600", time_status: "0", ss: null },
    { allowlist: [], denylist: [] },
  );
  assert.equal(result.classification, "confirmed_esoccer");
});

function collectTsFiles(dir) {
  return fs.readdirSync(dir).filter((name) => name.endsWith(".ts")).map((name) => path.join(dir, name));
}

test("no observability module imports the real @prisma/client package (PrismaObservabilityRepository stays duck-typed, never a real import)", () => {
  const files = [...collectTsFiles(OBSERVABILITY_SRC_DIR), ...collectTsFiles(OBSERVABILITY_REPO_DIR)];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(source.includes("@prisma/client"), false, `${file} must not import @prisma/client`);
    assert.equal(/from\s+["']@prisma\/client["']/.test(source), false, `${file} must not import from @prisma/client`);
  }
});

test("no observability module imports the Intelligence Engine (GreenScoreEngine/FormEngine/MomentumEngine)", () => {
  const files = [...collectTsFiles(OBSERVABILITY_SRC_DIR), ...collectTsFiles(OBSERVABILITY_REPO_DIR)];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const forbidden of ["GreenScoreEngine", "FormEngine", "MomentumEngine"]) {
      assert.equal(source.includes(forbidden), false, `${file} must not reference ${forbidden}`);
    }
  }
});

test("no observability module ever reads env.BETSAPI_TOKEN or process.env.BETSAPI_TOKEN directly (comments explaining this restriction are fine)", () => {
  const files = [...collectTsFiles(OBSERVABILITY_SRC_DIR), ...collectTsFiles(OBSERVABILITY_REPO_DIR)];
  const forbiddenPattern = /\benv\.BETSAPI_TOKEN\b|process\.env\.BETSAPI_TOKEN\b/;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(forbiddenPattern.test(source), false, `${file} must never read BETSAPI_TOKEN from env`);
  }
});

test("prisma/schema.prisma was not modified by this phase (no observability models exist there)", () => {
  const schemaPath = path.join(REPO_ROOT, "prisma", "schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf8");
  assert.equal(schema.includes("ObservabilitySyncRun"), false);
  assert.equal(schema.includes("ObservabilityDataQualitySnapshot"), false);
  assert.equal(schema.includes("ObservabilityAlert"), false);
});
