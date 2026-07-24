import test from "node:test";
import assert from "node:assert/strict";
import { classifyEsoccerEvent } from "../src/providers/betsapi/EsoccerClassifier.ts";

function event(overrides = {}) {
  return {
    id: "e1",
    time: "1767225600",
    time_status: "0",
    league: { id: "l1", name: "Esoccer Battle - 8 mins play" },
    home: { id: "h1", name: "TeamB (player-07)" },
    away: { id: "a1", name: "TeamA (player-05)" },
    ss: null,
    ...overrides,
  };
}

const noLists = { allowlist: [], denylist: [] };

test("is_esports=true plus a matching participant pattern (2 signals) is confirmed_esoccer", () => {
  const result = classifyEsoccerEvent(event({ is_esports: true }), noLists);
  assert.equal(result.classification, "confirmed_esoccer");
  assert.ok(result.evidence.includes("is_esports=true"));
  assert.ok(result.evidence.includes("participant_pattern_matched"));
});

test("league in the allowlist plus a matching participant pattern (2 signals) is confirmed_esoccer even without is_esports", () => {
  const result = classifyEsoccerEvent(event(), { allowlist: ["Esoccer Battle - 8 mins play"], denylist: [] });
  assert.equal(result.classification, "confirmed_esoccer");
});

test("only the participant pattern matching (1 signal) is probable_esoccer, not confirmed", () => {
  const result = classifyEsoccerEvent(event(), noLists);
  assert.equal(result.classification, "probable_esoccer");
});

test("only is_esports=true, with a real-football-style participant name (1 signal) is probable_esoccer", () => {
  const result = classifyEsoccerEvent(event({ is_esports: true, home: { id: "h1", name: "Real Madrid" }, away: { id: "a1", name: "Barcelona" } }), noLists);
  assert.equal(result.classification, "probable_esoccer");
});

test("is_esports=false with no other corroborating signal is not_esoccer", () => {
  const result = classifyEsoccerEvent(
    event({ is_esports: false, home: { id: "h1", name: "Real Madrid" }, away: { id: "a1", name: "Barcelona" } }),
    noLists,
  );
  assert.equal(result.classification, "not_esoccer");
});

test("a league in the denylist is not_esoccer even when is_esports=true and the participant pattern matches", () => {
  const result = classifyEsoccerEvent(event({ is_esports: true }), {
    allowlist: [],
    denylist: ["Esoccer Battle - 8 mins play"],
  });
  assert.equal(result.classification, "not_esoccer");
  assert.ok(result.evidence.some((e) => e.startsWith("league_in_denylist")));
});

test("no signal available at all (no is_esports field, real-style names, no lists) is unknown", () => {
  const result = classifyEsoccerEvent(
    event({ is_esports: undefined, home: { id: "h1", name: "Real Madrid" }, away: { id: "a1", name: "Barcelona" } }),
    noLists,
  );
  assert.equal(result.classification, "unknown");
});

test("denylist match is case/whitespace-insensitive via the same normalization used across the project", () => {
  const result = classifyEsoccerEvent(
    event({ league: { id: "l1", name: "  ESOCCER BATTLE - 8 MINS PLAY  " } }),
    { allowlist: [], denylist: ["esoccer battle - 8 mins play"] },
  );
  assert.equal(result.classification, "not_esoccer");
});

test("evidence array always reflects exactly the signals that fired", () => {
  const result = classifyEsoccerEvent(event({ is_esports: true }), { allowlist: ["Esoccer Battle - 8 mins play"], denylist: [] });
  assert.equal(result.evidence.length, 3);
  assert.ok(result.evidence.includes("is_esports=true"));
  assert.ok(result.evidence.includes("participant_pattern_matched"));
  assert.ok(result.evidence.some((e) => e.startsWith("league_in_allowlist")));
});
