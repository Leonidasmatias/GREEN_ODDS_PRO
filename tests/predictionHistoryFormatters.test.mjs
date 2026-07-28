import test from "node:test";
import assert from "node:assert/strict";
import {
  formatHashShort,
  formatMatchParticipant,
  formatPredictionCombinedStatus,
  formatPredictionGreenScoreCategory,
  formatPredictionSource,
} from "../src/lib/predictionHistoryFormatters.ts";

test("formatPredictionGreenScoreCategory: formats known categories", () => {
  assert.equal(formatPredictionGreenScoreCategory("LOW"), "Baixo");
  assert.equal(formatPredictionGreenScoreCategory("MEDIUM"), "Médio");
  assert.equal(formatPredictionGreenScoreCategory("HIGH"), "Alto");
  assert.equal(formatPredictionGreenScoreCategory("VERY_HIGH"), "Muito alto");
});

test("formatPredictionGreenScoreCategory: unknown value falls back to raw string (never throws)", () => {
  assert.equal(formatPredictionGreenScoreCategory("SOMETHING_UNEXPECTED"), "SOMETHING_UNEXPECTED");
});

test("formatPredictionCombinedStatus: formats known statuses", () => {
  assert.equal(formatPredictionCombinedStatus("INSUFFICIENT"), "Dados insuficientes");
  assert.equal(formatPredictionCombinedStatus("LIMITED"), "Dados limitados");
  assert.equal(formatPredictionCombinedStatus("SUFFICIENT"), "Dados suficientes");
  assert.equal(formatPredictionCombinedStatus("STRONG"), "Dados robustos");
});

test("formatPredictionCombinedStatus: unknown value falls back to raw string (never throws)", () => {
  assert.equal(formatPredictionCombinedStatus("WEIRD_VALUE"), "WEIRD_VALUE");
});

test("formatPredictionSource: fixture vs real labels, never alters the domain value itself", () => {
  assert.equal(formatPredictionSource("fixture"), "Fixture (demonstração)");
  assert.equal(formatPredictionSource("real"), "Real");
});

test("formatMatchParticipant: uses virtual team when present", () => {
  assert.equal(formatMatchParticipant("Neon FC", "player-1"), "Neon FC");
});

test("formatMatchParticipant: falls back to player id when virtual team is null, never renders 'null'", () => {
  assert.equal(formatMatchParticipant(null, "player-1"), "player-1");
});

test("formatHashShort: abbreviates long values with ellipsis", () => {
  const hash = "a1b2c3d4e5f6g7h8i9j0";
  const short = formatHashShort(hash);
  assert.equal(short, "a1b2c3d4…i9j0");
});

test("formatHashShort: never truncates a value already short enough", () => {
  assert.equal(formatHashShort("short"), "short");
});

test("formatHashShort: respects custom prefix/suffix lengths", () => {
  assert.equal(formatHashShort("abcdefghij", 3, 2), "abc…ij");
});
