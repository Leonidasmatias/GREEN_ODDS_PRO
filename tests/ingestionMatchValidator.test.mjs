import test from "node:test";
import assert from "node:assert/strict";
import { validateInternalMatch } from "../src/providers/pipeline/MatchValidator.ts";
import { normalizeProviderMatch } from "../src/providers/pipeline/ProviderNormalizer.ts";
import { esoccerFixtureCatalog } from "../src/providers/fixture/esoccerFixtureCatalog.ts";

function validMatch(overrides = {}) {
  const dto = normalizeProviderMatch({ provider: "FIXTURE", raw: esoccerFixtureCatalog[0] });
  return { ...dto, ...overrides };
}

test("a match normalized straight from a real fixture is valid", () => {
  const result = validateInternalMatch(validMatch());
  assert.equal(result.valid, true);
});

test("rejects a match where the same player faces themself", () => {
  const match = validMatch();
  match.away = { ...match.away, player: { ...match.home.player } };
  const result = validateInternalMatch(match);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "players"));
});

test("rejects a match with an empty league name", () => {
  const match = validMatch();
  match.league = { ...match.league, name: "   " };
  const result = validateInternalMatch(match);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "league"));
});

test("rejects a match with an unparseable scheduledAt", () => {
  const match = validMatch({ scheduledAt: "not-a-date" });
  const result = validateInternalMatch(match);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "scheduledAt"));
});

test("rejects a FINISHED match missing one of the scores (incomplete payload)", () => {
  const match = validMatch({ homeScore: null });
  const result = validateInternalMatch(match);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "score"));
});

test("rejects a negative score", () => {
  const match = validMatch({ awayScore: -1 });
  const result = validateInternalMatch(match);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "score"));
});

test("rejects an unknown status string", () => {
  const match = validMatch({ status: "NOT_A_REAL_STATUS" });
  const result = validateInternalMatch(match);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "status"));
});

test("rejects an unknown provider", () => {
  const match = validMatch({ provider: "NOT_A_REAL_PROVIDER" });
  const result = validateInternalMatch(match);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "provider"));
});

test("rejects a match with an empty sourcePayload", () => {
  const match = validMatch({ sourcePayload: "" });
  const result = validateInternalMatch(match);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.field === "payload"));
});

test("accumulates every applicable error instead of stopping at the first one", () => {
  const match = validMatch({ scheduledAt: "not-a-date", provider: "NOT_A_REAL_PROVIDER", sourcePayload: "" });
  const result = validateInternalMatch(match);
  assert.equal(result.valid, false);
  const fields = result.errors.map((e) => e.field);
  assert.ok(fields.includes("scheduledAt"));
  assert.ok(fields.includes("provider"));
  assert.ok(fields.includes("payload"));
});

test("a SCHEDULED match with no score yet is valid (scores are only required once FINISHED)", () => {
  const match = validMatch({ status: "SCHEDULED", homeScore: null, awayScore: null });
  const result = validateInternalMatch(match);
  assert.equal(result.valid, true);
});
