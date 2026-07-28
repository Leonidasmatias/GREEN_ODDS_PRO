// Sprint 6.5 — Prediction Center, Incremento 7 (Access Control).
// Ao contrário de `accessControlRules.test.mjs` (que testa uma cópia
// local de `canAccessFeature`), este arquivo importa a implementação
// REAL de `src/services/subscriptionAccess.ts` — evita duplicar a
// lógica testada, mesmo cuidado já corrigido na Sprint 6.0 para
// `intelligenceDashboardService.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROTECTED_ROUTES, ROUTE_FEATURE, canAccessFeature } from "../src/services/subscriptionAccess.ts";

const MIDDLEWARE_SOURCE_PATH = fileURLToPath(new URL("../src/middleware.ts", import.meta.url));
const SIDEBAR_SOURCE_PATH = fileURLToPath(new URL("../src/components/Sidebar.tsx", import.meta.url));

test("/prediction is mapped to the predictionCenter feature in ROUTE_FEATURE", () => {
  assert.equal(ROUTE_FEATURE["/prediction"], "predictionCenter");
});

test("/prediction is registered in PROTECTED_ROUTES", () => {
  assert.ok(PROTECTED_ROUTES.includes("/prediction"));
});

test("PREMIUM has access to predictionCenter", () => {
  assert.equal(canAccessFeature("PREMIUM", "predictionCenter").allowed, true);
});

test("FREE does not have access to predictionCenter (UPGRADE_REQUIRED)", () => {
  const result = canAccessFeature("FREE", "predictionCenter");
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "UPGRADE_REQUIRED");
});

test("PRO does not have access to predictionCenter (PREMIUM_REQUIRED) — same tier as commandCenter/performanceCenter/intelligence", () => {
  const result = canAccessFeature("PRO", "predictionCenter");
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "PREMIUM_REQUIRED");
});

test("no active plan (null) never grants access to predictionCenter", () => {
  const result = canAccessFeature(null, "predictionCenter");
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "NO_ACTIVE_PLAN");
});

test("regression: existing PREMIUM-only features (commandCenter, performanceCenter, intelligence) are unaffected", () => {
  for (const feature of ["commandCenter", "performanceCenter", "intelligence"]) {
    assert.equal(canAccessFeature("PREMIUM", feature).allowed, true);
    assert.equal(canAccessFeature("PRO", feature).allowed, false);
    assert.equal(canAccessFeature("FREE", feature).allowed, false);
  }
});

test("regression: dashboard remains universally allowed for any active plan, still blocked with no plan at all", () => {
  assert.equal(canAccessFeature("FREE", "dashboard").allowed, true);
  assert.equal(canAccessFeature("PRO", "dashboard").allowed, true);
  assert.equal(canAccessFeature("PREMIUM", "dashboard").allowed, true);
  assert.equal(canAccessFeature(null, "dashboard").allowed, false);
});

test("regression: every other ROUTE_FEATURE mapping is unchanged", () => {
  assert.equal(ROUTE_FEATURE["/dashboard"], "dashboard");
  assert.equal(ROUTE_FEATURE["/radar-green"], "radarGreen");
  assert.equal(ROUTE_FEATURE["/odds-do-dia"], "oddsDoDia");
  assert.equal(ROUTE_FEATURE["/green-ai-report"], "greenAiReport");
  assert.equal(ROUTE_FEATURE["/command-center"], "commandCenter");
  assert.equal(ROUTE_FEATURE["/performance-center"], "performanceCenter");
  assert.equal(ROUTE_FEATURE["/intelligence"], "intelligence");
});

// `middleware.ts` importa `next/server` (`NextRequest`/`NextResponse`),
// não resolvível por `node --test` puro (mesma limitação já documentada
// para `next/headers` em `authService.ts`) — por isso a cobertura de
// `PROTECTED_PREFIXES`/`matcher` é estrutural (leitura do próprio
// código-fonte), mesma técnica já usada em
// `tests/predictionCenterFixture.test.mjs` (Incremento 2) para checar
// ausência de imports proibidos.
test("middleware source declares /prediction in PROTECTED_PREFIXES", () => {
  const source = readFileSync(MIDDLEWARE_SOURCE_PATH, "utf8");
  const prefixesLine = source.split("\n").find((line) => line.includes("PROTECTED_PREFIXES ="));
  assert.ok(prefixesLine, "PROTECTED_PREFIXES declaration not found in middleware.ts");
  assert.ok(prefixesLine.includes('"/prediction"'));
});

test("middleware source declares /prediction/:path* in config.matcher", () => {
  const source = readFileSync(MIDDLEWARE_SOURCE_PATH, "utf8");
  const matcherLine = source.split("\n").find((line) => line.includes("matcher:"));
  assert.ok(matcherLine, "matcher declaration not found in middleware.ts");
  assert.ok(matcherLine.includes('"/prediction/:path*"'));
});

test("middleware source still declares every previously protected prefix (no regression)", () => {
  const source = readFileSync(MIDDLEWARE_SOURCE_PATH, "utf8");
  const prefixesLine = source.split("\n").find((line) => line.includes("PROTECTED_PREFIXES ="));
  for (const prefix of ["/dashboard", "/radar-green", "/odds-do-dia", "/green-ai-report", "/command-center", "/performance-center", "/intelligence"]) {
    assert.ok(prefixesLine.includes(`"${prefix}"`), `expected PROTECTED_PREFIXES to still include "${prefix}"`);
  }
});

// A Sidebar (`src/components/Sidebar.tsx`) não filtra itens por
// plano/feature hoje — nenhum item PREMIUM-only pré-existente
// (Command Center, Intelligence Center) é ocultado condicionalmente,
// confirmado por auditoria antes deste incremento. Este teste confirma
// apenas que o item foi adicionado, seguindo o MESMO padrão real (link
// incondicional, protegido no servidor) — não testa uma ocultação
// condicional que não existe em nenhum item da Sidebar.
test("Sidebar registers the Prediction Center entry, following the same unconditional-link pattern as every other route", () => {
  const source = readFileSync(SIDEBAR_SOURCE_PATH, "utf8");
  assert.ok(source.includes('"/prediction"'));
  assert.ok(source.includes("Prediction Center"));
});
