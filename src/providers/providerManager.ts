import { prisma } from "@/lib/prisma";
import { getProviderUsageBudget, isProviderEconomyMode } from "@/services/providerEconomyService";
import { redactSecrets } from "@/services/securityService";
import { ApiFootballProvider } from "./apiFootball";
import { MockProvider } from "./mockProvider";
import { SportMonksProvider } from "./sportMonks";
import { TheOddsApiProvider } from "./theOddsApi";
import type { OddsProvider, ProviderMatch, ProviderOdd, ProviderResponse, ProviderResult } from "./types";

const providerExhaustedMessage = "Creditos The Odds API esgotados. Utilizando provider alternativo.";

const providers: Record<string, OddsProvider> = {
  "the-odds-api": new TheOddsApiProvider(),
  sportmonks: new SportMonksProvider(),
  "api-football": new ApiFootballProvider(),
  mock: new MockProvider(),
};

function priority() {
  const configured = (process.env.ODDS_PROVIDER_PRIORITY || "the-odds-api,sportmonks,api-football")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return configured.map((id) => providers[id]).filter((provider): provider is OddsProvider => Boolean(provider));
}

function isProviderExhausted(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("PROVIDER_EXHAUSTED") || message.includes("OUT_OF_USAGE_CREDITS");
}

function friendlyProviderError(providerId: string, error: unknown) {
  const message = redactSecrets(error instanceof Error ? error.message : "falha");
  if (providerId === "the-odds-api" && isProviderExhausted(error)) return providerExhaustedMessage;
  return message.replace(/The Odds API HTTP 401/g, "The Odds API indisponivel para a conta atual");
}

async function registerProviderExhausted(provider: OddsProvider, operation: string, message: string) {
  await prisma.auditLog.create({
    data: {
      category: "provider_exhausted",
      status: "WARNING",
      message,
      metadata: JSON.stringify({ provider: provider.id, operation, reason: "OUT_OF_USAGE_CREDITS" }),
    },
  }).catch(() => undefined);
}

async function monitoredCall<T>(provider: OddsProvider, operation: string, call: () => Promise<ProviderResponse<T>>) {
  const started = Date.now();
  try {
    const response = await call();
    await prisma.providerCall.create({
      data: {
        provider: provider.id,
        operation,
        status: "SUCCESS",
        latencyMs: Date.now() - started,
        remainingLimit: response.remainingLimit,
      },
    }).catch(() => undefined);
    return response;
  } catch (error) {
    const exhausted = isProviderExhausted(error);
    const message = friendlyProviderError(provider.id, error);
    await prisma.providerCall.create({
      data: {
        provider: provider.id,
        operation,
        status: exhausted ? "EXHAUSTED" : "FAILED",
        latencyMs: Date.now() - started,
        error: message,
      },
    }).catch(() => undefined);
    if (exhausted) await registerProviderExhausted(provider, operation, message);
    throw error;
  }
}

async function failover<T>(operation: string, call: (provider: OddsProvider) => Promise<ProviderResponse<T>>, accept: (data: T) => boolean) {
  const errors: string[] = [];
  for (const provider of priority()) {
    if (!provider.isConfigured()) {
      errors.push(`${provider.id}: nao configurado`);
      continue;
    }
    try {
      const response = await monitoredCall(provider, operation, () => call(provider));
      if (!accept(response.data)) {
        errors.push(`${provider.id}: resposta vazia`);
        continue;
      }
      return { provider, ...response, failoverErrors: errors };
    } catch (error) {
      errors.push(`${provider.id}: ${friendlyProviderError(provider.id, error)}`);
    }
  }
  throw new Error(`Nenhum provedor disponivel para ${operation}. ${errors.join(" | ")}`);
}

export async function getProviderMatches() {
  return failover<ProviderMatch[]>("getMatches", (provider) => provider.getMatches(), (data) => data.length > 0);
}

export async function getProviderOdds() {
  return failover<ProviderOdd[]>("getOdds", (provider) => provider.getOdds(), (data) => data.length > 0);
}

export async function getProviderResults() {
  return failover<ProviderResult[]>("getResults", (provider) => provider.getResults(), () => true);
}

export async function getProviderMarkets() {
  return failover<string[]>("getMarkets", (provider) => provider.getMarkets(), (data) => data.length > 0);
}

export async function getProviderLiveFeed() {
  const errors: string[] = [];
  for (const provider of priority()) {
    if (!provider.isConfigured()) {
      errors.push(`${provider.id}: nao configurado`);
      continue;
    }
    try {
      const matches = await monitoredCall(provider, "getMatches", () => provider.getMatches());
      const odds = await monitoredCall(provider, "getOdds", () => provider.getOdds());
      if (!matches.data.length || !odds.data.length) {
        errors.push(`${provider.id}: partidas ou odds vazias`);
        continue;
      }
      return {
        provider,
        matches: matches.data,
        odds: odds.data,
        remainingLimit: odds.remainingLimit ?? matches.remainingLimit,
        failoverErrors: errors,
      };
    } catch (error) {
      errors.push(`${provider.id}: ${friendlyProviderError(provider.id, error)}`);
    }
  }
  throw new Error(`Nenhum provedor forneceu partidas e odds. ${errors.join(" | ")}`);
}

export async function getProviderHealth() {
  const calls = await prisma.providerCall.findMany({ orderBy: { createdAt: "desc" }, take: 500 }).catch(() => []);
  return Object.values(providers).map((provider) => {
    const providerCalls = calls.filter((call) => call.provider === provider.id);
    const last = providerCalls[0];
    const failures = providerCalls.filter((call) => call.status === "FAILED").length;
    const exhausted = providerCalls.some((call) => call.status === "EXHAUSTED");
    return {
      id: provider.id,
      licensed: provider.licensed,
      configured: provider.isConfigured(),
      status: !provider.isConfigured() ? "NOT_CONFIGURED" : last?.status ?? "READY",
      exhausted,
      latencyMs: last?.latencyMs ?? null,
      callsMade: providerCalls.length,
      remainingLimit: providerCalls.find((call) => call.remainingLimit != null)?.remainingLimit ?? null,
      failures,
      lastCall: last?.createdAt.toISOString() ?? null,
      lastError: providerCalls.find((call) => call.error)?.error ?? null,
    };
  });
}

export async function getProvidersStatus() {
  const [health, latestExhausted, budget] = await Promise.all([
    getProviderHealth(),
    prisma.auditLog.findFirst({ where: { category: "provider_exhausted" }, orderBy: { createdAt: "desc" } }).catch(() => null),
    getProviderUsageBudget("the-odds-api"),
  ]);
  const configuredProviders = priority().filter((provider) => provider.isConfigured()).map((provider) => provider.id);
  const active = health.find((provider) => provider.configured && provider.status === "SUCCESS") ?? health.find((provider) => provider.configured && provider.status === "READY") ?? null;
  return {
    economyMode: isProviderEconomyMode(),
    callsToday: budget.callsToday,
    callsRemainingToday: budget.callsRemainingToday,
    callsThisHour: budget.callsThisHour,
    hourlyCallsRemaining: budget.hourlyCallsRemaining,
    nextAllowedSyncAt: budget.nextAllowedSyncAt,
    cacheStatus: budget.cacheStatus,
    creditsRemaining: budget.creditsRemaining,
    activeProvider: active?.id ?? "none",
    configuredProviders,
    priority: priority().map((provider) => provider.id),
    providerExhausted: Boolean(latestExhausted),
    providerWarnings: [latestExhausted?.message].filter(Boolean),
    exhaustedWarning: latestExhausted?.message ?? null,
    providers: health,
    checkedAt: new Date().toISOString(),
  };
}

export function getProviderConfiguration() {
  return { priority: priority().map((provider) => provider.id), competitionFilter: process.env.COMPETITION_FILTER?.trim() || "ALL" };
}
