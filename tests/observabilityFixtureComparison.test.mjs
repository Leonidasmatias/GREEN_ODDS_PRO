import test from "node:test";
import assert from "node:assert/strict";
import { compareFixtureStructure } from "../src/services/observability/FixtureComparisonService.ts";
import { normalizeProviderMatch } from "../src/providers/pipeline/ProviderNormalizer.ts";
import { esoccerFixtureCatalog } from "../src/providers/fixture/esoccerFixtureCatalog.ts";

const FIXTURE_MATCHES = esoccerFixtureCatalog.slice(0, 20).map((raw) => normalizeProviderMatch({ provider: "FIXTURE", raw }));

function liveMatchLike(overrides = {}) {
  const raw = {
    id: "ev-1",
    league: { id: "l1", name: "Esoccer Battle - 8 mins play" },
    time: "1735689600",
    time_status: "3",
    home: { name: "TeamA (player-01)" },
    away: { name: "TeamB (player-02)" },
    ss: "2-1",
  };
  return normalizeProviderMatch({ provider: "BETSAPI", raw: { ...raw, ...overrides } });
}

test("live matches produced by the same normalizer as the fixture catalog are structurally equivalent", () => {
  const liveMatches = [liveMatchLike(), liveMatchLike({ id: "ev-2" })];
  const result = compareFixtureStructure(liveMatches, FIXTURE_MATCHES);
  assert.equal(result.structurallyEquivalent, true);
  assert.deepEqual(result.missingInLive, []);
  assert.deepEqual(result.missingInFixture, []);
  assert.deepEqual(result.typeMismatches, []);
});

test("never compares literal id/nickname values - only key presence and type", () => {
  const liveMatches = [liveMatchLike({ id: "totally-different-id-format-999" })];
  const result = compareFixtureStructure(liveMatches, FIXTURE_MATCHES);
  assert.equal(result.structurallyEquivalent, true);
});

test("an extra field on the live side that the fixture side never has is reported as missingInFixture", () => {
  const liveMatches = [{ ...liveMatchLike(), extraNewField: "surprise" }];
  const result = compareFixtureStructure(liveMatches, FIXTURE_MATCHES);
  assert.ok(result.missingInFixture.includes("extraNewField"));
  assert.equal(result.structurallyEquivalent, false);
});

test("a field missing entirely on the live side is reported as missingInLive", () => {
  const live = liveMatchLike();
  delete live.rawHomeName;
  const result = compareFixtureStructure([live], FIXTURE_MATCHES);
  assert.ok(result.missingInLive.includes("rawHomeName"));
  assert.equal(result.structurallyEquivalent, false);
});

test("a genuine type mismatch (string vs number at the same path) is reported in typeMismatches", () => {
  const live = { ...liveMatchLike(), homeScore: "not-a-number" };
  const result = compareFixtureStructure([live], FIXTURE_MATCHES);
  assert.ok(result.typeMismatches.some((entry) => entry.startsWith("homeScore")));
});

test("null on one side and a populated value on the other is NOT treated as a type mismatch", () => {
  const scheduledLike = { ...liveMatchLike(), homeScore: null, awayScore: null };
  const result = compareFixtureStructure([scheduledLike], FIXTURE_MATCHES);
  assert.equal(result.typeMismatches.some((entry) => entry.startsWith("homeScore") || entry.startsWith("awayScore")), false);
});

test("never produces any betting-recommendation field on the result object", () => {
  const result = compareFixtureStructure([liveMatchLike()], FIXTURE_MATCHES);
  const keys = Object.keys(result);
  for (const forbidden of ["recommendation", "edge", "ev", "kelly", "stake", "bet"]) {
    assert.equal(keys.some((key) => key.toLowerCase().includes(forbidden)), false);
  }
});
