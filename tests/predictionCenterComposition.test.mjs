// Sprint 8.3 — Production Persistence.
// Prova, por PROCESSO REAL (nunca por mock/leitura de código), que
// `predictionCenterComposition.ts` seleciona o Repository certo para
// cada ambiente e nunca cai silenciosamente para
// `InMemoryPredictionRepository` em produção. Cada cenário roda em um
// processo `node` novo porque a seleção acontece uma única vez, no
// topo do módulo, na primeira importação daquele processo.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHECK_SCRIPT = "scripts/predictionPersistenceValidation/checkComposition.mjs";
const DATABASE_URL = process.env.DATABASE_URL;
const skipRealDb = DATABASE_URL ? false : "DATABASE_URL não definido — cenário de produção com Postgres real pulado neste ambiente.";

function runComposition(env) {
  return execFileSync("node", [CHECK_SCRIPT], { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env } });
}

test("development (NODE_ENV unset): selects InMemoryPredictionRepository, never throws", () => {
  const output = runComposition({ NODE_ENV: "", DATABASE_URL: "" });
  const health = JSON.parse(output);
  assert.deepEqual(health, { status: "available", backend: "memory", detail: null });
});

test('test (NODE_ENV="test"): selects InMemoryPredictionRepository, never throws, even without DATABASE_URL', () => {
  const output = runComposition({ NODE_ENV: "test", DATABASE_URL: "" });
  const health = JSON.parse(output);
  assert.deepEqual(health, { status: "available", backend: "memory", detail: null });
});

test('production (NODE_ENV="production") without DATABASE_URL: fails loudly, never falls back to InMemory', () => {
  assert.throws(
    () => runComposition({ NODE_ENV: "production", DATABASE_URL: "" }),
    (error) => {
      assert.match(error.stderr.toString(), /DATABASE_URL ausente em produção/);
      assert.match(error.stderr.toString(), /PredictionCenterMisconfiguredError|nunca cai silenciosamente/);
      return true;
    },
  );
});

test('production (NODE_ENV="production") WITH a real DATABASE_URL: selects PrismaPredictionRepository and reports it healthy', { skip: skipRealDb }, () => {
  const output = runComposition({ NODE_ENV: "production", DATABASE_URL });
  const health = JSON.parse(output);
  assert.deepEqual(health, { status: "available", backend: "prisma", detail: null });
});
