import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROFILE_TABLE_FILTERS, filterProfileRows, sortProfileRows } from "../src/lib/intelligenceProfileTableUtils.ts";

function row(overrides = {}) {
  return {
    id: "PLAYER::alice",
    dimensionCode: "PLAYER",
    dimensionLabel: "Jogador",
    key: "alice",
    status: "STABLE",
    statusLabel: "Estável",
    reliabilityLabel: "90.0%",
    reliabilityValue: 90,
    driftSignalsCount: 0,
    recommendationCode: "PROFILE_STABLE",
    recommendationLabel: "Perfil estável",
    riskCode: "LOW",
    riskLabel: "Risco baixo",
    suggestedMultiplierLabel: "1.00x",
    strategyStatus: "NORMAL",
    trendCode: "INCREASING_STABILITY",
    trendLabel: "Estabilidade crescente",
    ...overrides,
  };
}

test("filterProfileRows with default filters returns every row unchanged", () => {
  const rows = [row(), row({ id: "PLAYER::bob", key: "bob" })];
  assert.deepEqual(filterProfileRows(rows, DEFAULT_PROFILE_TABLE_FILTERS), rows);
});

test("filterProfileRows search matches dimension label, key, or status label case-insensitively", () => {
  const rows = [row({ key: "alice" }), row({ id: "PLAYER::bob", key: "bob" })];
  const result = filterProfileRows(rows, { ...DEFAULT_PROFILE_TABLE_FILTERS, search: "ALICE" });
  assert.deepEqual(result.map((r) => r.key), ["alice"]);
});

test("filterProfileRows filters by dimension", () => {
  const rows = [row({ dimensionCode: "PLAYER" }), row({ id: "LEAGUE::a", dimensionCode: "LEAGUE", key: "a" })];
  const result = filterProfileRows(rows, { ...DEFAULT_PROFILE_TABLE_FILTERS, dimension: "LEAGUE" });
  assert.equal(result.length, 1);
  assert.equal(result[0].dimensionCode, "LEAGUE");
});

test("filterProfileRows filters by status", () => {
  const rows = [row({ status: "STABLE" }), row({ id: "PLAYER::bob", key: "bob", status: "CRITICAL" })];
  const result = filterProfileRows(rows, { ...DEFAULT_PROFILE_TABLE_FILTERS, status: "CRITICAL" });
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "CRITICAL");
});

test("filterProfileRows filters by risk, including the NONE sentinel for null riskCode", () => {
  const rows = [row({ riskCode: "HIGH" }), row({ id: "PLAYER::bob", key: "bob", riskCode: null })];
  const highOnly = filterProfileRows(rows, { ...DEFAULT_PROFILE_TABLE_FILTERS, risk: "HIGH" });
  assert.equal(highOnly.length, 1);
  const noneOnly = filterProfileRows(rows, { ...DEFAULT_PROFILE_TABLE_FILTERS, risk: "NONE" });
  assert.equal(noneOnly.length, 1);
  assert.equal(noneOnly[0].riskCode, null);
});

test("filterProfileRows filters by recommendation, including the NONE sentinel", () => {
  const rows = [row({ recommendationCode: "PROFILE_STABLE" }), row({ id: "PLAYER::bob", key: "bob", recommendationCode: null })];
  const result = filterProfileRows(rows, { ...DEFAULT_PROFILE_TABLE_FILTERS, recommendation: "NONE" });
  assert.equal(result.length, 1);
  assert.equal(result[0].recommendationCode, null);
});

test("filterProfileRows filters by trend, including the NONE sentinel", () => {
  const rows = [row({ trendCode: "DETERIORATION" }), row({ id: "PLAYER::bob", key: "bob", trendCode: null })];
  const result = filterProfileRows(rows, { ...DEFAULT_PROFILE_TABLE_FILTERS, trend: "DETERIORATION" });
  assert.equal(result.length, 1);
});

test("filterProfileRows combines multiple filters (AND semantics)", () => {
  const rows = [
    row({ dimensionCode: "PLAYER", status: "CRITICAL", key: "alice" }),
    row({ id: "PLAYER::bob", dimensionCode: "PLAYER", status: "STABLE", key: "bob" }),
    row({ id: "LEAGUE::a", dimensionCode: "LEAGUE", status: "CRITICAL", key: "a" }),
  ];
  const result = filterProfileRows(rows, { ...DEFAULT_PROFILE_TABLE_FILTERS, dimension: "PLAYER", status: "CRITICAL" });
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "alice");
});

test("filterProfileRows does not mutate the input array", () => {
  const rows = [row()];
  const snapshot = JSON.parse(JSON.stringify(rows));
  filterProfileRows(rows, { ...DEFAULT_PROFILE_TABLE_FILTERS, search: "x" });
  assert.deepEqual(rows, snapshot);
});

test("sortProfileRows by reliability ascending/descending, with nulls always last", () => {
  const rows = [row({ key: "high", reliabilityValue: 90 }), row({ id: "PLAYER::null", key: "none", reliabilityValue: null }), row({ id: "PLAYER::low", key: "low", reliabilityValue: 10 })];
  const asc = sortProfileRows(rows, "reliability", "asc");
  assert.deepEqual(asc.map((r) => r.key), ["low", "high", "none"]);
  const desc = sortProfileRows(rows, "reliability", "desc");
  assert.deepEqual(desc.map((r) => r.key), ["high", "low", "none"]);
});

test("sortProfileRows by risk respects the LOW < MEDIUM < HIGH < CRITICAL ordinal order", () => {
  const rows = [row({ key: "critical", riskCode: "CRITICAL" }), row({ id: "PLAYER::low", key: "low", riskCode: "LOW" }), row({ id: "PLAYER::high", key: "high", riskCode: "HIGH" })];
  const asc = sortProfileRows(rows, "risk", "asc");
  assert.deepEqual(asc.map((r) => r.key), ["low", "high", "critical"]);
});

test("sortProfileRows by driftCount", () => {
  const rows = [row({ key: "many", driftSignalsCount: 5 }), row({ id: "PLAYER::none", key: "none", driftSignalsCount: 0 })];
  const asc = sortProfileRows(rows, "driftCount", "asc");
  assert.deepEqual(asc.map((r) => r.key), ["none", "many"]);
});

test("sortProfileRows by name (locale-aware alphabetical)", () => {
  const rows = [row({ key: "zeta" }), row({ id: "PLAYER::alpha", key: "alpha" })];
  const asc = sortProfileRows(rows, "name", "asc");
  assert.deepEqual(asc.map((r) => r.key), ["alpha", "zeta"]);
});

test("sortProfileRows does not mutate the input array (returns a new array)", () => {
  const rows = [row({ key: "b" }), row({ id: "PLAYER::a", key: "a" })];
  const snapshot = [...rows];
  const sorted = sortProfileRows(rows, "name", "asc");
  assert.deepEqual(rows, snapshot);
  assert.notEqual(sorted, rows);
});

test("filtering and sorting combined operate only on already-received data (no recomputation)", () => {
  const rows = [row({ key: "b", status: "STABLE", reliabilityValue: 50 }), row({ id: "PLAYER::a", key: "a", status: "STABLE", reliabilityValue: 90 })];
  const filtered = filterProfileRows(rows, { ...DEFAULT_PROFILE_TABLE_FILTERS, status: "STABLE" });
  const sorted = sortProfileRows(filtered, "reliability", "desc");
  assert.deepEqual(sorted.map((r) => r.key), ["a", "b"]);
});
