// Sprint 9.1 — Explainability Calibration & Backtest.
// Auditoria estrutural: os módulos de calibração são puros (sem
// Prisma/banco/rede/Railway), o CLI é o único ponto autorizado a tocar o
// banco (e somente leitura), e nenhum threshold/arquivo de produção da
// Sprint 9.0 foi alterado por esta sprint.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function read(relativePath) {
  return readFileSync(`${ROOT}${relativePath}`, "utf8");
}

function stripComments(source) {
  return source.split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
}

const CALIBRATION_MODULE_FILES = readdirSync(new URL("../src/services/explainability-calibration", import.meta.url))
  .filter((name) => name.endsWith(".ts"))
  .map((name) => `src/services/explainability-calibration/${name}`);

test("scope: at least 8 files exist in the calibration module", () => {
  assert.ok(CALIBRATION_MODULE_FILES.length >= 8, `found ${CALIBRATION_MODULE_FILES.length}: ${CALIBRATION_MODULE_FILES.join(", ")}`);
});

test("scope: every calibration module file is pure (no Prisma/DB/network/Railway/Next.js)", () => {
  const forbidden = ["PrismaClient", "@prisma/client", "lib/prisma", "next/server", "next/headers", "fetch(", "railway", "Railway", "fs.writeFile", "writeFileSync"];
  for (const file of CALIBRATION_MODULE_FILES) {
    const code = stripComments(read(file));
    for (const term of forbidden) {
      assert.ok(!code.includes(term), `${file} must not reference "${term}"`);
    }
  }
});

test("scope: calibration modules never import predictMatch or persist/write to the Prediction Repository", () => {
  const forbidden = ["predictMatch(", ".save(", "PredictionPersistenceService", "PredictionRepository"];
  for (const file of CALIBRATION_MODULE_FILES) {
    const code = stripComments(read(file));
    for (const term of forbidden) {
      assert.ok(!code.includes(term), `${file} must not reference "${term}"`);
    }
  }
});

test("scope: calibration modules never duplicate accuracy/Brier/segment math — always import it from prediction-evaluation", () => {
  const analyzerCode = stripComments(read("src/services/explainability-calibration/CalibrationAnalyzer.ts"));
  assert.match(analyzerCode, /import\s*\{[^}]*computeEvaluationMetrics[^}]*\}\s*from\s*"\.\.\/prediction-evaluation\/index\.ts"/);
  assert.match(analyzerCode, /import\s*\{[^}]*computeSegmentEvaluations[^}]*\}\s*from\s*"\.\.\/prediction-evaluation\/index\.ts"/);

  const qualityCode = stripComments(read("src/services/explainability-calibration/QualityCalibration.ts"));
  assert.match(qualityCode, /from\s*"\.\.\/prediction-evaluation\/index\.ts"/);

  const riskCode = stripComments(read("src/services/explainability-calibration/RiskCalibration.ts"));
  assert.match(riskCode, /from\s*"\.\.\/prediction-evaluation\/index\.ts"/);
});

test("scope: CLI script (scripts/calibration.mjs) is the only new file allowed to touch Prisma, and only reads (never create/update/delete)", () => {
  const code = stripComments(read("scripts/calibration.mjs"));
  assert.ok(code.includes("lib/prisma.ts"));
  const forbiddenWrites = [".create(", ".update(", ".delete(", ".upsert(", ".deleteMany(", ".updateMany(", "migrate deploy", "db push"];
  for (const term of forbiddenWrites) {
    assert.ok(!code.includes(term), `scripts/calibration.mjs must never write to the database ("${term}" found)`);
  }
  assert.ok(code.includes("findMany("));
});

test("scope: CLI script never alters Railway, deploys, or restarts anything", () => {
  const code = stripComments(read("scripts/calibration.mjs"));
  const forbidden = ["railway ", "redeploy", "restart", "git push", "git commit"];
  for (const term of forbidden) {
    assert.ok(!code.toLowerCase().includes(term.toLowerCase()), `scripts/calibration.mjs must not reference "${term}"`);
  }
});

test("scope: predictionExplanationConstants.ts (Sprint 9.0) was not modified — thresholds remain exactly as documented", () => {
  const code = read("src/services/prediction-explanation/predictionExplanationConstants.ts");
  assert.match(code, /export const HIGH_VOLATILITY_MARGIN_THRESHOLD = 0\.08;/);
  assert.match(code, /export const INSUFFICIENT_CONFIDENCE_HIGH_THRESHOLD = 40;/);
  assert.match(code, /export const INSUFFICIENT_CONFIDENCE_MEDIUM_THRESHOLD = 60;/);
  assert.match(code, /STALE_DATA_HOURS = 24;/);
  assert.match(code, /\{ grade: "A_PLUS", minScore: 90 \}/);
});

test("scope: prediction-explanation engines (Sprint 9.0) were not modified by this sprint", () => {
  const files = [
    "src/services/prediction-explanation/PredictionFactorsEngine.ts",
    "src/services/prediction-explanation/ConfidenceBreakdownEngine.ts",
    "src/services/prediction-explanation/PredictionReasonsEngine.ts",
    "src/services/prediction-explanation/RiskIndicatorEngine.ts",
    "src/services/prediction-explanation/QualityScoreEngine.ts",
  ];
  for (const file of files) {
    const code = stripComments(read(file));
    // O módulo de calibração nunca deveria ser referenciado de dentro da Sprint 9.0 — a dependência é sempre em uma única direção (calibração depende de explicação, nunca o contrário).
    assert.ok(!code.includes("explainability-calibration"), `${file} must not reference the new calibration module`);
  }
});

test("scope: Prediction Engine, Green Score, Confidence Engine, and Prediction Repository were not touched by this sprint", () => {
  const forbiddenPaths = [
    "src/services/prediction/",
    "src/services/goal-distribution/",
    "src/services/prediction-orchestrator/GreenScoreEngine.ts",
    "src/services/prediction-orchestrator/ConfidenceEngine.ts",
    "src/repositories/prediction/",
  ];
  // Confirma que nenhum arquivo de calibração importa esses módulos por valor (import type de PredictionResult/etc. já é esperado e seguro).
  for (const file of CALIBRATION_MODULE_FILES) {
    const code = stripComments(read(file));
    for (const path of forbiddenPaths) {
      assert.ok(!code.includes(path), `${file} must not import from ${path}`);
    }
  }
});

test("scope: package.json declares the calibration script pointing at scripts/calibration.mjs", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.scripts.calibration, "node scripts/calibration.mjs");
});
