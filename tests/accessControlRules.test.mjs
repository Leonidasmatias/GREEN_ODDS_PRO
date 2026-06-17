import test from "node:test";
import assert from "node:assert/strict";

function canAccessFeature(planCode, feature) {
  if (!planCode) return { allowed: false, reason: "NO_ACTIVE_PLAN" };
  if (feature === "dashboard") return { allowed: true, reason: "PLAN_ALLOWED" };
  if (planCode === "PREMIUM") return { allowed: true, reason: "PLAN_ALLOWED" };
  if (planCode === "PRO") {
    const allowed = ["radarGreen", "oddsDoDia", "greenAiReport"].includes(feature);
    return { allowed, reason: allowed ? "PLAN_ALLOWED" : "PREMIUM_REQUIRED" };
  }
  if (planCode === "FREE") {
    const allowed = ["radarGreen", "oddsDoDia"].includes(feature);
    return { allowed, reason: allowed ? "PLAN_ALLOWED_LIMITED" : "UPGRADE_REQUIRED" };
  }
  return { allowed: false, reason: "UNKNOWN_PLAN" };
}

function pickLimitForPlan(planCode) {
  if (planCode === "FREE") return 2;
  if (planCode === "PRO") return 20;
  if (planCode === "PREMIUM") return null;
  return 0;
}

test("plan gates block premium resources", () => {
  assert.equal(canAccessFeature("FREE", "commandCenter").allowed, false);
  assert.equal(canAccessFeature("PRO", "commandCenter").allowed, false);
  assert.equal(canAccessFeature("PREMIUM", "commandCenter").allowed, true);
  assert.equal(canAccessFeature("FREE", "greenAiReport").allowed, false);
  assert.equal(canAccessFeature("PRO", "greenAiReport").allowed, true);
});

test("pick limits match commercial rules", () => {
  assert.equal(pickLimitForPlan("FREE"), 2);
  assert.equal(pickLimitForPlan("PRO"), 20);
  assert.equal(pickLimitForPlan("PREMIUM"), null);
  assert.equal(pickLimitForPlan(null), 0);
});
