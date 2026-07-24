import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Contrato de schema: lê o prisma/schema.prisma REAL do projeto (não uma
// cópia), garantindo que os enums e models eSoccer da Fase 1 existem e que
// as regras de unicidade/indice essenciais descritas na missão foram
// aplicadas ao arquivo de produção.
const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "prisma", "schema.prisma");
const schema = readFileSync(schemaPath, "utf8");

test("eSoccer enums exist in schema.prisma", () => {
  for (const name of [
    "ESoccerPlayerStatus",
    "ESoccerLeagueStatus",
    "ESoccerMatchStatus",
    "ESoccerProvider",
    "ESoccerRatingSystem",
    "ESoccerRecommendationStatus",
    "ESoccerMarket",
  ]) {
    assert.match(schema, new RegExp(`enum ${name} \\{`), `enum ${name} não encontrado`);
  }
});

test("eSoccer models exist in schema.prisma", () => {
  for (const name of [
    "ESoccerPlayer",
    "ESoccerPlayerAlias",
    "ESoccerLeague",
    "ESoccerVirtualTeam",
    "ESoccerMatch",
    "ESoccerPlayerRating",
    "ESoccerPlayerRollingStats",
    "ESoccerHeadToHeadStats",
    "ESoccerPrediction",
    "ESoccerRecommendation",
  ]) {
    assert.match(schema, new RegExp(`model ${name} \\{`), `model ${name} não encontrado`);
  }
});

test("normalizedNickname is unique", () => {
  assert.match(schema, /normalizedNickname\s+String\s+@unique/);
});

test("normalizedAlias is unique", () => {
  assert.match(schema, /normalizedAlias\s+String\s+@unique/);
});

test("head-to-head pair has a composite unique constraint", () => {
  assert.match(schema, /@@unique\(\[playerAId, playerBId\]\)/);
});

test("rolling stats has a composite unique constraint per player and window", () => {
  assert.match(schema, /@@unique\(\[playerId, windowSize\]\)/);
});

test("ESoccerMatch has the essential indexes", () => {
  for (const field of ["externalId", "provider", "leagueId", "scheduledAt", "status", "homePlayerId", "awayPlayerId"]) {
    assert.match(schema, new RegExp(`@@index\\(\\[${field}\\]\\)`), `índice de ${field} não encontrado`);
  }
});

test("ESoccerMatch relates to ESoccerPlayer on both sides with named relations", () => {
  assert.match(schema, /homePlayer\s+ESoccerPlayer\s+@relation\("ESoccerMatchHomePlayer"/);
  assert.match(schema, /awayPlayer\s+ESoccerPlayer\s+@relation\("ESoccerMatchAwayPlayer"/);
});

test("ESoccerMatch prevents duplicate provider+externalId while allowing multiple nulls", () => {
  assert.match(schema, /@@unique\(\[provider, externalId\]\)/);
});
