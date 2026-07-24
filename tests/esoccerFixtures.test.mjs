import test from "node:test";
import assert from "node:assert/strict";
import { parseESoccerParticipant } from "../src/lib/esoccer/participantParser.ts";
import { esoccerMatchFixtures, ESOCCER_FIXTURES_DATA_KIND } from "./fixtures/esoccerMatches.mjs";

test("fixtures are explicitly marked as simulated data", () => {
  assert.equal(ESOCCER_FIXTURES_DATA_KIND, "SIMULATED_TEST_DATA");
});

test("fixtures contain at least four simulated matches", () => {
  assert.ok(esoccerMatchFixtures.length >= 4);
});

test("every fixture raw participant name parses successfully", () => {
  for (const fixture of esoccerMatchFixtures) {
    assert.doesNotThrow(() => parseESoccerParticipant(fixture.rawHomeName));
    assert.doesNotThrow(() => parseESoccerParticipant(fixture.rawAwayName));
  }
});

test("every fixture uses the FIXTURE provider", () => {
  for (const fixture of esoccerMatchFixtures) {
    assert.equal(fixture.provider, "FIXTURE");
  }
});
