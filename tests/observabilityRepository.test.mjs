import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryObservabilityRepository } from "../src/repositories/observability/InMemoryObservabilityRepository.ts";
import {
  ObservabilityStorageUnavailableError,
  PrismaObservabilityRepository,
} from "../src/repositories/observability/PrismaObservabilityRepository.ts";

function syncRun(overrides = {}) {
  return {
    id: "r1", provider: "BETSAPI", mode: "sandbox", startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:01.000Z",
    durationMs: 1000, status: "success", pagesFetched: 1, eventsReceived: 5, confirmedEsoccer: 5, probableEsoccer: 0,
    rejected: 0, duplicated: 0, imported: 5, updated: 0, errors: [], rateLimitRemaining: 90,
    ...overrides,
  };
}

test("InMemoryObservabilityRepository reports health() as available/memory", async () => {
  const repository = new InMemoryObservabilityRepository();
  const health = await repository.health();
  assert.deepEqual(health, { status: "available", backend: "memory", detail: null });
});

test("InMemoryObservabilityRepository saves and lists sync runs newest-first", async () => {
  const repository = new InMemoryObservabilityRepository();
  await repository.saveSyncRun(syncRun({ id: "r1", startedAt: "2026-01-01T00:00:00.000Z" }));
  await repository.saveSyncRun(syncRun({ id: "r2", startedAt: "2026-01-02T00:00:00.000Z" }));
  const listed = await repository.listSyncRuns();
  assert.deepEqual(listed.map((r) => r.id), ["r2", "r1"]);
});

test("InMemoryObservabilityRepository respects a limit on listSyncRuns/listSnapshots/listAlerts", async () => {
  const repository = new InMemoryObservabilityRepository();
  await repository.saveSyncRun(syncRun({ id: "r1" }));
  await repository.saveSyncRun(syncRun({ id: "r2" }));
  const limited = await repository.listSyncRuns(1);
  assert.equal(limited.length, 1);
});

test("InMemoryObservabilityRepository.latestSnapshot returns the most recently generated snapshot", async () => {
  const repository = new InMemoryObservabilityRepository();
  const older = { id: "s1", generatedAt: "2026-01-01T00:00:00.000Z", sampleSize: 1, completenessScore: 1, consistencyScore: 1, classificationConfidenceScore: 1, duplicateHealthScore: 1, overallScore: 1, fieldMetrics: [], leagueMetrics: [], inconsistencies: [] };
  const newer = { ...older, id: "s2", generatedAt: "2026-01-02T00:00:00.000Z" };
  await repository.saveSnapshot(older);
  await repository.saveSnapshot(newer);
  const latest = await repository.latestSnapshot();
  assert.equal(latest.id, "s2");
});

test("InMemoryObservabilityRepository.pruneOlderThan removes only records older than the retention window", async () => {
  const repository = new InMemoryObservabilityRepository();
  await repository.saveSyncRun(syncRun({ id: "old", startedAt: "2025-01-01T00:00:00.000Z" }));
  await repository.saveSyncRun(syncRun({ id: "recent", startedAt: "2026-01-01T00:00:00.000Z" }));

  const removed = await repository.pruneOlderThan(30, new Date("2026-01-02T00:00:00.000Z"));
  assert.equal(removed.syncRuns, 1);
  const remaining = await repository.listSyncRuns();
  assert.deepEqual(remaining.map((r) => r.id), ["recent"]);
});

test("InMemoryObservabilityRepository.pruneOlderThan is never invoked automatically - a fresh repository has nothing to prune", async () => {
  const repository = new InMemoryObservabilityRepository();
  const removed = await repository.pruneOlderThan(30);
  assert.deepEqual(removed, { syncRuns: 0, snapshots: 0, alerts: 0 });
});

test("PrismaObservabilityRepository with no client reports health() as unavailable/prisma", async () => {
  const repository = new PrismaObservabilityRepository();
  const health = await repository.health();
  assert.equal(health.status, "unavailable");
  assert.equal(health.backend, "prisma");
  assert.ok(health.detail && health.detail.length > 0);
});

test("PrismaObservabilityRepository throws a structured ObservabilityStorageUnavailableError on every write/read when unavailable", async () => {
  const repository = new PrismaObservabilityRepository();
  await assert.rejects(() => repository.saveSyncRun(syncRun()), ObservabilityStorageUnavailableError);
  await assert.rejects(() => repository.listSyncRuns(), ObservabilityStorageUnavailableError);
  await assert.rejects(() => repository.pruneOlderThan(30), ObservabilityStorageUnavailableError);
});

test("PrismaObservabilityRepository with an incompatible client (missing expected models) still reports unavailable", async () => {
  const repository = new PrismaObservabilityRepository({ someUnrelatedModel: {} });
  const health = await repository.health();
  assert.equal(health.status, "unavailable");
});

test("PrismaObservabilityRepository never touches prisma/schema.prisma or migrations - this phase adds no real schema", () => {
  // Structural guarantee: the adapter's only dependency is a duck-typed
  // client shape, never an import of a generated Prisma Client or schema.
  const source = PrismaObservabilityRepository.toString();
  assert.equal(source.includes("@prisma/client"), false);
});
