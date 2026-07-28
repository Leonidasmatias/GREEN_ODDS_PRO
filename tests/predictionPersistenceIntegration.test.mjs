// Sprint 8.3 — Production Persistence.
// Testes de INTEGRAÇÃO REAL: nunca usam fake/delegate — constroem um
// `PrismaClient` de verdade e falam com um Postgres de verdade. Só
// rodam quando `DATABASE_URL` está definida no ambiente (nenhum outro
// arquivo de teste deste projeto depende de banco real, então este é
// pulado automaticamente — nunca quebra `npm test` em máquinas sem
// Postgres configurado). Complementa (nunca substitui)
// `tests/prismaPredictionRepository.test.mjs` (Sprint 7.x, que testa
// exclusivamente com um delegate fake).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPredictionRepository } from "../src/repositories/prediction/PrismaPredictionRepository.ts";
import { computePredictionSnapshotHash } from "../src/repositories/prediction/PredictionRepository.ts";
import { PredictionQueryService } from "../src/services/prediction-query/PredictionQueryService.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;
const skip = DATABASE_URL ? false : "DATABASE_URL não definido — integração real contra Postgres pulada neste ambiente.";

function uniqueRunId(label) {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function snapshot(overrides = {}) {
  const runId = overrides.runId ?? uniqueRunId("snap");
  return {
    matchId: overrides.matchId ?? `integration-${runId}`,
    homePlayerId: "int-home",
    awayPlayerId: "int-away",
    virtualTeamHome: "Integration FC",
    virtualTeamAway: "Postgres United",
    league: "Integration League",
    period: "2026-07",
    sequenceKey: 1,
    result: {
      metadata: {
        generatedAt: overrides.generatedAt ?? "2026-07-28T09:00:00.000Z",
        configurationHash: overrides.configurationHash ?? "int-config",
        orchestratorModelVersion: "esoccer-prediction-orchestrator-v1.0.0-provisional",
      },
      greenScore: { score: 77.7, category: "HIGH" },
      confidence: 80.1,
      prediction: { predictedOutcome: "HOME_WIN", probabilities: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 }, topProbability: 0.5, probabilityMargin: 0.2 },
      goalDistribution: { mostLikelyScore: { homeGoals: 2, awayGoals: 1, probability: 0.15 }, overUnder: [{ line: 2.5, over: 0.55 }], bothTeamsToScore: { yes: 0.4, no: 0.6 } },
      quality: { combinedStatus: "SUFFICIENT", consistency: { level: "ALIGNED", matchingWinner: true } },
      explanation: { topSignals: [], totalSignalsConsidered: 5 },
      warnings: [],
    },
  };
}

function draft(overrides = {}) {
  const snap = snapshot(overrides);
  return {
    snapshotHash: computePredictionSnapshotHash(snap),
    schemaVersion: "1.0",
    modelVersion: snap.result.metadata.orchestratorModelVersion,
    configurationHash: snap.result.metadata.configurationHash,
    source: "fixture",
    snapshot: snap,
  };
}

let client;
let repository;

before(() => {
  if (skip) return;
  client = new PrismaClient();
  repository = new PrismaPredictionRepository(client);
});

after(async () => {
  if (!client) return;
  // Limpeza dos dados criados por esta suíte — não deixa lixo no banco
  // de teste entre execuções repetidas.
  await client.predictionSnapshotRecord.deleteMany({ where: { matchId: { startsWith: "integration-" } } });
  await client.predictionSnapshotRecord.deleteMany({ where: { matchId: { startsWith: "restart-check-" } } });
  await client.$disconnect();
});

test("health(): reports available/prisma against a real database", { skip }, async () => {
  const health = await repository.health();
  assert.deepEqual(health, { status: "available", backend: "prisma", detail: null });
});

test("save() -> getById(): returns the exact same snapshot, no field lost (recommendation/markets/metadata/hashes/factors/confidence/risk/green score)", { skip }, async () => {
  const d = draft();
  const saved = await repository.save(d);
  const found = await repository.getById(saved.id);
  assert.deepEqual(found, saved);
  assert.deepEqual(found.snapshot, d.snapshot);
});

test("idempotency: saving the same draft twice never duplicates and returns the same id", { skip }, async () => {
  const d = draft();
  const first = await repository.save(d);
  const second = await repository.save(d);
  assert.equal(first.id, second.id);
  const result = await repository.search({ matchId: d.snapshot.matchId });
  assert.equal(result.total, 1);
});

test("consistency: getById/search-as-getByMatch/search-as-getLatestByMatch all agree on the same record", { skip }, async () => {
  const d = draft();
  const saved = await repository.save(d);

  const byId = await repository.getById(saved.id);
  const bySearch = await repository.search({ matchId: d.snapshot.matchId });
  const latest = await repository.search({ matchId: d.snapshot.matchId }, { orderBy: "generatedAt", orderDirection: "desc", limit: 1, offset: 0 });

  assert.deepEqual(byId, saved);
  assert.deepEqual(bySearch.items[0], saved);
  assert.deepEqual(latest.items[0], saved);
});

test("search(): filters by matchId/league/period against the real database (not an in-memory array)", { skip }, async () => {
  const runId = uniqueRunId("filter");
  const matchId = `integration-${runId}`;
  await repository.save(draft({ runId, matchId }));
  const result = await repository.search({ matchId, league: "Integration League", period: "2026-07" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].snapshot.matchId, matchId);
});

test("search(): pagination (limit/offset/orderBy/orderDirection) against multiple real rows for the same match", { skip }, async () => {
  const runId = uniqueRunId("page");
  const matchId = `integration-${runId}`;
  await repository.save(draft({ runId: `${runId}-a`, matchId, generatedAt: "2026-07-28T09:00:00.000Z", configurationHash: "cfg-a" }));
  await repository.save(draft({ runId: `${runId}-b`, matchId, generatedAt: "2026-07-28T10:00:00.000Z", configurationHash: "cfg-b" }));
  await repository.save(draft({ runId: `${runId}-c`, matchId, generatedAt: "2026-07-28T11:00:00.000Z", configurationHash: "cfg-c" }));

  const page1 = await repository.search({ matchId }, { orderBy: "generatedAt", orderDirection: "desc", limit: 2, offset: 0 });
  assert.equal(page1.total, 3);
  assert.equal(page1.items.length, 2);
  assert.equal(page1.items[0].snapshot.result.metadata.generatedAt, "2026-07-28T11:00:00.000Z");
  assert.equal(page1.items[1].snapshot.result.metadata.generatedAt, "2026-07-28T10:00:00.000Z");

  const page2 = await repository.search({ matchId }, { orderBy: "generatedAt", orderDirection: "desc", limit: 2, offset: 2 });
  assert.equal(page2.items.length, 1);
  assert.equal(page2.items[0].snapshot.result.metadata.generatedAt, "2026-07-28T09:00:00.000Z");
});

test("Query Service contracts (PredictionSummary/PredictionDetail/PredictionQueryPage) remain unchanged against the real Prisma-backed repository", { skip }, async () => {
  const queryService = new PredictionQueryService(repository);
  const d = draft();
  const saved = await repository.save(d);

  const page = await queryService.search({ matchId: d.snapshot.matchId });
  assert.equal(page.total, 1);
  assert.deepEqual(Object.keys(page).sort(), ["hasNextPage", "hasPreviousPage", "items", "limit", "offset", "total"]);

  const summary = page.items[0];
  assert.deepEqual(
    Object.keys(summary).sort(),
    [
      "combinedStatus", "configurationHash", "createdAt", "generatedAt", "greenScoreCategory", "homePlayerId", "awayPlayerId",
      "id", "league", "matchId", "modelVersion", "period", "schemaVersion", "sequenceKey", "snapshotHash", "source", "virtualTeamAway", "virtualTeamHome",
    ].sort(),
  );
  assert.ok(!("snapshot" in summary));

  const detail = await queryService.getById(saved.id);
  assert.ok("snapshot" in detail);
  assert.deepEqual(detail.snapshot, d.snapshot);
});

// ---------------------------------------------------------------------
// Restart real: dois processos `node` completamente separados, sem
// nenhuma memória compartilhada — a única forma de provar de verdade
// que os dados sobrevivem a um restart da aplicação.
// ---------------------------------------------------------------------
test("restart durability: a fresh, independent OS process reads back exactly what another process persisted", { skip }, () => {
  const runId = uniqueRunId("restart");
  const persistOutput = execFileSync("node", ["scripts/predictionPersistenceValidation/persist.mjs", runId], { cwd: ROOT, encoding: "utf8" });
  const persisted = JSON.parse(persistOutput);

  const readBackOutput = execFileSync("node", ["scripts/predictionPersistenceValidation/readBack.mjs", persisted.id, persisted.matchId], { cwd: ROOT, encoding: "utf8" });
  const readBack = JSON.parse(readBackOutput);

  assert.equal(readBack.byId.id, persisted.id);
  assert.equal(readBack.byId.snapshotHash, persisted.snapshotHash);
  assert.equal(readBack.byMatchTotal, 1);
  assert.deepEqual(readBack.byMatchItems[0], readBack.byId);
  assert.deepEqual(readBack.latest, readBack.byId);

  // Nenhum campo perdido: recommendation/markets/metadata/hashes/fatores/confidence/risk/green score.
  const snap = readBack.byId.snapshot;
  assert.equal(snap.result.greenScore.score, 88.5);
  assert.equal(snap.result.confidence, 91.2);
  assert.equal(snap.result.prediction.predictedOutcome, "HOME_WIN");
  assert.deepEqual(snap.result.goalDistribution.overUnder, [
    { line: 1.5, over: 0.81 },
    { line: 2.5, over: 0.63 },
  ]);
  assert.equal(snap.result.quality.combinedStatus, "STRONG");
  assert.equal(snap.result.explanation.topSignals[0].type, "RATING_ADVANTAGE");
  assert.deepEqual(snap.result.warnings, []);
});
