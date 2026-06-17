import test from "node:test";
import assert from "node:assert/strict";

function sourceIntegrityStatus({ sourceIntegrity, provider }) {
  if (sourceIntegrity?.status === "REAL_ONLY" && provider && provider !== "none" && !provider.toLowerCase().startsWith("mock")) return "REAL_ONLY";
  return "BLOCKED";
}

function centerStatus(kpis) {
  if (kpis.some((kpi) => kpi.status === "BLOCKED")) return "BLOCKED";
  if (kpis.some((kpi) => kpi.status === "READY")) return "READY";
  return "INSUFFICIENT_REAL_DATA";
}

test("executive source integrity blocks mock and none providers", () => {
  assert.equal(sourceIntegrityStatus({ sourceIntegrity: { status: "REAL_ONLY" }, provider: "api-football" }), "REAL_ONLY");
  assert.equal(sourceIntegrityStatus({ sourceIntegrity: { status: "REAL_ONLY" }, provider: "mock-provider" }), "BLOCKED");
  assert.equal(sourceIntegrityStatus({ sourceIntegrity: { status: "REAL_ONLY" }, provider: "none" }), "BLOCKED");
  assert.equal(sourceIntegrityStatus({ sourceIntegrity: { status: "BLOCKED" }, provider: "api-football" }), "BLOCKED");
});

test("executive center status is safe with empty or insufficient data", () => {
  assert.equal(centerStatus([]), "INSUFFICIENT_REAL_DATA");
  assert.equal(centerStatus([{ status: "INSUFFICIENT_REAL_DATA" }]), "INSUFFICIENT_REAL_DATA");
  assert.equal(centerStatus([{ status: "READY" }, { status: "INSUFFICIENT_REAL_DATA" }]), "READY");
  assert.equal(centerStatus([{ status: "READY" }, { status: "BLOCKED" }]), "BLOCKED");
});
