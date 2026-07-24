import test from "node:test";
import assert from "node:assert/strict";
import { computeFreshnessScore, FRESHNESS_ZERO_MULTIPLIER } from "../src/services/observability/FreshnessScore.ts";

const NOW = () => new Date("2026-01-01T12:00:00.000Z");
const STALE_MINUTES = 60;

test("no timestamp at all yields 0", () => {
  assert.equal(computeFreshnessScore(null, NOW, STALE_MINUTES), 0);
});

test("an unparseable timestamp yields 0 (never throws)", () => {
  assert.equal(computeFreshnessScore("not-a-date", NOW, STALE_MINUTES), 0);
});

test("data exactly at the fresh window boundary scores 100", () => {
  const boundary = new Date(NOW().getTime() - STALE_MINUTES * 60_000).toISOString();
  assert.equal(computeFreshnessScore(boundary, NOW, STALE_MINUTES), 100);
});

test("data well within the fresh window (a few minutes old) scores 100", () => {
  const recent = new Date(NOW().getTime() - 5 * 60_000).toISOString();
  assert.equal(computeFreshnessScore(recent, NOW, STALE_MINUTES), 100);
});

test("data at exactly FRESHNESS_ZERO_MULTIPLIER x the stale window scores exactly 0", () => {
  const veryOld = new Date(NOW().getTime() - STALE_MINUTES * FRESHNESS_ZERO_MULTIPLIER * 60_000).toISOString();
  assert.equal(computeFreshnessScore(veryOld, NOW, STALE_MINUTES), 0);
});

test("data far beyond the zero-multiplier window also scores 0 (never negative)", () => {
  const ancient = new Date(NOW().getTime() - STALE_MINUTES * FRESHNESS_ZERO_MULTIPLIER * 60_000 * 5).toISOString();
  assert.equal(computeFreshnessScore(ancient, NOW, STALE_MINUTES), 0);
});

test("data exactly halfway through the decay window scores exactly 50", () => {
  const zeroAtMinutes = STALE_MINUTES * FRESHNESS_ZERO_MULTIPLIER;
  const halfwayMinutes = STALE_MINUTES + (zeroAtMinutes - STALE_MINUTES) / 2;
  const halfway = new Date(NOW().getTime() - halfwayMinutes * 60_000).toISOString();
  assert.equal(computeFreshnessScore(halfway, NOW, STALE_MINUTES), 50);
});

test("decay is monotonically non-increasing as data ages", () => {
  const ages = [0, 30, 60, 90, 120, 300, 600, 900];
  const scores = ages.map((minutes) => computeFreshnessScore(new Date(NOW().getTime() - minutes * 60_000).toISOString(), NOW, STALE_MINUTES));
  for (let i = 1; i < scores.length; i += 1) {
    assert.ok(scores[i] <= scores[i - 1], `score must not increase as data ages: ${scores}`);
  }
});

test("a timestamp in the future (clock skew) is treated as fresh (100), never throws or goes negative", () => {
  const future = new Date(NOW().getTime() + 60_000).toISOString();
  assert.equal(computeFreshnessScore(future, NOW, STALE_MINUTES), 100);
});

test("calculation is deterministic - same inputs always produce the same score", () => {
  const timestamp = new Date(NOW().getTime() - 200 * 60_000).toISOString();
  const first = computeFreshnessScore(timestamp, NOW, STALE_MINUTES);
  const second = computeFreshnessScore(timestamp, NOW, STALE_MINUTES);
  assert.equal(first, second);
});

test("staleDataMinutes=0 never crashes (division-by-zero guarded) and scores 0 for any age above 0", () => {
  const slightlyOld = new Date(NOW().getTime() - 1_000).toISOString();
  assert.equal(computeFreshnessScore(slightlyOld, NOW, 0), 0);
});

test("every score stays within the mandatory 0..100 range across a wide sweep of ages", () => {
  for (let minutes = -100; minutes <= 2000; minutes += 37) {
    const score = computeFreshnessScore(new Date(NOW().getTime() - minutes * 60_000).toISOString(), NOW, STALE_MINUTES);
    assert.ok(score >= 0 && score <= 100, `score ${score} for age ${minutes}min out of range`);
  }
});
