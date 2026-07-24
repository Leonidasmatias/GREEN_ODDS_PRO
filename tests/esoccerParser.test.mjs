import test from "node:test";
import assert from "node:assert/strict";
import {
  parseESoccerParticipant,
  ESoccerParticipantParseError,
} from "../src/lib/esoccer/participantParser.ts";

test("parses Bologna (Nightxx)", () => {
  assert.deepEqual(parseESoccerParticipant("Bologna (Nightxx)"), {
    raw: "Bologna (Nightxx)",
    virtualTeam: "Bologna",
    playerNickname: "Nightxx",
    normalizedVirtualTeam: "bologna",
    normalizedPlayerNickname: "nightxx",
  });
});

test("parses Spain (DangerDim77)", () => {
  const result = parseESoccerParticipant("Spain (DangerDim77)");
  assert.equal(result.virtualTeam, "Spain");
  assert.equal(result.playerNickname, "DangerDim77");
  assert.equal(result.normalizedVirtualTeam, "spain");
  assert.equal(result.normalizedPlayerNickname, "dangerdim77");
});

test("tolerates extra internal and boundary whitespace", () => {
  const raw = "  Bologna   ( Nightxx )";
  assert.deepEqual(parseESoccerParticipant(raw), {
    raw,
    virtualTeam: "Bologna",
    playerNickname: "Nightxx",
    normalizedVirtualTeam: "bologna",
    normalizedPlayerNickname: "nightxx",
  });
});

test("nickname with numbers parses correctly", () => {
  assert.equal(parseESoccerParticipant("Spain (DangerDim77)").playerNickname, "DangerDim77");
});

test("lowercase nickname parses correctly", () => {
  const result = parseESoccerParticipant("Roma (nekishka)");
  assert.equal(result.playerNickname, "nekishka");
  assert.equal(result.normalizedPlayerNickname, "nekishka");
});

test("uppercase nickname parses correctly", () => {
  const result = parseESoccerParticipant("Roma (NEKISHKA)");
  assert.equal(result.playerNickname, "NEKISHKA");
  assert.equal(result.normalizedPlayerNickname, "nekishka");
});

test("empty string is rejected", () => {
  assert.throws(() => parseESoccerParticipant(""), ESoccerParticipantParseError);
});

test("whitespace-only string is rejected", () => {
  assert.throws(() => parseESoccerParticipant("   "), ESoccerParticipantParseError);
});

test("missing parentheses is rejected", () => {
  assert.throws(() => parseESoccerParticipant("Bologna"), ESoccerParticipantParseError);
});

test("missing virtual team is rejected", () => {
  assert.throws(() => parseESoccerParticipant("(Nightxx)"), ESoccerParticipantParseError);
});

test("empty parentheses is rejected", () => {
  assert.throws(() => parseESoccerParticipant("Bologna ()"), ESoccerParticipantParseError);
});

test("only parentheses is rejected", () => {
  assert.throws(() => parseESoccerParticipant("()"), ESoccerParticipantParseError);
});

test("unclosed parenthesis is rejected", () => {
  assert.throws(() => parseESoccerParticipant("Bologna (Nightxx"), ESoccerParticipantParseError);
});

test("missing opening parenthesis is rejected", () => {
  assert.throws(() => parseESoccerParticipant("Bologna Nightxx)"), ESoccerParticipantParseError);
});

test("trailing text after closing parenthesis is rejected", () => {
  assert.throws(() => parseESoccerParticipant("Bologna (Nightxx) texto extra"), ESoccerParticipantParseError);
});

test("non-string runtime values are rejected despite the declared string type", () => {
  assert.throws(() => parseESoccerParticipant(/** @type {any} */ (null)), ESoccerParticipantParseError);
  assert.throws(() => parseESoccerParticipant(/** @type {any} */ (undefined)), ESoccerParticipantParseError);
  assert.throws(() => parseESoccerParticipant(/** @type {any} */ (42)), ESoccerParticipantParseError);
  assert.throws(
    () => parseESoccerParticipant(/** @type {any} */ ({ virtualTeam: "Bologna", playerNickname: "Nightxx" })),
    ESoccerParticipantParseError,
  );
});
