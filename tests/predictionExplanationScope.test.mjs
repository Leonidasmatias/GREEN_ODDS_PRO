// Sprint 9.0 — Prediction Intelligence Framework.
// Auditoria estrutural de escopo: confirma, por leitura de código-fonte,
// que os endpoints existentes da Sprint 8.1 não foram alterados, que o
// novo endpoint segue exatamente o mesmo padrão de autenticação/runtime,
// e que a UI de explicação permanece desacoplada de
// Repository/Prisma/composition root, igual à UI de histórico (Sprint 8.2).
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

test("scope: existing prediction routes (Sprint 8.1) are untouched by this sprint", () => {
  const existingRoutes = [
    "src/app/api/predictions/route.ts",
    "src/app/api/predictions/[id]/route.ts",
    "src/app/api/predictions/match/[matchId]/route.ts",
    "src/app/api/predictions/match/[matchId]/latest/route.ts",
  ];
  for (const route of existingRoutes) {
    const code = read(route);
    // O novo endpoint de explicação nunca deveria ser referenciado pelos
    // endpoints existentes — eles continuam exatamente como estavam.
    assert.ok(!code.includes("explanation"), `${route} must not reference the new explanation endpoint`);
  }
});

test("scope: the new explanation route follows the exact same auth/runtime pattern as existing routes", () => {
  const code = read("src/app/api/predictions/[id]/explanation/route.ts");
  assert.match(code, /getApiAccess\("predictionCenter",/);
  assert.match(code, /export const dynamic = "force-dynamic"/);
  assert.match(code, /export const runtime = "nodejs"/);
  assert.ok(!code.includes("export async function POST"), "explanation route must be read-only (GET only)");
});

test("scope: predictionExplanationApiHandlers.ts never calls the Prediction Engine or persists", () => {
  const code = stripComments(read("src/services/predictionExplanationApiHandlers.ts"));
  const forbidden = ["predictMatch(", ".save(", "generateAndPersistPredictionCenterData"];
  for (const term of forbidden) {
    assert.ok(!code.includes(term), `predictionExplanationApiHandlers.ts must not reference "${term}"`);
  }
});

test("scope: prediction-explanation engines never import Prisma, Repository, or Next.js runtime modules", () => {
  const files = [
    "src/services/prediction-explanation/PredictionFactorsEngine.ts",
    "src/services/prediction-explanation/ConfidenceBreakdownEngine.ts",
    "src/services/prediction-explanation/PredictionReasonsEngine.ts",
    "src/services/prediction-explanation/RiskIndicatorEngine.ts",
    "src/services/prediction-explanation/QualityScoreEngine.ts",
    "src/services/prediction-explanation/PredictionExplanationEngine.ts",
  ];
  const forbidden = ["PrismaClient", "@prisma/client", "next/server", "next/headers", "PredictionRepository", "lib/prisma", "predictMatch("];
  for (const file of files) {
    const code = stripComments(read(file));
    for (const term of forbidden) {
      assert.ok(!code.includes(term), `${file} must not reference "${term}"`);
    }
  }
});

test("scope: PredictionExplanationSection.tsx only imports from predictionApiClient/predictionExplanationFormatters (same boundary as the rest of the history UI)", () => {
  const code = stripComments(read("src/components/prediction-history/PredictionExplanationSection.tsx"));
  const forbidden = ["PredictionRepository", "PrismaClient", "@prisma/client", "prediction-explanation/", "prediction-query/", "lib/prisma"];
  for (const term of forbidden) {
    assert.ok(!code.includes(term), `PredictionExplanationSection.tsx must not reference "${term}"`);
  }
  assert.ok(code.includes("@/lib/predictionApiClient"));
});

test("scope: PredictionHistoryDetailPanel.tsx addition is purely additive (existing sections still present)", () => {
  const code = read("src/components/prediction-history/PredictionHistoryDetailPanel.tsx");
  const existingSections = ["PredictionHeader", "PredictionSummary", "PredictionConfidenceCard", "PredictionMarkets", "PredictionRecommendation", "PredictionFactors", "PredictionRiskPanel"];
  for (const section of existingSections) {
    assert.ok(code.includes(section), `PredictionHistoryDetailPanel.tsx must still render ${section}`);
  }
  assert.ok(code.includes("PredictionExplanationSection"));
});

test("scope: predictionApiClient.ts explanation function never issues POST and only adds to the existing surface", () => {
  const code = stripComments(read("src/lib/predictionApiClient.ts"));
  assert.ok(code.includes("getPredictionExplanation"));
  assert.ok(!code.includes('"POST"') && !code.includes("'POST'"));
});
