import test from "node:test";
import assert from "node:assert/strict";
import {
  buildObservabilityReport,
  OBSERVABILITY_DISCLAIMERS,
  reportToJson,
  reportToMarkdown,
  reportToObject,
} from "../src/services/observability/ObservabilityReportBuilder.ts";

function minimalInput(overrides = {}) {
  return {
    syncRuns: [],
    dataQualitySnapshot: null,
    classificationMetrics: null,
    duplicateMetrics: null,
    providerMetrics: null,
    rateLimitMetrics: null,
    latencyMetrics: null,
    fixtureComparison: null,
    alerts: [],
    productionReadiness: null,
    retentionDays: 30,
    limitations: [],
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    idGenerator: () => "report-1",
    ...overrides,
  };
}

test("buildObservabilityReport produces all 17 parts (metadata + 16 sections)", () => {
  const report = buildObservabilityReport(minimalInput());
  const expectedKeys = [
    "metadata", "syncRuns", "dataQualitySnapshot", "fieldQuality", "leagueQuality",
    "classificationMetrics", "duplicateMetrics", "providerMetrics", "rateLimitMetrics",
    "latencyMetrics", "fixtureComparison", "alerts", "productionReadiness",
    "inconsistencies", "limitations", "disclaimers",
  ];
  for (const key of expectedKeys) {
    assert.ok(key in report, `expected report to contain "${key}"`);
  }
  assert.equal(report.metadata.reportId, "report-1");
  assert.equal(report.metadata.generatedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(report.metadata.retentionDays, 30);
});

test("the report always carries the full, unabridged set of mandatory disclaimers", () => {
  const report = buildObservabilityReport(minimalInput());
  assert.deepEqual(report.disclaimers, OBSERVABILITY_DISCLAIMERS);
  assert.ok(report.disclaimers.some((d) => d.toLowerCase().includes("kelly")));
  assert.ok(report.disclaimers.some((d) => d.toLowerCase().includes("intelligence engine")));
});

test("fieldQuality/leagueQuality/inconsistencies are pulled straight from the snapshot when present", () => {
  const snapshot = {
    id: "s1", generatedAt: "x", sampleSize: 10, completenessScore: 1, consistencyScore: 1,
    classificationConfidenceScore: 1, duplicateHealthScore: 1, overallScore: 1,
    fieldMetrics: [{ field: "externalId", critical: true, presentCount: 10, totalCount: 10, completenessRatio: 1 }],
    leagueMetrics: [{ league: "Liga X", totalMatches: 10, completenessRatio: 1, confirmedEsoccerRatio: 1 }],
    inconsistencies: ["negative_score:2"],
  };
  const report = buildObservabilityReport(minimalInput({ dataQualitySnapshot: snapshot }));
  assert.deepEqual(report.fieldQuality, snapshot.fieldMetrics);
  assert.deepEqual(report.leagueQuality, snapshot.leagueMetrics);
  assert.deepEqual(report.inconsistencies, ["negative_score:2"]);
});

test("reportToJson redacts an embedded token=... pattern before serializing", () => {
  const alerts = [{ type: "PROVIDER_UNAVAILABLE", severity: "critical", message: "call failed: https://x?token=super-secret-1", triggeredAt: "x", context: {} }];
  const report = buildObservabilityReport(minimalInput({ alerts }));
  const json = reportToJson(report);
  assert.equal(json.includes("super-secret-1"), false);
  assert.ok(JSON.parse(json).metadata.reportId === "report-1");
});

test("reportToMarkdown never contains any HTML tag and includes the disclaimers section", () => {
  const report = buildObservabilityReport(minimalInput());
  const markdown = reportToMarkdown(report);
  assert.equal(/<[a-z][\s\S]*>/i.test(markdown), false);
  assert.ok(markdown.includes("## Avisos Obrigatorios"));
  assert.ok(markdown.includes("Kelly"));
});

test("reportToObject returns a sanitized plain object usable programmatically (not a JSON string)", () => {
  const report = buildObservabilityReport(minimalInput());
  const object = reportToObject(report);
  assert.equal(typeof object, "object");
  assert.equal(object.metadata.reportId, "report-1");
});
