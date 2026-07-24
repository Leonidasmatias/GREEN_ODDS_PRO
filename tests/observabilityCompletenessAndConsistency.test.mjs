import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCompleteness, overallCompletenessScore } from "../src/services/observability/DataCompletenessAnalyzer.ts";
import { analyzeConsistency, ALL_CONSISTENCY_CHECKS } from "../src/services/observability/DataConsistencyAnalyzer.ts";
import { normalizeProviderMatch } from "../src/providers/pipeline/ProviderNormalizer.ts";
import { esoccerFixtureCatalog } from "../src/providers/fixture/esoccerFixtureCatalog.ts";

const REAL_FIXTURE_MATCHES = esoccerFixtureCatalog.map((raw) => normalizeProviderMatch({ provider: "FIXTURE", raw }));

test("the 300 reused fixture matches (Fase 2) are 100% complete on every critical field", () => {
  assert.equal(REAL_FIXTURE_MATCHES.length, 300);
  const metrics = analyzeCompleteness(REAL_FIXTURE_MATCHES);
  const score = overallCompletenessScore(metrics);
  assert.equal(score, 1);
  for (const metric of metrics.filter((m) => m.critical)) {
    assert.equal(metric.completenessRatio, 1, `expected ${metric.field} to be fully populated`);
  }
});

test("the 300 reused fixture matches are fully consistent (all FINISHED with valid scores and distinct teams)", () => {
  const result = analyzeConsistency(REAL_FIXTURE_MATCHES);
  assert.equal(result.totalCount, 300);
  assert.equal(result.consistentCount, 300);
  assert.equal(result.consistencyRatio, 1);
  assert.deepEqual(result.inconsistencies, []);
});

test("analyzeCompleteness reports 0 completeness for a missing critical field across the whole sample", () => {
  const incomplete = [{ externalId: null, provider: "BETSAPI", league: { name: "", normalizedName: "", provider: "BETSAPI" }, scheduledAt: "2026-01-01T00:00:00.000Z", status: "SCHEDULED", home: { virtualTeam: { name: "A", normalizedName: "a" }, player: { nickname: "p1", normalizedNickname: "p1" } }, away: { virtualTeam: { name: "B", normalizedName: "b" }, player: { nickname: "p2", normalizedNickname: "p2" } }, homeScore: null, awayScore: null, rawHomeName: "A (p1)", rawAwayName: "B (p2)", sourcePayload: "{}" }];
  const metrics = analyzeCompleteness(incomplete);
  const externalIdMetric = metrics.find((m) => m.field === "externalId");
  assert.equal(externalIdMetric.completenessRatio, 0);
});

test("analyzeConsistency flags home_equals_away_team when both sides normalize to the same virtual team", () => {
  const match = {
    externalId: "x1", provider: "FIXTURE",
    league: { externalId: null, name: "Liga", normalizedName: "liga", provider: "FIXTURE" },
    scheduledAt: "2026-01-01T00:00:00.000Z", status: "FINISHED",
    home: { virtualTeam: { name: "TeamA", normalizedName: "teama" }, player: { nickname: "p1", normalizedNickname: "p1" } },
    away: { virtualTeam: { name: "TeamA", normalizedName: "teama" }, player: { nickname: "p2", normalizedNickname: "p2" } },
    homeScore: 1, awayScore: 2, rawHomeName: "TeamA (p1)", rawAwayName: "TeamA (p2)", sourcePayload: "{}",
  };
  const result = analyzeConsistency([match]);
  assert.equal(result.consistentCount, 0);
  assert.ok(result.inconsistencies.some((item) => item.startsWith("home_equals_away_team")));
});

test("analyzeConsistency flags negative_score, score_present_while_scheduled and invalid_scheduled_at", () => {
  const base = {
    externalId: "x2", provider: "FIXTURE",
    league: { externalId: null, name: "Liga", normalizedName: "liga", provider: "FIXTURE" },
    home: { virtualTeam: { name: "TeamA", normalizedName: "teama" }, player: { nickname: "p1", normalizedNickname: "p1" } },
    away: { virtualTeam: { name: "TeamB", normalizedName: "teamb" }, player: { nickname: "p2", normalizedNickname: "p2" } },
    rawHomeName: "TeamA (p1)", rawAwayName: "TeamB (p2)", sourcePayload: "{}",
  };
  const negativeScore = { ...base, scheduledAt: "2026-01-01T00:00:00.000Z", status: "FINISHED", homeScore: -1, awayScore: 2 };
  const scoreWhileScheduled = { ...base, scheduledAt: "2026-01-01T00:00:00.000Z", status: "SCHEDULED", homeScore: 1, awayScore: 0 };
  const invalidDate = { ...base, scheduledAt: "not-a-date", status: "FINISHED", homeScore: 1, awayScore: 0 };

  const result = analyzeConsistency([negativeScore, scoreWhileScheduled, invalidDate]);
  assert.equal(result.consistentCount, 0);
  const checkNames = result.inconsistencies.map((item) => item.split(":")[0]);
  assert.ok(checkNames.includes("negative_score"));
  assert.ok(checkNames.includes("score_present_while_scheduled"));
  assert.ok(checkNames.includes("invalid_scheduled_at"));
});

test("ALL_CONSISTENCY_CHECKS documents exactly 6 named checks", () => {
  assert.equal(ALL_CONSISTENCY_CHECKS.length, 6);
});

test("empty sample yields 0-valued ratios instead of NaN", () => {
  assert.equal(overallCompletenessScore(analyzeCompleteness([])), 0);
  const consistency = analyzeConsistency([]);
  assert.equal(consistency.consistencyRatio, 0);
});
