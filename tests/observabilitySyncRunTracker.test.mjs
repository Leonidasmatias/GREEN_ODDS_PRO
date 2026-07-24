import test from "node:test";
import assert from "node:assert/strict";
import { SyncRunTracker } from "../src/services/observability/SyncRunTracker.ts";
import { InMemoryObservabilityRepository } from "../src/repositories/observability/InMemoryObservabilityRepository.ts";

function baseReport(overrides = {}) {
  return {
    provider: "BETSAPI", endpoint: "/v3/events/upcoming", mode: "sandbox",
    startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:05.000Z", durationMs: 5000,
    pagesProcessed: 1, eventsReceived: 10, confirmedEsoccer: 8, probableEsoccer: 1, rejected: 1,
    duplicated: 0, imported: 8, updated: 0, errors: 0, rateLimitRemaining: 90,
    persistenceEnabled: false, aggregationEnabled: false,
    ...overrides,
  };
}

test("track() converts a successful BetsApiSyncReport into a status=success SyncRun and saves it", async () => {
  const repository = new InMemoryObservabilityRepository();
  const tracker = new SyncRunTracker({ repository, idGenerator: () => "run-a" });
  const fakeSyncService = { run: async () => baseReport() };

  const { report, syncRun } = await tracker.track(fakeSyncService, "sandbox", {});
  assert.equal(report.imported, 8);
  assert.equal(syncRun.id, "run-a");
  assert.equal(syncRun.status, "success");
  assert.equal(syncRun.errors.length, 0);

  const saved = await repository.listSyncRuns();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, "run-a");
});

test("a report with errors>0 but some imports maps to status=partial", async () => {
  const repository = new InMemoryObservabilityRepository();
  const tracker = new SyncRunTracker({ repository, idGenerator: () => "run-b" });
  const fakeSyncService = { run: async () => baseReport({ errors: 2, imported: 5 }) };

  const { syncRun } = await tracker.track(fakeSyncService, "sandbox", {});
  assert.equal(syncRun.status, "partial");
});

test("a report with errors>0 and zero imports/updates maps to status=failed", async () => {
  const repository = new InMemoryObservabilityRepository();
  const tracker = new SyncRunTracker({ repository, idGenerator: () => "run-c" });
  const fakeSyncService = { run: async () => baseReport({ errors: 3, imported: 0, updated: 0 }) };

  const { syncRun } = await tracker.track(fakeSyncService, "sandbox", {});
  assert.equal(syncRun.status, "failed");
});

test("when syncService.run throws, track() saves a failed SyncRun with a sanitized message and re-throws the original error", async () => {
  const repository = new InMemoryObservabilityRepository();
  const tracker = new SyncRunTracker({ repository, idGenerator: () => "run-d" });
  const failingSyncService = {
    run: async () => {
      throw new Error("BetsAPI call failed: https://api.b365api.com/v3/x?token=leaked-secret-123");
    },
  };

  await assert.rejects(() => tracker.track(failingSyncService, "live", {}));

  const saved = await repository.listSyncRuns();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].status, "failed");
  assert.equal(saved[0].errors[0].includes("leaked-secret-123"), false);
});

test("track() never mutates the original BetsApiSyncReport returned to the caller", async () => {
  const repository = new InMemoryObservabilityRepository();
  const tracker = new SyncRunTracker({ repository, idGenerator: () => "run-e" });
  const originalReport = baseReport();
  const fakeSyncService = { run: async () => originalReport };

  const { report } = await tracker.track(fakeSyncService, "sandbox", {});
  assert.equal(report, originalReport);
});
