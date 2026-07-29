// Sprint 9.2.1 — Provider Go Live & Live Data Pipeline, Fase 9.
// Testes puros para LiveSportsDiscoveryService — nenhuma chamada de
// rede real; a fonte de dados (`SportsSource`) e um fake em memoria.
import test from "node:test";
import assert from "node:assert/strict";
import { LiveSportsDiscoveryService } from "../src/providers/theOddsApi/LiveSportsDiscoveryService.ts";

function fakeSource(entries) {
  return { getSports: async () => ({ data: entries }) };
}

const SAMPLE_SPORTS = [
  { key: "soccer_epl", group: "Soccer", title: "EPL", active: true, has_outrights: false },
  { key: "soccer_spain_la_liga", group: "Soccer", title: "La Liga", active: true, has_outrights: false },
  { key: "soccer_inactive_league", group: "Soccer", title: "Inactive League", active: false, has_outrights: false },
  { key: "basketball_nba", group: "Basketball", title: "NBA", active: true, has_outrights: false },
  { key: "soccer_outrights_only", group: "Soccer", title: "Outrights Only", active: true, has_outrights: true },
];

test("discoverSports: returns every sport normalized to camelCase, unfiltered", async () => {
  const service = new LiveSportsDiscoveryService(fakeSource(SAMPLE_SPORTS));
  const sports = await service.discoverSports();
  assert.equal(sports.length, SAMPLE_SPORTS.length);
  assert.deepEqual(sports[0], { key: "soccer_epl", group: "Soccer", title: "EPL", active: true, hasOutrights: false });
});

test("discoverActiveSports: excludes inactive sports", async () => {
  const service = new LiveSportsDiscoveryService(fakeSource(SAMPLE_SPORTS));
  const active = await service.discoverActiveSports();
  assert.ok(active.every((sport) => sport.active));
  assert.ok(!active.some((sport) => sport.key === "soccer_inactive_league"));
});

test("discoverSoccerLeagues: only active sports in the Soccer group", async () => {
  const service = new LiveSportsDiscoveryService(fakeSource(SAMPLE_SPORTS));
  const soccer = await service.discoverSoccerLeagues();
  assert.deepEqual(
    soccer.map((sport) => sport.key).sort(),
    ["soccer_epl", "soccer_outrights_only", "soccer_spain_la_liga"],
  );
  assert.ok(!soccer.some((sport) => sport.key === "basketball_nba"));
  assert.ok(!soccer.some((sport) => sport.key === "soccer_inactive_league"));
});

test("discoverSoccerLeagues: empty source produces an empty list, never throws", async () => {
  const service = new LiveSportsDiscoveryService(fakeSource([]));
  assert.deepEqual(await service.discoverSoccerLeagues(), []);
});

test("hasOutrights: defaults to false when has_outrights is absent", async () => {
  const service = new LiveSportsDiscoveryService(fakeSource([{ key: "x", group: "Soccer", title: "X", active: true }]));
  const sports = await service.discoverSports();
  assert.equal(sports[0].hasOutrights, false);
});
