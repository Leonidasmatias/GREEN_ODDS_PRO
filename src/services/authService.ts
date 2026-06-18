import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { assignFreePlan, canAccessFeature, getActiveSubscription, ROUTE_FEATURE, type FeatureKey } from "./subscriptionAccess";

export const SESSION_COOKIE = "gop_session";
const SESSION_DAYS = 30;

function authSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_URL || "development-only-auth-secret";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${key}`;
}

export function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored?.startsWith("scrypt:")) return false;
  const [, salt, key] = stored.split(":");
  const candidate = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const expected = Buffer.from(key, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function sessionDigest(token: string) {
  return createHash("sha256").update(`${token}:${authSecret()}`).digest("hex");
}

async function cookieStore() {
  return cookies();
}

async function requestHeaders() {
  return headers();
}

export async function setSessionCookie(sessionToken: string, expires: Date) {
  const store = await cookieStore();
  store.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function clearSessionCookie() {
  const store = await cookieStore();
  store.delete(SESSION_COOKIE);
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const h = await requestHeaders();
  await prisma.session.create({
    data: {
      sessionToken: sessionDigest(rawToken),
      userId,
      expires,
      userAgent: h.get("user-agent") ?? undefined,
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    },
  });
  await setSessionCookie(rawToken, expires);
  return rawToken;
}

export async function getSessionTokenFromCookie() {
  const store = await cookieStore();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser() {
  const rawToken = await getSessionTokenFromCookie();
  if (!rawToken) return null;
  const session = await prisma.session.findUnique({
    where: { sessionToken: sessionDigest(rawToken) },
    include: { user: true },
  }).catch(() => null);
  if (!session || session.expires <= new Date() || session.user.status !== "ACTIVE") return null;
  const subscription = await getActiveSubscription(session.userId);
  return { user: session.user, session, subscription, plan: subscription?.plan ?? null };
}

export async function registerUser(input: { name?: string; email: string; password: string }) {
  await import("./subscriptionAccess").then((module) => module.ensureSubscriptionPlans());
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw new Error("EMAIL_INVALID");
  if (input.password.length < 8) throw new Error("PASSWORD_TOO_SHORT");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("EMAIL_ALREADY_REGISTERED");
  const user = await prisma.user.create({ data: { name: input.name?.trim() || undefined, email, passwordHash: hashPassword(input.password) } });
  await assignFreePlan(user.id);
  await createSession(user.id);
  await logAccess({ userId: user.id, route: "/register", action: "REGISTER", status: "ALLOWED", planCode: "FREE" });
  return user;
}

export async function loginUser(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await logAccess({ route: "/login", action: "LOGIN", status: "DENIED", reason: "USER_NOT_FOUND" });
    throw new Error("USER_NOT_FOUND");
  }
  if (user.status !== "ACTIVE") {
    await logAccess({ userId: user.id, route: "/login", action: "LOGIN", status: "DENIED", reason: "ACCOUNT_INACTIVE" });
    throw new Error("ACCOUNT_INACTIVE");
  }
  if (!verifyPassword(input.password, user.passwordHash)) {
    await logAccess({ userId: user.id, route: "/login", action: "LOGIN", status: "DENIED", reason: "INVALID_CREDENTIALS" });
    throw new Error("INVALID_CREDENTIALS");
  }
  await createSession(user.id);
  const subscription = await getActiveSubscription(user.id);
  await logAccess({ userId: user.id, route: "/login", action: "LOGIN", status: "ALLOWED", planCode: subscription?.plan.code });
  return user;
}

export async function logoutUser() {
  const rawToken = await getSessionTokenFromCookie();
  if (rawToken) await prisma.session.deleteMany({ where: { sessionToken: sessionDigest(rawToken) } }).catch(() => undefined);
  await clearSessionCookie();
}

export async function logAccess(input: { userId?: string | null; route: string; action: string; status: string; planCode?: string | null; reason?: string | null }) {
  const h = await requestHeaders().catch(() => null);
  await prisma.accessLog.create({
    data: {
      userId: input.userId ?? undefined,
      route: input.route,
      action: input.action,
      status: input.status,
      planCode: input.planCode ?? undefined,
      reason: input.reason ?? undefined,
      ipAddress: h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      userAgent: h?.get("user-agent") ?? undefined,
    },
  }).catch(() => undefined);
}

export async function requireAuth() {
  const context = await getCurrentUser();
  if (!context) redirect("/login");
  if (!context.plan) redirect("/pricing");
  return context;
}

export async function requireFeature(feature: FeatureKey, route: string) {
  const context = await requireAuth();
  const planCode = context.plan?.code;
  const access = canAccessFeature(planCode, feature);
  await logAccess({ userId: context.user.id, route, action: "PAGE_ACCESS", status: access.allowed ? "ALLOWED" : "DENIED", planCode, reason: access.reason });
  if (!access.allowed) redirect(`/pricing?required=${feature}`);
  return context;
}

export async function requireRouteAccess(route: string) {
  const feature = ROUTE_FEATURE[route];
  return feature ? requireFeature(feature, route) : requireAuth();
}

export async function getApiAccess(feature: FeatureKey, route: string) {
  const context = await getCurrentUser();
  if (!context) return { allowed: false, status: 401, reason: "AUTH_REQUIRED" as const, context: null };
  if (!context.plan) return { allowed: false, status: 402, reason: "NO_ACTIVE_PLAN" as const, context };
  const access = canAccessFeature(context.plan.code, feature);
  await logAccess({ userId: context.user.id, route, action: "API_ACCESS", status: access.allowed ? "ALLOWED" : "DENIED", planCode: context.plan.code, reason: access.reason });
  return { allowed: access.allowed, status: access.allowed ? 200 : 403, reason: access.reason, context };
}
