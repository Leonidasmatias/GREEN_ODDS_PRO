import test from "node:test";
import assert from "node:assert/strict";
import { DeduplicationService } from "../src/providers/pipeline/DeduplicationService.ts";
import { normalizeProviderMatch } from "../src/providers/pipeline/ProviderNormalizer.ts";
import { esoccerFixtureCatalog } from "../src/providers/fixture/esoccerFixtureCatalog.ts";

function dto(overrides = {}) {
  const base = normalizeProviderMatch({ provider: "FIXTURE", raw: esoccerFixtureCatalog[0] });
  return { ...base, ...overrides };
}

test("the first time a match (by externalId) is seen, it is NEW", () => {
  const dedup = new DeduplicationService();
  assert.equal(dedup.evaluate(dto()), "NEW");
  assert.equal(dedup.size(), 1);
});

test("seeing the exact same match again is a DUPLICATE", () => {
  const dedup = new DeduplicationService();
  const match = dto();
  assert.equal(dedup.evaluate(match), "NEW");
  assert.equal(dedup.evaluate({ ...match }), "DUPLICATE");
  assert.equal(dedup.size(), 1);
});

test("seeing the same identity with a changed score is UPDATED, not DUPLICATE", () => {
  const dedup = new DeduplicationService();
  const first = dto({ homeScore: 1 });
  const later = dto({ homeScore: 2 });
  assert.equal(dedup.evaluate(first), "NEW");
  assert.equal(dedup.evaluate(later), "UPDATED");
  assert.equal(dedup.size(), 1);
});

test("matches with different externalIds are independent, even with identical content otherwise", () => {
  const dedup = new DeduplicationService();
  assert.equal(dedup.evaluate(dto({ externalId: "a" })), "NEW");
  assert.equal(dedup.evaluate(dto({ externalId: "b" })), "NEW");
  assert.equal(dedup.size(), 2);
});

test("falls back to a content hash key when externalId is absent", () => {
  const dedup = new DeduplicationService();
  const withoutId = dto({ externalId: null });
  assert.equal(dedup.evaluate(withoutId), "NEW");
  assert.equal(dedup.evaluate({ ...withoutId }), "DUPLICATE");
});

test("two different providers reporting the same externalId are tracked as separate identities", () => {
  const dedup = new DeduplicationService();
  assert.equal(dedup.evaluate(dto({ externalId: "shared-id", provider: "FIXTURE" })), "NEW");
  assert.equal(dedup.evaluate(dto({ externalId: "shared-id", provider: "BETSAPI" })), "NEW");
  assert.equal(dedup.size(), 2);
});

test("clear() resets all known identities", () => {
  const dedup = new DeduplicationService();
  dedup.evaluate(dto());
  dedup.clear();
  assert.equal(dedup.size(), 0);
  assert.equal(dedup.evaluate(dto()), "NEW");
});
