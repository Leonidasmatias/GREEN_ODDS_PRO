import test from "node:test";
import assert from "node:assert/strict";
import { ObservabilityService } from "../src/services/observability/ObservabilityService.ts";
import { InMemoryObservabilityRepository } from "../src/repositories/observability/InMemoryObservabilityRepository.ts";
import { loadObservabilityConfig } from "../src/services/observability/ObservabilityConfig.ts";
import { normalizeProviderMatch } from "../src/providers/pipeline/ProviderNormalizer.ts";
import { esoccerFixtureCatalog } from "../src/providers/fixture/esoccerFixtureCatalog.ts";

const FIXTURE_MATCHES = esoccerFixtureCatalog.slice(0, 30).map((raw) => normalizeProviderMatch({ provider: "FIXTURE", raw }));

function makeService(overrides = {}) {
  const repository = new InMemoryObservabilityRepository();
  const config = loadObservabilityConfig({ OBSERVABILITY_ALERTS_ENABLED: "true", OBSERVABILITY_READINESS_MIN_SAMPLE_SIZE: "10" });
  const service = new ObservabilityService({ repository, config, now: () => new Date("2026-01-01T00:00:00.000Z"), idGenerator: () => "fixed-id", ...overrides });
  return { service, repository };
}

test("trackSync delegates to SyncRunTracker and persists a SyncRun via the injected repository", async () => {
  const { service, repository } = makeService();
  const fakeSyncService = {
    run: async () => ({
      provider: "BETSAPI", endpoint: "/v3/events/upcoming", mode: "sandbox",
      startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:01.000Z", durationMs: 1000,
      pagesProcessed: 1, eventsReceived: 5, confirmedEsoccer: 5, probableEsoccer: 0, rejected: 0,
      duplicated: 0, imported: 5, updated: 0, errors: 0, rateLimitRemaining: 90,
      persistenceEnabled: false, aggregationEnabled: false,
    }),
  };
  const { syncRun } = await service.trackSync(fakeSyncService, "sandbox", {});
  assert.equal(syncRun.status, "success");
  const saved = await repository.listSyncRuns();
  assert.equal(saved.length, 1);
});

test("computeAndSaveSnapshot uses the service's configured weights/staleDataMinutes and persists the snapshot", async () => {
  const { service, repository } = makeService();
  const classifications = FIXTURE_MATCHES.map(() => ({ classification: "confirmed_esoccer", evidence: [] }));
  const perfectProviderMetric = {
    provider: "BETSAPI", windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-01T00:00:00.000Z",
    totalRequests: 5, successfulRequests: 5, partialRequests: 0, failedRequests: 0,
    retryCount: 0, fallbackCount: 0, rateLimitHits: 0, lastError: null,
  };
  const snapshot = await service.computeAndSaveSnapshot({
    matches: FIXTURE_MATCHES,
    classifications,
    duplicateSummary: { totalRaw: 30, duplicated: 0 },
    providerMetric: perfectProviderMetric,
    lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z", // igual ao `now` fixo do service, portanto dentro da janela fresca
  });
  assert.equal(snapshot.sampleSize, 30);
  assert.equal(snapshot.freshnessScore, 100);
  assert.equal(snapshot.providerReliabilityScore, 100);
  assert.ok(Math.abs(snapshot.overallScore - 100) < 1e-9);
  const latest = await repository.latestSnapshot();
  assert.equal(latest.id, snapshot.id);
});

test("computeAndSaveSnapshot: with no provider data and no prior sync, freshness/reliability reflect the documented insufficient-data behavior (never assuming perfection)", async () => {
  const { service } = makeService();
  const classifications = FIXTURE_MATCHES.map(() => ({ classification: "confirmed_esoccer", evidence: [] }));
  const snapshot = await service.computeAndSaveSnapshot({
    matches: FIXTURE_MATCHES,
    classifications,
    duplicateSummary: { totalRaw: 30, duplicated: 0 },
    providerMetric: null,
    lastSuccessfulSyncAt: null,
  });
  assert.equal(snapshot.freshnessScore, 0);
  assert.equal(snapshot.providerReliabilityScore, 50);
});

test("evaluateAndSaveAlerts persists every alert it returns", async () => {
  const { service, repository } = makeService();
  const alerts = await service.evaluateAndSaveAlerts({
    snapshot: null,
    latestSyncRun: null,
    lastSuccessfulSyncAt: null,
    providerMetric: null,
    rateLimitMetrics: null,
    latency: null,
    fixtureComparison: null,
    configurationIssues: ["bad config"],
  });
  assert.equal(alerts.length, 1);
  const saved = await repository.listAlerts();
  assert.equal(saved.length, 1);
});

test("evaluateReadiness and buildReport work end-to-end off the service's own config", async () => {
  const { service } = makeService();
  const readiness = await service.evaluateReadiness({ snapshot: null, alerts: [] });
  assert.equal(readiness.status, "insufficient_data");

  const report = await service.buildReport({
    syncRuns: [], dataQualitySnapshot: null, classificationMetrics: null, duplicateMetrics: null,
    providerMetrics: null, rateLimitMetrics: null, latencyMetrics: null, fixtureComparison: null,
    alerts: [], productionReadiness: readiness, limitations: ["example limitation"],
  });
  assert.equal(report.metadata.retentionDays, service.config.retentionDays);
  assert.deepEqual(report.limitations, ["example limitation"]);
});

test("pruneExpiredData is never called implicitly by the constructor - a fresh service has nothing pruned until asked", async () => {
  const { service, repository } = makeService();
  await repository.saveSyncRun({
    id: "old", provider: "BETSAPI", mode: "sandbox", startedAt: "2020-01-01T00:00:00.000Z", finishedAt: "2020-01-01T00:00:01.000Z",
    durationMs: 1000, status: "success", pagesFetched: 1, eventsReceived: 1, confirmedEsoccer: 1, probableEsoccer: 0,
    rejected: 0, duplicated: 0, imported: 1, updated: 0, errors: [], rateLimitRemaining: 90,
  });
  const beforePrune = await repository.listSyncRuns();
  assert.equal(beforePrune.length, 1);

  const removed = await service.pruneExpiredData();
  assert.equal(removed.syncRuns, 1);
  const afterPrune = await repository.listSyncRuns();
  assert.equal(afterPrune.length, 0);
});
