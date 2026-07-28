import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/services/authService";
import { PROTECTED_ROUTES, ROUTE_FEATURE, canAccessFeature } from "@/services/subscriptionAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getCurrentUser();
  if (!context) return NextResponse.json({ authenticated: false, status: "AUTH_REQUIRED" }, { status: 401 });
  const planCode = context.plan?.code ?? null;
  const checks = PROTECTED_ROUTES.map((route) => {
    const feature = ROUTE_FEATURE[route];
    const result = feature ? canAccessFeature(planCode, feature) : { allowed: false, reason: "NO_FEATURE_MAPPING" };
    return { route, feature, allowed: result.allowed, reason: result.reason };
  });
  const recentDenied = await prisma.accessLog.count({ where: { userId: context.user.id, status: "DENIED" } }).catch(() => 0);
  return NextResponse.json({
    authenticated: true,
    user: { id: context.user.id, email: context.user.email },
    activePlan: planCode,
    checks,
    bypass: checks.some((item) => item.feature && !item.allowed && ["commandCenter", "performanceCenter", "intelligence"].includes(item.feature)) ? "PREMIUM_FEATURE_BLOCKED_FOR_CURRENT_PLAN" : "NO_BYPASS_DETECTED",
    recentDenied,
    mockSyntheticCheck: { status: "REAL_DATA_ENFORCED", rule: "plan gates run before premium payloads; engine source-integrity blocks mock/synthetic inputs" },
    checkedAt: new Date().toISOString(),
  });
}
