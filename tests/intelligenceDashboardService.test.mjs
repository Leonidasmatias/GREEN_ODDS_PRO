import test from "node:test";
import assert from "node:assert/strict";
import { getIntelligenceDashboardData } from "../src/services/intelligenceDashboardService.ts";
import { OBSERVABILITY_REPORT_FIXTURE } from "../src/data/observabilityReport.fixture.ts";
import { buildIntelligenceDashboardViewModel } from "../src/adapters/observabilityDashboardAdapter.ts";

test("getIntelligenceDashboardData returns a success result sourced from the fixture (no real source exists yet)", async () => {
  const result = await getIntelligenceDashboardData();
  assert.equal(result.status, "success");
  assert.equal(result.source, "fixture");
  assert.ok(result.report);
});

test("getIntelligenceDashboardData never claims source 'real' while no real pipeline exists", async () => {
  const result = await getIntelligenceDashboardData();
  assert.notEqual(result.source, "real");
});

test("the fixture report has essential fields present and non-empty profiles", () => {
  assert.equal(typeof OBSERVABILITY_REPORT_FIXTURE.reportId, "string");
  assert.equal(typeof OBSERVABILITY_REPORT_FIXTURE.modelVersion, "string");
  assert.ok(Array.isArray(OBSERVABILITY_REPORT_FIXTURE.monitoredProfiles));
  assert.ok(OBSERVABILITY_REPORT_FIXTURE.monitoredProfiles.length > 0);
});

test("the fixture report is deterministic across repeated module-level reads (no Date.now()/Math.random())", async () => {
  const first = await getIntelligenceDashboardData();
  const second = await getIntelligenceDashboardData();
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("integration: the fixture report is fully compatible with the observability dashboard adapter", () => {
  const viewModel = buildIntelligenceDashboardViewModel(OBSERVABILITY_REPORT_FIXTURE);
  assert.equal(viewModel.profiles.length, OBSERVABILITY_REPORT_FIXTURE.monitoredProfiles.length);
  assert.ok(viewModel.summaryCards.length === 10);
  assert.doesNotThrow(() => JSON.stringify(viewModel));
});

test("integration: fixture generation never mutates across repeated adapter calls (immutability preserved end-to-end)", () => {
  const snapshot = JSON.parse(JSON.stringify(OBSERVABILITY_REPORT_FIXTURE));
  buildIntelligenceDashboardViewModel(OBSERVABILITY_REPORT_FIXTURE);
  buildIntelligenceDashboardViewModel(OBSERVABILITY_REPORT_FIXTURE);
  assert.deepEqual(OBSERVABILITY_REPORT_FIXTURE, snapshot);
});

test("getIntelligenceDashboardData returns status 'empty' for real when monitoredProfiles is empty", async () => {
  const emptyReport = { ...OBSERVABILITY_REPORT_FIXTURE, monitoredProfiles: [] };
  const result = await getIntelligenceDashboardData(emptyReport);
  assert.equal(result.status, "empty");
  assert.equal(result.source, "fixture");
});

test("getIntelligenceDashboardData returns status 'error' for real when the report is structurally incomplete", async () => {
  const incompleteReport = { reportId: "x" }; // missing monitoredProfiles, alerts, dashboardMetrics, etc.
  const result = await getIntelligenceDashboardData(incompleteReport);
  assert.equal(result.status, "error");
  assert.equal(result.message, "Não foi possível carregar o relatório de observabilidade.");
});

test("getIntelligenceDashboardData returns status 'error' for real when reading the report throws (catch branch)", async () => {
  const poisonedReport = new Proxy({}, { get() { throw new Error("boom"); } });
  const result = await getIntelligenceDashboardData(poisonedReport);
  assert.equal(result.status, "error");
  assert.equal(result.message, "Não foi possível carregar o relatório de observabilidade.");
});
