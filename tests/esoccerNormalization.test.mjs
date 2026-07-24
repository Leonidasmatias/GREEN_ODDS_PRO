import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeESoccerNickname,
  normalizeVirtualTeamName,
  canonicalizePlayerPair,
  ESoccerNormalizationError,
} from "../src/lib/esoccer/normalization.ts";

test("trim removes leading and trailing whitespace", () => {
  assert.equal(normalizeESoccerNickname("  Nightxx  "), "nightxx");
});

test("Unicode NFKC normalization is applied", () => {
  assert.equal(normalizeESoccerNickname("ﬁghter"), "fighter");
});

test("multiple internal spaces collapse to one", () => {
  assert.equal(normalizeVirtualTeamName("Player   One"), "player one");
});

test("lowercase key is generated", () => {
  assert.equal(normalizeESoccerNickname("NEKISHKA"), "nekishka");
});

test("numbers are preserved", () => {
  assert.equal(normalizeESoccerNickname("DangerDim77"), "dangerdim77");
});

test("hyphen is preserved", () => {
  assert.equal(normalizeESoccerNickname("Player-One"), "player-one");
});

test("underscore is preserved", () => {
  assert.equal(normalizeESoccerNickname("Player_One"), "player_one");
});

test("result is deterministic", () => {
  assert.equal(normalizeESoccerNickname("Nightxx"), normalizeESoccerNickname("Nightxx"));
});

test("empty value after normalization fails", () => {
  assert.throws(() => normalizeESoccerNickname("   "), ESoccerNormalizationError);
});

test("non-string value fails", () => {
  assert.throws(() => normalizeESoccerNickname(/** @type {any} */ (42)), ESoccerNormalizationError);
});

test("canonicalizePlayerPair orders strings", () => {
  assert.deepEqual(canonicalizePlayerPair("player-b", "player-a"), ["player-a", "player-b"]);
});

test("canonicalizePlayerPair orders numeric ids", () => {
  assert.deepEqual(canonicalizePlayerPair(42, 7), [7, 42]);
});

test("canonicalizePlayerPair is idempotent", () => {
  const [a, b] = canonicalizePlayerPair("x", "y");
  assert.deepEqual(canonicalizePlayerPair(a, b), [a, b]);
});
