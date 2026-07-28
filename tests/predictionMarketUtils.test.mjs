import test from "node:test";
import assert from "node:assert/strict";
import { classifyPredictionRisk, deriveItemStatus, rollupItemsStatus, selectBestMarket } from "../src/lib/predictionMarketUtils.ts";

function market(overrides = {}) {
  return { code: "HOME_WIN", label: "Vitória do mandante", probabilityLabel: "50.0%", probabilityValue: 0.5, ...overrides };
}

test("selectBestMarket returns the market with the highest probabilityValue", () => {
  const markets = [market({ code: "HOME_WIN", probabilityValue: 0.4 }), market({ code: "OVER_2_5", probabilityValue: 0.72 }), market({ code: "BTTS", probabilityValue: 0.6 })];
  const best = selectBestMarket(markets);
  assert.equal(best.code, "OVER_2_5");
});

test("selectBestMarket resolves ties by first occurrence (stable order, never random)", () => {
  const markets = [market({ code: "HOME_WIN", probabilityValue: 0.5 }), market({ code: "DRAW", probabilityValue: 0.5 })];
  const best = selectBestMarket(markets);
  assert.equal(best.code, "HOME_WIN");
});

test("selectBestMarket ignores null probabilityValue entries", () => {
  const markets = [market({ code: "HOME_WIN", probabilityValue: null }), market({ code: "AWAY_WIN", probabilityValue: 0.3 })];
  const best = selectBestMarket(markets);
  assert.equal(best.code, "AWAY_WIN");
});

test("selectBestMarket returns null for an empty list", () => {
  assert.equal(selectBestMarket([]), null);
});

test("selectBestMarket returns null when every entry has a null probabilityValue", () => {
  const markets = [market({ probabilityValue: null }), market({ code: "DRAW", probabilityValue: null })];
  assert.equal(selectBestMarket(markets), null);
});

test("selectBestMarket does not mutate the input array", () => {
  const markets = [market({ code: "HOME_WIN", probabilityValue: 0.4 }), market({ code: "DRAW", probabilityValue: 0.6 })];
  const snapshot = JSON.parse(JSON.stringify(markets));
  selectBestMarket(markets);
  assert.deepEqual(markets, snapshot);
});

test("classifyPredictionRisk returns LOW/rank 0 when every signal is clean", () => {
  const result = classifyPredictionRisk({ combinedStatus: "STRONG", consistencyLevel: "ALIGNED", warningsCount: 0 });
  assert.equal(result.level, "LOW");
  assert.equal(result.rank, 0);
  assert.deepEqual(result.reasonCodes, []);
});

test("classifyPredictionRisk: LIMITED data sufficiency alone elevates to MEDIUM", () => {
  const result = classifyPredictionRisk({ combinedStatus: "LIMITED", consistencyLevel: "ALIGNED", warningsCount: 0 });
  assert.equal(result.level, "MEDIUM");
  assert.ok(result.reasonCodes.includes("LIMITED_DATA_SUFFICIENCY"));
});

test("classifyPredictionRisk: INSUFFICIENT data sufficiency alone elevates to HIGH", () => {
  const result = classifyPredictionRisk({ combinedStatus: "INSUFFICIENT", consistencyLevel: "ALIGNED", warningsCount: 0 });
  assert.equal(result.level, "HIGH");
  assert.ok(result.reasonCodes.includes("INSUFFICIENT_DATA_SUFFICIENCY"));
});

test("classifyPredictionRisk: MINOR_DIVERGENCE alone elevates to MEDIUM", () => {
  const result = classifyPredictionRisk({ combinedStatus: "STRONG", consistencyLevel: "MINOR_DIVERGENCE", warningsCount: 0 });
  assert.equal(result.level, "MEDIUM");
  assert.ok(result.reasonCodes.includes("MINOR_ENGINE_DIVERGENCE"));
});

test("classifyPredictionRisk: MAJOR_DIVERGENCE alone elevates to HIGH", () => {
  const result = classifyPredictionRisk({ combinedStatus: "STRONG", consistencyLevel: "MAJOR_DIVERGENCE", warningsCount: 0 });
  assert.equal(result.level, "HIGH");
  assert.ok(result.reasonCodes.includes("MAJOR_ENGINE_DIVERGENCE"));
});

test("classifyPredictionRisk: INSUFFICIENT + MAJOR_DIVERGENCE together always reach ELEVATED (worst case)", () => {
  const result = classifyPredictionRisk({ combinedStatus: "INSUFFICIENT", consistencyLevel: "MAJOR_DIVERGENCE", warningsCount: 0 });
  assert.equal(result.level, "ELEVATED");
  assert.equal(result.rank, 3);
});

test("classifyPredictionRisk: warnings present add exactly one rank on top of the base classification", () => {
  const clean = classifyPredictionRisk({ combinedStatus: "STRONG", consistencyLevel: "ALIGNED", warningsCount: 0 });
  const warned = classifyPredictionRisk({ combinedStatus: "STRONG", consistencyLevel: "ALIGNED", warningsCount: 3 });
  assert.equal(clean.rank, 0);
  assert.equal(warned.rank, 1);
  assert.ok(warned.reasonCodes.includes("ENGINE_WARNINGS_PRESENT"));
});

test("classifyPredictionRisk: warnings never push the rank above ELEVATED (capped at 3)", () => {
  const result = classifyPredictionRisk({ combinedStatus: "INSUFFICIENT", consistencyLevel: "MAJOR_DIVERGENCE", warningsCount: 5 });
  assert.equal(result.rank, 3);
  assert.equal(result.level, "ELEVATED");
});

test("classifyPredictionRisk is deterministic for identical input", () => {
  const input = { combinedStatus: "LIMITED", consistencyLevel: "MINOR_DIVERGENCE", warningsCount: 1 };
  assert.deepEqual(classifyPredictionRisk(input), classifyPredictionRisk(input));
});

test("deriveItemStatus maps rank 0 to 'success' and any rank above 0 to 'partial'", () => {
  assert.equal(deriveItemStatus(0), "success");
  assert.equal(deriveItemStatus(1), "partial");
  assert.equal(deriveItemStatus(2), "partial");
  assert.equal(deriveItemStatus(3), "partial");
});

test("rollupItemsStatus is 'success' only when every item is 'success'", () => {
  assert.equal(rollupItemsStatus([{ status: "success" }, { status: "success" }]), "success");
});

test("rollupItemsStatus is 'partial' when any item is 'partial'", () => {
  assert.equal(rollupItemsStatus([{ status: "success" }, { status: "partial" }]), "partial");
});

test("rollupItemsStatus is 'success' for an empty list (vacuously true, matches Array.some semantics)", () => {
  assert.equal(rollupItemsStatus([]), "success");
});
