import { prisma } from "@/lib/prisma";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const DAILY_LIMIT = 10;
const HOURLY_LIMIT = 2;

export const providerCacheTtl = {
  odds: 6 * HOUR,
  events: 24 * HOUR,
  sports: 24 * HOUR,
  status: 30 * 60 * 1000,
};

export function isProviderEconomyMode() {
  return process.env.PROVIDER_ECONOMY_MODE?.trim().toLowerCase() === "true";
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfHour(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
}

function nextHour(date = new Date()) {
  return new Date(startOfHour(date).getTime() + HOUR);
}

function tomorrow(date = new Date()) {
  return new Date(startOfDay(date).getTime() + DAY);
}

export async function getProviderUsageBudget(provider = "the-odds-api") {
  const now = new Date();
  const [callsToday, callsThisHour, latestUsage, latestCache] = await Promise.all([
    prisma.providerUsageLog.count({ where: { provider, createdAt: { gte: startOfDay(now) } } }).catch(() => 0),
    prisma.providerUsageLog.count({ where: { provider, createdAt: { gte: startOfHour(now) } } }).catch(() => 0),
    prisma.providerUsageLog.findFirst({ where: { provider, creditsRemaining: { not: null } }, orderBy: { createdAt: "desc" } }).catch(() => null),
    prisma.providerCache.findFirst({ where: { provider }, orderBy: { updatedAt: "desc" } }).catch(() => null),
  ]);
  const dailyReached = callsToday >= DAILY_LIMIT;
  const hourlyReached = callsThisHour >= HOURLY_LIMIT;
  return {
    economyMode: isProviderEconomyMode(),
    callsToday,
    callsThisHour,
    callsRemainingToday: Math.max(0, DAILY_LIMIT - callsToday),
    hourlyCallsRemaining: Math.max(0, HOURLY_LIMIT - callsThisHour),
    nextAllowedSyncAt: dailyReached ? tomorrow(now).toISOString() : hourlyReached ? nextHour(now).toISOString() : now.toISOString(),
    dailyLimitReached: dailyReached,
    hourlyLimitReached: hourlyReached,
    creditsRemaining: latestUsage?.creditsRemaining ?? null,
    cacheStatus: latestCache ? { provider: latestCache.provider, cacheKey: latestCache.cacheKey, expiresAt: latestCache.expiresAt.toISOString(), updatedAt: latestCache.updatedAt.toISOString(), fresh: latestCache.expiresAt > now } : null,
  };
}

export async function assertProviderCallAllowed(provider: string, endpoint: string) {
  if (!isProviderEconomyMode()) return;
  const budget = await getProviderUsageBudget(provider);
  if (budget.dailyLimitReached) throw new Error(`PROVIDER_DAILY_LIMIT_REACHED: ${provider} ${endpoint}`);
  if (budget.hourlyLimitReached) throw new Error(`PROVIDER_HOURLY_LIMIT_REACHED: ${provider} ${endpoint}`);
}

export async function readProviderCache<T>(provider: string, cacheKey: string) {
  if (!isProviderEconomyMode()) return null;
  const row = await prisma.providerCache.findUnique({ where: { provider_cacheKey: { provider, cacheKey } } }).catch(() => null);
  if (!row || row.expiresAt <= new Date()) return null;
  return JSON.parse(row.payload) as T;
}

export async function writeProviderCache(provider: string, cacheKey: string, payload: unknown, ttlMs: number) {
  if (!isProviderEconomyMode()) return;
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.providerCache.upsert({
    where: { provider_cacheKey: { provider, cacheKey } },
    update: { payload: JSON.stringify(payload), expiresAt },
    create: { provider, cacheKey, payload: JSON.stringify(payload), expiresAt },
  }).catch(() => undefined);
}

export function cacheTtlForEndpoint(endpoint: string) {
  if (endpoint.includes("/odds")) return providerCacheTtl.odds;
  if (endpoint.includes("/events") || endpoint.includes("/scores")) return providerCacheTtl.events;
  if (endpoint.endsWith("/sports")) return providerCacheTtl.sports;
  return providerCacheTtl.status;
}

export async function logProviderUsage(input: { provider: string; endpoint: string; status: number; headers: Headers }) {
  const last = Number(input.headers.get("x-requests-last") ?? "");
  const remaining = Number(input.headers.get("x-requests-remaining") ?? "");
  await prisma.providerUsageLog.create({
    data: {
      provider: input.provider,
      endpoint: input.endpoint,
      status: input.status,
      creditsUsed: Number.isFinite(last) && last > 0 ? last : 1,
      creditsRemaining: Number.isFinite(remaining) ? remaining : undefined,
    },
  }).catch(() => undefined);
}

export async function getProviderEconomyAudit() {
  const budget = await getProviderUsageBudget("the-odds-api");
  const cacheRows = await prisma.providerCache.count().catch(() => 0);
  const usageRows = await prisma.providerUsageLog.count().catch(() => 0);
  return {
    ...budget,
    cacheActive: cacheRows >= 0,
    cacheRows,
    dailyLimitActive: true,
    dailyLimit: DAILY_LIMIT,
    hourlyLimit: HOURLY_LIMIT,
    noDashboardProviderFetch: isProviderEconomyMode(),
    noHealthcheckProviderFetch: true,
    noStartupProviderFetch: true,
    mockDisabled: process.env.ALLOW_MOCK_PROVIDER !== "true",
    syntheticData: false,
    usageRows,
    checkedAt: new Date().toISOString(),
  };
}
