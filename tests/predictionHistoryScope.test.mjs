// Sprint 8.2 — Prediction Dashboard and Timeline.
// Auditoria estrutural de escopo: confirma, por leitura direta do
// código-fonte, que a UI de histórico de previsões permanece
// completamente desacoplada de Repository/Prisma/Application
// Services/composition root, nunca chama POST, e usa exclusivamente os
// contratos PredictionSummary/PredictionDetail/PredictionQueryPage via
// `predictionApiClient.ts`. Mesma técnica já usada em
// `predictionApiHandlers.test.mjs` (Sprint 8.1): comentários `//` são
// removidos antes do scan para não gerar falso-positivo contra os
// próprios comentários explicativos deste arquivo.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const UI_FILES = [
  "src/lib/predictionApiClient.ts",
  "src/lib/predictionHistoryFormatters.ts",
  "src/app/prediction/history/page.tsx",
  "src/app/prediction/history/loading.tsx",
  "src/app/prediction/history/error.tsx",
  ...readdirSync(new URL("../src/components/prediction-history", import.meta.url))
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .map((name) => `src/components/prediction-history/${name}`),
];

function stripComments(source) {
  return source.split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
}

function readUiFile(relativePath) {
  return stripComments(readFileSync(`${ROOT}${relativePath}`, "utf8"));
}

test("scope: at least the expected UI files exist and were scanned", () => {
  assert.ok(UI_FILES.length >= 12, `expected at least 12 UI files, found ${UI_FILES.length}: ${UI_FILES.join(", ")}`);
});

const FORBIDDEN_TERMS = [
  "PrismaPredictionRepository",
  "InMemoryPredictionRepository",
  "PredictionQueryService",
  "PredictionPersistenceService",
  "predictionCenterComposition",
  "predictionCenterApplication",
  "PrismaClient",
  "@prisma/client",
  "lib/prisma\"",
  "@/lib/prisma\"",
  "PredictionSnapshotMapper",
  "PredictionSnapshotRecord",
  "snapshotPayload",
  "predictionCenterService",
  "predictionApiHandlers",
  "next/server",
];

test("scope: no UI file imports Repository/Prisma/Application Services/composition root/handlers directly", () => {
  for (const relativePath of UI_FILES) {
    const code = readUiFile(relativePath);
    for (const term of FORBIDDEN_TERMS) {
      assert.ok(!code.includes(term), `${relativePath} must not reference "${term}"`);
    }
  }
});

test("scope: predictionApiClient.ts is the ONLY file allowed to import from src/services or src/repositories (type-only)", () => {
  for (const relativePath of UI_FILES) {
    if (relativePath === "src/lib/predictionApiClient.ts") continue;
    const code = readUiFile(relativePath);
    assert.ok(!code.includes("../services/") && !code.includes("../repositories/"), `${relativePath} must not import from services/repositories directly`);
  }
  const clientCode = readUiFile("src/lib/predictionApiClient.ts");
  // As únicas referências permitidas são `import type` (apagadas em
  // tempo de execução) — nunca um `import` de valor.
  const importLines = clientCode.split("\n").filter((line) => line.trim().startsWith("import"));
  for (const line of importLines) {
    if (line.includes("../services/") || line.includes("../repositories/")) {
      assert.ok(line.includes("import type"), `expected type-only import, got: ${line}`);
    }
  }
});

test("scope: no UI file ever issues a POST request", () => {
  for (const relativePath of UI_FILES) {
    const code = readUiFile(relativePath);
    assert.ok(!code.includes('"POST"') && !code.includes("'POST'"), `${relativePath} must never issue a POST request`);
  }
});

test("scope: the history route reuses the same predictionCenter auth gate as /prediction", () => {
  const subscriptionAccess = readFileSync(`${ROOT}src/services/subscriptionAccess.ts`, "utf8");
  assert.match(subscriptionAccess, /"\/prediction\/history":\s*"predictionCenter"/);
  assert.match(subscriptionAccess, /"\/prediction\/history"/);

  const page = readUiFile("src/app/prediction/history/page.tsx");
  assert.match(page, /requireRouteAccess\("\/prediction\/history"\)/);
});

test("scope: PredictionHistoryList never fetches PredictionDetail for individual items (no N+1)", () => {
  const code = readUiFile("src/components/prediction-history/PredictionHistoryList.tsx");
  assert.ok(!code.includes("getPredictionById"), "PredictionHistoryList must render PredictionSummary only, never fetch detail per item");
});

test("scope: PredictionHistoryTimeline never calls the /latest endpoint (uses the first ordered item instead)", () => {
  const code = readUiFile("src/components/prediction-history/PredictionHistoryTimeline.tsx");
  assert.ok(!code.includes("getLatestPredictionByMatch"), "Timeline must rely on generatedAt desc ordering, never an extra /latest call");
});

test("scope: PredictionHistoryDashboard never fetches PredictionDetail directly (only the summary list)", () => {
  const code = readUiFile("src/components/prediction-history/PredictionHistoryDashboard.tsx");
  assert.ok(!code.includes("getPredictionById("), "Dashboard must delegate detail-fetching to PredictionHistoryDetailPanel only");
});

test("scope: predictionApiClient.ts exposes no generation/persistence function", () => {
  const code = readUiFile("src/lib/predictionApiClient.ts");
  assert.ok(!/export\s+(async\s+)?function\s+generate/i.test(code));
  assert.ok(!/export\s+(async\s+)?function\s+persist/i.test(code));
});
