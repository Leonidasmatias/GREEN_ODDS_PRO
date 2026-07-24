import test from "node:test";
import assert from "node:assert/strict";
import { BetsApiClient } from "../src/providers/betsapi/BetsApiClient.ts";
import { BetsApiSyncService } from "../src/providers/betsapi/BetsApiSyncService.ts";
import { DeduplicationService } from "../src/providers/pipeline/DeduplicationService.ts";

const SECRET = "sk_live_sync_test";

function jsonResponse(body) {
  return { status: 200, headers: { get: () => null }, text: async () => JSON.stringify(body) };
}

function esoccerEvent(id, overrides = {}) {
  return {
    id,
    league: { id: "l1", name: "Esoccer Battle - 8 mins play" },
    time: "1767225600",
    time_status: "3",
    home: { id: "h1", name: `TeamB (player-${id})` },
    away: { id: "a1", name: `TeamA (player-x${id})` },
    ss: "2-1",
    is_esports: true,
    ...overrides,
  };
}

function realFootballEvent(id) {
  return {
    id,
    league: { id: "l2", name: "La Liga" },
    time: "1767225600",
    time_status: "3",
    home: { id: "h2", name: "Real Madrid" },
    away: { id: "a2", name: "Barcelona" },
    ss: "1-0",
    is_esports: false,
  };
}

function makeService({ pages, mode, featureFlagsOverrides = {}, persist, runAggregation }) {
  let call = 0;
  const fetchImpl = async () => {
    const page = pages[Math.min(call, pages.length - 1)];
    call += 1;
    return jsonResponse({ success: 1, results: page, pager: { page: call, per_page: 10, total: 100 } });
  };
  const client = new BetsApiClient(
    {
      enabled: true,
      mode: "live",
      token: SECRET,
      baseUrl: "https://primary.example",
      fallbackBaseUrl: "https://fallback.example",
      timeoutMs: 50,
      maxRetries: 1,
      retryBaseDelayMs: 1,
      rateLimitReserve: 5,
      sportId: "1",
    },
    { fetchImpl, sleep: async () => {} },
  );
  const service = new BetsApiSyncService({
    client,
    sportId: "1",
    classifierConfig: { allowlist: [], denylist: [] },
    featureFlags: {
      persistEnabled: false,
      aggregationEnabled: false,
      esoccerAllowlist: [],
      esoccerDenylist: [],
      maxPagesPerSync: 3,
      maxEventsPerSync: 200,
      ...featureFlagsOverrides,
    },
    persist,
    runAggregation,
  });
  return { service, getCallCount: () => call };
}

test("dry-run never persists and never runs aggregation, even if hooks are provided", async () => {
  let persistCalls = 0;
  let aggregationCalls = 0;
  const { service } = makeService({
    pages: [[esoccerEvent("1")], []],
    persist: async () => {
      persistCalls += 1;
    },
    runAggregation: async () => {
      aggregationCalls += 1;
    },
  });
  const report = await service.run("dry-run");
  assert.equal(report.mode, "dry-run");
  assert.equal(report.persistenceEnabled, false);
  assert.equal(report.aggregationEnabled, false);
  assert.equal(persistCalls, 0);
  assert.equal(aggregationCalls, 0);
  assert.equal(report.confirmedEsoccer, 1);
  assert.equal(report.imported, 1);
});

test("sandbox never persists by default even with the persist-enabled flag set (only live can persist)", async () => {
  let persistCalls = 0;
  const { service } = makeService({
    pages: [[esoccerEvent("1")], []],
    featureFlagsOverrides: { persistEnabled: true },
    persist: async () => {
      persistCalls += 1;
    },
  });
  const report = await service.run("sandbox");
  assert.equal(report.persistenceEnabled, false);
  assert.equal(persistCalls, 0);
  assert.equal(report.confirmedEsoccer, 1);
});

test("live mode with the persist flag off does not persist even though mode is live", async () => {
  let persistCalls = 0;
  const { service } = makeService({
    pages: [[esoccerEvent("1")], []],
    featureFlagsOverrides: { persistEnabled: false },
    persist: async () => {
      persistCalls += 1;
    },
  });
  const report = await service.run("live");
  assert.equal(report.persistenceEnabled, false);
  assert.equal(persistCalls, 0);
});

test("live mode with the persist flag on actually invokes the injected persistence hook", async () => {
  let persistCalls = 0;
  const { service } = makeService({
    pages: [[esoccerEvent("1")], []],
    featureFlagsOverrides: { persistEnabled: true },
    persist: async () => {
      persistCalls += 1;
    },
  });
  const report = await service.run("live");
  assert.equal(report.persistenceEnabled, true);
  assert.equal(persistCalls, 1);
  assert.equal(report.imported, 1);
});

test("live mode with aggregation flag on invokes the injected aggregation hook exactly once", async () => {
  let aggregationCalls = 0;
  const { service } = makeService({
    pages: [[esoccerEvent("1")], []],
    featureFlagsOverrides: { persistEnabled: true, aggregationEnabled: true },
    persist: async () => {},
    runAggregation: async () => {
      aggregationCalls += 1;
    },
  });
  await service.run("live");
  assert.equal(aggregationCalls, 1);
});

test("probable_esoccer events are excluded from live processing but included in dry-run", async () => {
  const probableEvent = esoccerEvent("probable-1", { is_esports: undefined }); // apenas 1 sinal (padrao de participante)

  const dryRun = makeService({ pages: [[probableEvent], []] });
  const dryRunReport = await dryRun.service.run("dry-run");
  assert.equal(dryRunReport.probableEsoccer, 1);
  assert.equal(dryRunReport.imported, 1);

  const live = makeService({ pages: [[probableEvent], []], featureFlagsOverrides: { persistEnabled: true }, persist: async () => {} });
  const liveReport = await live.service.run("live");
  assert.equal(liveReport.probableEsoccer, 1);
  assert.equal(liveReport.imported, 0);
});

test("not_esoccer events are counted as rejected and never reach the pipeline", async () => {
  const { service } = makeService({ pages: [[realFootballEvent("real-1")], []] });
  const report = await service.run("dry-run");
  assert.equal(report.rejected >= 1, true);
  assert.equal(report.imported, 0);
});

test("the maxPagesPerSync cap stops pagination even when more pages are available", async () => {
  const pages = [[esoccerEvent("p1")], [esoccerEvent("p2")], [esoccerEvent("p3")], [esoccerEvent("p4")]];
  const { service } = makeService({ pages, featureFlagsOverrides: { maxPagesPerSync: 2 } });
  const report = await service.run("dry-run");
  assert.equal(report.pagesProcessed, 2);
  assert.equal(report.eventsReceived, 2);
});

test("the maxEventsPerSync cap stops processing mid-page once the limit is reached", async () => {
  const bigPage = [esoccerEvent("a"), esoccerEvent("b"), esoccerEvent("c")];
  const { service } = makeService({ pages: [bigPage], featureFlagsOverrides: { maxEventsPerSync: 2, maxPagesPerSync: 5 } });
  const report = await service.run("dry-run");
  assert.equal(report.eventsReceived, 2);
});

test("duplicated events across two consecutive syncs (same deduplicator) are reported as duplicated on the second run", async () => {
  const dedup = new DeduplicationService();
  const pages = [[esoccerEvent("dup-1")], []];
  let call = 0;
  const fetchImpl = async () => {
    const page = pages[Math.min(call, pages.length - 1)];
    call += 1;
    return jsonResponse({ success: 1, results: page });
  };
  const client = new BetsApiClient(
    {
      enabled: true, mode: "live", token: SECRET, baseUrl: "https://primary.example",
      fallbackBaseUrl: "https://fallback.example", timeoutMs: 50, maxRetries: 1,
      retryBaseDelayMs: 1, rateLimitReserve: 5, sportId: "1",
    },
    { fetchImpl, sleep: async () => {} },
  );
  const service = new BetsApiSyncService({
    client, sportId: "1", classifierConfig: { allowlist: [], denylist: [] },
    featureFlags: { persistEnabled: false, aggregationEnabled: false, esoccerAllowlist: [], esoccerDenylist: [], maxPagesPerSync: 3, maxEventsPerSync: 200 },
    deduplicator: dedup,
  });
  call = 0;
  const first = await service.run("dry-run");
  call = 0;
  const second = await service.run("dry-run");
  assert.equal(first.imported, 1);
  assert.equal(second.duplicated, 1);
  assert.equal(second.imported, 0);
});
