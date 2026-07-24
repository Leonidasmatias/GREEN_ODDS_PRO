import test from "node:test";
import assert from "node:assert/strict";
import { IngestionPipeline } from "../src/providers/pipeline/IngestionPipeline.ts";
import { FixtureProvider } from "../src/providers/fixture/FixtureProvider.ts";
import { BetsApiAdapter } from "../src/providers/betsapi/BetsApiAdapter.ts";
import { ManualProvider } from "../src/providers/pipeline/ProviderConfig.ts";
import { DeduplicationService } from "../src/providers/pipeline/DeduplicationService.ts";
import { PipelineEventBus } from "../src/providers/pipeline/PipelineEvents.ts";
import { PipelineLogger } from "../src/providers/pipeline/PipelineLogger.ts";
import { normalizeProviderMatch } from "../src/providers/pipeline/ProviderNormalizer.ts";
import { esoccerFixtureCatalog } from "../src/providers/fixture/esoccerFixtureCatalog.ts";

function manualNormalize(raw) {
  return normalizeProviderMatch({ provider: "MANUAL", raw });
}

function manualRecord(overrides = {}) {
  return {
    id: "man-001",
    league: "Esoccer Battle - 8 mins play",
    scheduledAt: "2026-03-01T00:00:00.000Z",
    rawHomeName: "TeamA (player-01)",
    rawAwayName: "TeamB (player-02)",
    homePlayerId: "player-01",
    awayPlayerId: "player-02",
    status: "FINISHED",
    homeScore: 2,
    awayScore: 1,
    provider: "MANUAL",
    ...overrides,
  };
}

test("happy path: every valid, finished, unique fixture is imported exactly once", async () => {
  const provider = new FixtureProvider(esoccerFixtureCatalog.slice(0, 5));
  const pipeline = new IngestionPipeline({
    provider,
    normalize: (raw) => normalizeProviderMatch({ provider: "FIXTURE", raw }),
  });

  const summary = await pipeline.run();

  assert.equal(summary.totalRaw, 5);
  assert.equal(summary.imported, 5);
  assert.equal(summary.updated, 0);
  assert.equal(summary.duplicated, 0);
  assert.equal(summary.ignored, 0);
  assert.equal(summary.rejected, 0);
  assert.equal(summary.provider, "FIXTURE");
  assert.ok(summary.durationMs >= 0);
});

test("running the same batch twice with the same deduplicator marks the second run as all duplicates", async () => {
  const dedup = new DeduplicationService();
  const provider = new FixtureProvider(esoccerFixtureCatalog.slice(0, 3));
  const pipeline = new IngestionPipeline({
    provider,
    normalize: (raw) => normalizeProviderMatch({ provider: "FIXTURE", raw }),
    deduplicator: dedup,
  });

  const first = await pipeline.run();
  const second = await pipeline.run();

  assert.equal(first.imported, 3);
  assert.equal(second.imported, 0);
  assert.equal(second.duplicated, 3);
});

test("events are emitted for every outcome: imported, duplicated, ignored, rejected", async () => {
  const events = [];
  const bus = new PipelineEventBus();
  bus.on((event) => events.push(event.type));

  const records = [
    manualRecord({ id: "batch-1" }),
    manualRecord({ id: "batch-1" }), // exact duplicate of the one above
    manualRecord({ id: "batch-2", status: "SCHEDULED", homeScore: null, awayScore: null }), // not finished -> ignored
    manualRecord({ id: "batch-3", rawHomeName: "NoParensHere" }), // malformed -> rejected at normalize
    manualRecord({ id: "batch-4", homePlayerId: "player-09", awayPlayerId: "player-09", rawHomeName: "TeamA (player-09)", rawAwayName: "TeamB (player-09)" }), // same player both sides -> rejected at validation
  ];

  const provider = new ManualProvider(records);
  const pipeline = new IngestionPipeline({ provider, normalize: manualNormalize, eventBus: bus });

  const summary = await pipeline.run();

  assert.equal(summary.imported, 1);
  assert.equal(summary.duplicated, 1);
  assert.equal(summary.ignored, 1);
  assert.equal(summary.rejected, 2);
  assert.deepEqual(
    events,
    ["MatchImported", "MatchDuplicated", "MatchIgnored", "MatchRejected", "MatchRejected", "AggregationCompleted"],
  );
});

test("a match whose score changes between runs is reported as UPDATED, not duplicated", async () => {
  const dedup = new DeduplicationService();
  const bus = new PipelineEventBus();
  const seenTypes = [];
  bus.on((event) => seenTypes.push(event.type));

  const first = new IngestionPipeline({
    provider: new ManualProvider([manualRecord({ id: "evolving-1", homeScore: 1 })]),
    normalize: manualNormalize,
    deduplicator: dedup,
    eventBus: bus,
  });
  await first.run();

  const second = new IngestionPipeline({
    provider: new ManualProvider([manualRecord({ id: "evolving-1", homeScore: 3 })]),
    normalize: manualNormalize,
    deduplicator: dedup,
    eventBus: bus,
  });
  const summary = await second.run();

  assert.equal(summary.updated, 1);
  assert.ok(seenTypes.includes("MatchUpdated"));
});

test("the persistence stage is invoked with CREATE for new matches and UPDATE for changed ones", async () => {
  const dedup = new DeduplicationService();
  const persistedActions = [];
  const persist = async (action, match) => persistedActions.push([action, match.externalId]);

  const runOnce = (homeScore) =>
    new IngestionPipeline({
      provider: new ManualProvider([manualRecord({ id: "persist-1", homeScore })]),
      normalize: manualNormalize,
      deduplicator: dedup,
      persist,
    }).run();

  await runOnce(1);
  await runOnce(4);

  assert.deepEqual(persistedActions, [
    ["CREATE", "persist-1"],
    ["UPDATE", "persist-1"],
  ]);
});

test("the aggregation stage runs exactly once per pipeline execution, after every match is processed", async () => {
  let aggregationCalls = 0;
  const pipeline = new IngestionPipeline({
    provider: new FixtureProvider(esoccerFixtureCatalog.slice(0, 4)),
    normalize: (raw) => normalizeProviderMatch({ provider: "FIXTURE", raw }),
    runAggregation: async () => {
      aggregationCalls += 1;
    },
  });

  await pipeline.run();
  assert.equal(aggregationCalls, 1);
});

test("the logger records one entry per run, matching the returned summary", async () => {
  const logger = new PipelineLogger();
  const pipeline = new IngestionPipeline({
    provider: new FixtureProvider(esoccerFixtureCatalog.slice(0, 2)),
    normalize: (raw) => normalizeProviderMatch({ provider: "FIXTURE", raw }),
    logger,
  });

  const summary = await pipeline.run();
  const lastEntry = logger.lastRun();

  assert.equal(lastEntry.imported, summary.imported);
  assert.equal(lastEntry.provider, summary.provider);
  assert.equal(logger.getHistory().length, 1);
});

test("an unavailable provider causes the whole run to reject, without a false summary being logged", async () => {
  const logger = new PipelineLogger();
  const pipeline = new IngestionPipeline({
    provider: new BetsApiAdapter({ payloads: [], forceUnavailable: true, retryPolicy: { maxAttempts: 1, baseDelayMs: 1, backoffFactor: 1 } }),
    normalize: (raw) => normalizeProviderMatch({ provider: "BETSAPI", raw }),
    logger,
  });

  await assert.rejects(() => pipeline.run());
  assert.equal(logger.getHistory().length, 0);
});
