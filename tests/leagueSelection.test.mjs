// Sprint 9.2.1 — Provider Go Live & Live Data Pipeline, Fase 9.
// Testes puros para LeagueSelectionService — nenhuma chamada de rede
// real; a fonte de eventos (`EventsSource`) e um fake em memoria que
// registra quais chaves foram sondadas.
import test from "node:test";
import assert from "node:assert/strict";
import { LeagueSelectionService, DEFAULT_SPORT_KEY } from "../src/providers/theOddsApi/LeagueSelectionService.ts";

function league(key, title = key) {
  return { key, group: "Soccer", title, active: true, hasOutrights: false };
}

function fakeEventsSource(eventsByKey) {
  const probed = [];
  return {
    probed,
    probeEvents: async (sportKey) => {
      probed.push(sportKey);
      const count = eventsByKey[sportKey] ?? 0;
      return { data: Array.from({ length: count }, (_, i) => ({ id: `${sportKey}-${i}` })), remainingLimit: 100 };
    },
  };
}

test("buildCandidateOrder: override comes first when present among discovered leagues", () => {
  const source = fakeEventsSource({});
  const service = new LeagueSelectionService(source);
  const leagues = [league("soccer_brazil_campeonato"), league("soccer_epl")];
  const order = service.buildCandidateOrder(leagues, "soccer_brazil_campeonato");
  assert.equal(order[0], "soccer_brazil_campeonato");
});

test("buildCandidateOrder: known priority leagues come before unknown ones", () => {
  const source = fakeEventsSource({});
  const service = new LeagueSelectionService(source);
  const leagues = [league("soccer_unknown_league"), league("soccer_epl")];
  const order = service.buildCandidateOrder(leagues, null);
  assert.equal(order[0], "soccer_epl");
  assert.equal(order[1], "soccer_unknown_league");
});

test("buildCandidateOrder: override is appended even when not among discovered leagues", () => {
  const source = fakeEventsSource({});
  const service = new LeagueSelectionService(source);
  const order = service.buildCandidateOrder([league("soccer_epl")], "soccer_custom_override");
  assert.ok(order.includes("soccer_custom_override"));
});

test("selectActiveLeague: picks the first candidate with events, without probing later candidates", async () => {
  const source = fakeEventsSource({ soccer_epl: 0, soccer_spain_la_liga: 12 });
  const service = new LeagueSelectionService(source);
  const leagues = [league("soccer_epl"), league("soccer_spain_la_liga"), league("soccer_italy_serie_a")];
  const result = await service.selectActiveLeague(leagues, null);
  assert.equal(result.sportKey, "soccer_spain_la_liga");
  assert.equal(result.eventsFound, 12);
  assert.deepEqual(source.probed, ["soccer_epl", "soccer_spain_la_liga"]);
  assert.ok(!source.probed.includes("soccer_italy_serie_a"));
});

test("selectActiveLeague: respects an explicit override even if a priority league also has events", async () => {
  const source = fakeEventsSource({ soccer_epl: 5, soccer_brazil_campeonato: 3 });
  const service = new LeagueSelectionService(source);
  const leagues = [league("soccer_epl"), league("soccer_brazil_campeonato")];
  const result = await service.selectActiveLeague(leagues, "soccer_brazil_campeonato");
  assert.equal(result.sportKey, "soccer_brazil_campeonato");
});

test("selectActiveLeague: when every candidate is empty, returns the last one tried with eventsFound 0 (never throws)", async () => {
  const source = fakeEventsSource({});
  const service = new LeagueSelectionService(source);
  const leagues = [league("soccer_epl"), league("soccer_spain_la_liga")];
  const result = await service.selectActiveLeague(leagues, null);
  assert.equal(result.eventsFound, 0);
  assert.ok(result.attemptedKeys.length > 0);
  assert.equal(result.sportKey, result.attemptedKeys[result.attemptedKeys.length - 1]);
});

test("selectActiveLeague: with no discovered leagues and no override, falls back to DEFAULT_SPORT_KEY without probing anything", async () => {
  const source = fakeEventsSource({});
  const service = new LeagueSelectionService(source);
  const result = await service.selectActiveLeague([], null);
  assert.equal(result.sportKey, DEFAULT_SPORT_KEY);
  assert.deepEqual(result.attemptedKeys, []);
  assert.deepEqual(source.probed, []);
});

test("selectActiveLeague: never probes more than the attempt cap even with many empty leagues", async () => {
  const source = fakeEventsSource({});
  const service = new LeagueSelectionService(source);
  const manyLeagues = Array.from({ length: 50 }, (_, i) => league(`soccer_league_${i}`));
  const result = await service.selectActiveLeague(manyLeagues, null);
  assert.equal(result.eventsFound, 0);
  assert.ok(source.probed.length <= 15, `expected at most 15 probes, got ${source.probed.length}`);
});

test("selectActiveLeague: is deterministic for identical input", async () => {
  const leagues = [league("soccer_epl"), league("soccer_spain_la_liga")];
  const resultA = await new LeagueSelectionService(fakeEventsSource({ soccer_spain_la_liga: 4 })).selectActiveLeague(leagues, null);
  const resultB = await new LeagueSelectionService(fakeEventsSource({ soccer_spain_la_liga: 4 })).selectActiveLeague(leagues, null);
  assert.deepEqual(resultA, resultB);
});
