import { prisma } from "@/lib/prisma";

export type PlanCode = "FREE" | "PRO" | "PREMIUM";
export type FeatureKey = "dashboard" | "radarGreen" | "oddsDoDia" | "greenAiReport" | "commandCenter" | "performanceCenter" | "alerts";

export const PLAN_DEFINITIONS = {
  FREE: {
    code: "FREE" as PlanCode,
    name: "Free",
    description: "Acesso inicial limitado.",
    maxPicksPerDay: 2,
    greenAiReportLevel: "NONE",
    commandCenterLevel: "NONE",
    radarAccess: true,
    oddsAccess: true,
    alertsAccess: false,
  },
  PRO: {
    code: "PRO" as PlanCode,
    name: "Pro",
    description: "Radar Green completo, Odds do Dia e Green AI Report basico.",
    maxPicksPerDay: 20,
    greenAiReportLevel: "BASIC",
    commandCenterLevel: "NONE",
    radarAccess: true,
    oddsAccess: true,
    alertsAccess: false,
  },
  PREMIUM: {
    code: "PREMIUM" as PlanCode,
    name: "Premium",
    description: "Acesso completo ao Green Odds Pro.",
    maxPicksPerDay: null,
    greenAiReportLevel: "FULL",
    commandCenterLevel: "FULL",
    radarAccess: true,
    oddsAccess: true,
    alertsAccess: true,
  },
};

export const PUBLIC_ROUTES = ["/", "/login", "/register", "/pricing", "/terms", "/privacy", "/risk-disclaimer"];
export const PROTECTED_ROUTES = ["/dashboard", "/radar-green", "/odds-do-dia", "/green-ai-report", "/command-center", "/performance-center"];

export const ROUTE_FEATURE: Record<string, FeatureKey> = {
  "/dashboard": "dashboard",
  "/radar-green": "radarGreen",
  "/odds-do-dia": "oddsDoDia",
  "/green-ai-report": "greenAiReport",
  "/command-center": "commandCenter",
  "/performance-center": "performanceCenter",
};

export async function ensureSubscriptionPlans() {
  for (const plan of Object.values(PLAN_DEFINITIONS)) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: { ...plan, active: true },
      create: { ...plan, active: true },
    });
  }
}

export function canAccessFeature(planCode: string | null | undefined, feature: FeatureKey) {
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

export function pickLimitForPlan(planCode: string | null | undefined) {
  if (planCode === "FREE") return 2;
  if (planCode === "PRO") return 20;
  if (planCode === "PREMIUM") return null;
  return 0;
}

export function limitItemsByPlan<T>(items: T[], planCode: string | null | undefined) {
  const limit = pickLimitForPlan(planCode);
  return limit == null ? items : items.slice(0, limit);
}

export async function getActiveSubscription(userId: string) {
  const now = new Date();
  return prisma.userSubscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      plan: { active: true },
    },
    include: { plan: true },
    orderBy: { startsAt: "desc" },
  });
}

export async function assignFreePlan(userId: string) {
  await ensureSubscriptionPlans();
  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: "FREE" } });
  if (!plan) throw new Error("FREE_PLAN_NOT_AVAILABLE");
  return prisma.userSubscription.create({ data: { userId, planId: plan.id, status: "ACTIVE", source: "REGISTRATION" } });
}
