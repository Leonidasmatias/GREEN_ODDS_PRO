import test from "node:test";
import assert from "node:assert/strict";
import {
  validateMatchParticipants,
  validateFinishedScore,
  validatePredictionProbabilities,
  classifyRecommendationStatus,
  ESoccerDomainValidationError,
} from "../src/services/esoccerDomainService.ts";

test("same normalized nickname on both sides fails", () => {
  assert.throws(() => validateMatchParticipants("nightxx", "nightxx"), ESoccerDomainValidationError);
});

test("different normalized nicknames pass", () => {
  assert.doesNotThrow(() => validateMatchParticipants("nightxx", "grellz"));
});

test("empty participant nickname fails", () => {
  assert.throws(() => validateMatchParticipants("", "grellz"), ESoccerDomainValidationError);
  assert.throws(() => validateMatchParticipants("nightxx", ""), ESoccerDomainValidationError);
});

test("negative score fails", () => {
  assert.throws(() => validateFinishedScore("FINISHED", -1, 0), ESoccerDomainValidationError);
});

test("decimal score fails", () => {
  assert.throws(() => validateFinishedScore("FINISHED", 1.5, 0), ESoccerDomainValidationError);
});

test("finished match missing home score fails", () => {
  assert.throws(() => validateFinishedScore("FINISHED", null, 1), ESoccerDomainValidationError);
});

test("finished match missing away score fails", () => {
  assert.throws(() => validateFinishedScore("FINISHED", 1, undefined), ESoccerDomainValidationError);
});

test("finished match with valid score passes", () => {
  assert.doesNotThrow(() => validateFinishedScore("FINISHED", 2, 1));
});

test("non-finished match without score passes", () => {
  assert.doesNotThrow(() => validateFinishedScore("SCHEDULED", null, null));
});

test("non-finished match with present but invalid score still fails", () => {
  assert.throws(() => validateFinishedScore("LIVE", -2, 1), ESoccerDomainValidationError);
});

test("negative probability fails", () => {
  assert.throws(
    () => validatePredictionProbabilities({ homeWinProbability: -0.1, drawProbability: 0.5, awayWinProbability: 0.6 }),
    ESoccerDomainValidationError,
  );
});

test("probability above one fails", () => {
  assert.throws(
    () => validatePredictionProbabilities({ homeWinProbability: 1.1, drawProbability: 0, awayWinProbability: 0 }),
    ESoccerDomainValidationError,
  );
});

test("invalid probability sum fails", () => {
  assert.throws(
    () => validatePredictionProbabilities({ homeWinProbability: 0.5, drawProbability: 0.5, awayWinProbability: 0.5 }),
    ESoccerDomainValidationError,
  );
});

test("valid probability sum passes", () => {
  assert.doesNotThrow(() =>
    validatePredictionProbabilities({ homeWinProbability: 0.5, drawProbability: 0.3, awayWinProbability: 0.2 }),
  );
});

test("valid rounding tolerance passes", () => {
  assert.doesNotThrow(() =>
    validatePredictionProbabilities({ homeWinProbability: 0.400001, drawProbability: 0.3, awayWinProbability: 0.3 }),
  );
});

test("confidence score classification boundaries", () => {
  assert.equal(classifyRecommendationStatus(0), "NO_BET");
  assert.equal(classifyRecommendationStatus(49), "NO_BET");
  assert.equal(classifyRecommendationStatus(50), "OBSERVATION");
  assert.equal(classifyRecommendationStatus(69), "OBSERVATION");
  assert.equal(classifyRecommendationStatus(70), "APPROVED");
  assert.equal(classifyRecommendationStatus(100), "APPROVED");
});

test("negative confidence fails", () => {
  assert.throws(() => classifyRecommendationStatus(-1), ESoccerDomainValidationError);
});

test("confidence above 100 fails", () => {
  assert.throws(() => classifyRecommendationStatus(101), ESoccerDomainValidationError);
});

test("NaN confidence fails", () => {
  assert.throws(() => classifyRecommendationStatus(NaN), ESoccerDomainValidationError);
});
