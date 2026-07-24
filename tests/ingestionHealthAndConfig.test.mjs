import test from "node:test";
import assert from "node:assert/strict";
import { ProviderHealthService } from "../src/providers/pipeline/ProviderHealthService.ts";
import { FixtureProvider } from "../src/providers/fixture/FixtureProvider.ts";
import { BetsApiAdapter } from "../src/providers/betsapi/BetsApiAdapter.ts";
import { resolveMatchProvider, parseCsvMatches, CsvParseError, CsvProvider, ManualProvider } from "../src/providers/pipeline/ProviderConfig.ts";
import { PipelineLogger } from "../src/providers/pipeline/PipelineLogger.ts";

test("ProviderHealthService.checkAll returns one status per registered provider", async () => {
  const service = new ProviderHealthService([new FixtureProvider(), new BetsApiAdapter({ payloads: [] })]);
  const statuses = await service.checkAll();
  assert.equal(statuses.length, 2);
  assert.deepEqual(statuses.map((s) => s.provider).sort(), ["BETSAPI", "FIXTURE"]);
});

test("checkOne finds the requested provider by name and returns null when absent", async () => {
  const service = new ProviderHealthService([new FixtureProvider()]);
  const found = await service.checkOne("FIXTURE");
  assert.ok(found);
  const missing = await service.checkOne("BETSAPI");
  assert.equal(missing, null);
});

test("checkActive uses the configured active provider, defaulting to the first one registered", async () => {
  const service = new ProviderHealthService([new FixtureProvider(), new BetsApiAdapter({ payloads: [] })]);
  const active = await service.checkActive();
  assert.equal(active.provider, "FIXTURE");

  service.setActiveProvider("BETSAPI");
  const nowActive = await service.checkActive();
  assert.equal(nowActive.provider, "BETSAPI");
});

test("an unhealthy (forced-unavailable) BetsAPI provider is reflected by the health service", async () => {
  const service = new ProviderHealthService([new BetsApiAdapter({ payloads: [], forceUnavailable: true })], "BETSAPI");
  const status = await service.checkActive();
  assert.equal(status.healthy, false);
});

test("PipelineLogger.recordRun stores a compact entry and lastRun() returns the most recent one", () => {
  const logger = new PipelineLogger();
  logger.recordRun({
    provider: "FIXTURE", totalRaw: 10, imported: 8, updated: 0, duplicated: 1, ignored: 0, rejected: 1,
    startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:01.000Z", durationMs: 1000,
  });
  const last = logger.lastRun();
  assert.equal(last.imported, 8);
  assert.equal(last.errors, 1);
  assert.equal(logger.getHistory().length, 1);
});

test("parseCsvMatches parses a well-formed CSV with the expected columns", () => {
  const csv = [
    "id,league,scheduledAt,rawHomeName,rawAwayName,homePlayerId,awayPlayerId,status,homeScore,awayScore",
    "csv-1,Esoccer Battle - 8 mins play,2026-02-01T00:00:00.000Z,TeamA (player-01),TeamB (player-02),player-01,player-02,FINISHED,2,1",
  ].join("\n");
  const rows = parseCsvMatches(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "csv-1");
  assert.equal(rows[0].homeScore, 2);
  assert.equal(rows[0].provider, "CSV");
});

test("parseCsvMatches throws CsvParseError when a required column is missing", () => {
  const csv = "id,league\ncsv-1,SomeLeague";
  assert.throws(() => parseCsvMatches(csv), CsvParseError);
});

test("CsvProvider exposes the parsed rows through the MatchProvider contract", async () => {
  const csv = [
    "id,league,scheduledAt,rawHomeName,rawAwayName,homePlayerId,awayPlayerId,status,homeScore,awayScore",
    "csv-1,League X,2026-02-01T00:00:00.000Z,TeamA (player-01),TeamB (player-02),player-01,player-02,FINISHED,2,1",
  ].join("\n");
  const provider = new CsvProvider(csv);
  const matches = await provider.listMatches();
  assert.equal(matches.length, 1);
  const health = await provider.checkHealth();
  assert.equal(health.provider, "CSV");
});

test("ManualProvider wraps manually supplied records and forces provider = MANUAL", async () => {
  const provider = new ManualProvider([
    { id: "man-1", league: "League X", scheduledAt: "2026-02-01T00:00:00.000Z", rawHomeName: "TeamA (player-01)", rawAwayName: "TeamB (player-02)", homePlayerId: "player-01", awayPlayerId: "player-02", status: "FINISHED", homeScore: 1, awayScore: 1, provider: "CSV" },
  ]);
  const matches = await provider.listMatches();
  assert.equal(matches.length, 1);
  assert.equal(matches[0].provider, "MANUAL");
});

test("resolveMatchProvider selects the right concrete provider for each of the four options", () => {
  assert.ok(resolveMatchProvider({ selection: "FIXTURE" }).name === "FIXTURE");
  assert.ok(resolveMatchProvider({ selection: "BETSAPI", betsApiOptions: { payloads: [] } }).name === "BETSAPI");
  assert.ok(
    resolveMatchProvider({
      selection: "CSV",
      csvContent: "id,league,scheduledAt,rawHomeName,rawAwayName,homePlayerId,awayPlayerId,status,homeScore,awayScore",
    }).name === "CSV",
  );
  assert.ok(resolveMatchProvider({ selection: "MANUAL" }).name === "MANUAL");
});
