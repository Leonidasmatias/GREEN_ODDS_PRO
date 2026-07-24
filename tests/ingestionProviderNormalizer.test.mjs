import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProviderMatch, ProviderNormalizerError } from "../src/providers/pipeline/ProviderNormalizer.ts";
import { esoccerFixtureCatalog } from "../src/providers/fixture/esoccerFixtureCatalog.ts";

function betsApiPayload(overrides = {}) {
  return {
    id: "bf-100",
    league: { id: "l1", name: "Esoccer Battle - 8 mins play" },
    time: "1767225600",
    time_status: "3",
    home: { name: "TeamB (player-07)" },
    away: { name: "TeamA (player-05)" },
    ss: "3-2",
    ...overrides,
  };
}

test("normalizes a FIXTURE raw match into the internal DTO shape", () => {
  const raw = esoccerFixtureCatalog[0];
  const dto = normalizeProviderMatch({ provider: "FIXTURE", raw });

  assert.equal(dto.provider, "FIXTURE");
  assert.equal(dto.externalId, raw.id);
  assert.equal(dto.status, "FINISHED");
  assert.equal(dto.home.player.nickname, raw.homePlayerId);
  assert.equal(dto.away.player.nickname, raw.awayPlayerId);
  assert.equal(dto.home.virtualTeam.name, raw.rawHomeName.split(" (")[0]);
  assert.equal(dto.homeScore, raw.homeScore);
  assert.equal(dto.awayScore, raw.awayScore);
  assert.equal(typeof dto.sourcePayload, "string");
  assert.ok(JSON.parse(dto.sourcePayload).id === raw.id);
});

test("normalizes a BETSAPI raw match, mapping time/time_status/ss into the internal shape", () => {
  const dto = normalizeProviderMatch({ provider: "BETSAPI", raw: betsApiPayload() });

  assert.equal(dto.provider, "BETSAPI");
  assert.equal(dto.externalId, "bf-100");
  assert.equal(dto.scheduledAt, "2026-01-01T00:00:00.000Z");
  assert.equal(dto.status, "FINISHED");
  assert.equal(dto.home.player.nickname, "player-07");
  assert.equal(dto.away.player.nickname, "player-05");
  assert.equal(dto.home.virtualTeam.name, "TeamB");
  assert.equal(dto.homeScore, 3);
  assert.equal(dto.awayScore, 2);
});

test("BETSAPI time_status maps to every documented internal status", () => {
  const scheduled = normalizeProviderMatch({ provider: "BETSAPI", raw: betsApiPayload({ time_status: "0", ss: null }) });
  const live = normalizeProviderMatch({ provider: "BETSAPI", raw: betsApiPayload({ time_status: "1", ss: "1-0" }) });
  const finished = normalizeProviderMatch({ provider: "BETSAPI", raw: betsApiPayload({ time_status: "3" }) });
  const unknown = normalizeProviderMatch({ provider: "BETSAPI", raw: betsApiPayload({ time_status: "9", ss: null }) });

  assert.equal(scheduled.status, "SCHEDULED");
  assert.equal(scheduled.homeScore, null);
  assert.equal(live.status, "LIVE");
  assert.equal(finished.status, "FINISHED");
  assert.equal(unknown.status, "UNKNOWN");
});

test("throws ProviderNormalizerError for a raw name that does not follow the 'Team (nickname)' format", () => {
  assert.throws(
    () => normalizeProviderMatch({ provider: "BETSAPI", raw: betsApiPayload({ home: { name: "MissingParens" } }) }),
    ProviderNormalizerError,
  );
});

test("throws ProviderNormalizerError for an unparseable BetsAPI score string", () => {
  assert.throws(
    () => normalizeProviderMatch({ provider: "BETSAPI", raw: betsApiPayload({ ss: "not-a-score" }) }),
    ProviderNormalizerError,
  );
});

test("CSV/MANUAL raw matches (fixture-like shape) normalize the same way as FIXTURE", () => {
  const raw = { ...esoccerFixtureCatalog[1], provider: "MANUAL" };
  const dto = normalizeProviderMatch({ provider: "MANUAL", raw });
  assert.equal(dto.provider, "MANUAL");
  assert.equal(dto.home.player.nickname, raw.homePlayerId);
});
