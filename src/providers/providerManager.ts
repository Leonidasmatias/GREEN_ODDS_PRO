import { prisma } from "@/lib/prisma";
import { getProviderUsageBudget, isProviderEconomyMode } from "@/services/providerEconomyService";
import { redactSecrets } from "@/services/securityService";
import { isSchedulerEnabled } from "@/services/schedulerService";
import { parseProviderSyncMetadata } from "@/services/providerSyncMetadata";
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

function oddsPriority() {
  return priority().filter((provider) => provider.id !== "api-football" && provider.id !== "mock");
}

function resultPriority() {
  const prioritized = process.env.FOOTBALL_API_KEY?.trim()
    ? ["api-football", ...priority().map((provider) => provider.id)]
    : priority().map((provider) => provider.id);
  return [...new Set(prioritized)]
    .map((id) => providers[id])
    .filter((provider): provider is OddsProvider => Boolean(provider && provider.id !== "mock"));
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

async function failover<T>(operation: string, call: (provider: OddsProvider) => Promise<ProviderResponse<T>>, accept: (data: T) => boolean, candidates = priority()) {
  const errors: string[] = [];
  for (const provider of candidates) {
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
  return failover<ProviderMatch[]>("getMatches", (provider) => provider.getMatches(), (data) => data.length > 0, oddsPriority());
}

export async function getProviderOdds() {
  return failover<ProviderOdd[]>("getOdds", (provider) => provider.getOdds(), (data) => data.length > 0, oddsPriority());
}

export async function getProviderResults() {
  return failover<ProviderResult[]>("getResults", (provider) => provider.getResults(), () => true, resultPriority());
}

export async function getProviderMarkets() {
  return failover<string[]>("getMarkets", (provider) => provider.getMarkets(), (data) => data.length > 0, oddsPriority());
}

export async function getProviderLiveFeed() {
  const errors: string[] = [];
  for (const provider of oddsPriority()) {
    if (!provider.isConfigured()) {
      errors.push(`${provider.id}: nao configurado`);
      continue;
    }
    try {
      const matches = await monitoredCall(provider, "getMatches", () => provider.getMatches());
      const odds = await monitoredCall(provider, "getOdds", () => provider.getOdds());
      // Sprint 9.2.1 (Fase 5): um provider que respondeu com sucesso
      // (autenticado, sem erro HTTP) mas sem eventos agora NAO e uma
      // falha de provider — e um estado valido (nenhuma liga monitorada
      // tem jogo neste momento). Retorna imediatamente em vez de tentar
      // outro provider, e marca `empty: true` para que o chamador nunca
      // confunda isso com "provider ativo: none".
      return {
        provider,
        matches: matches.data,
        odds: odds.data,
        remainingLimit: odds.remainingLimit ?? matches.remainingLimit,
        failoverErrors: errors,
        empty: matches.data.length === 0 || odds.data.length === 0,
      };
    } catch (error) {
      errors.push(`${provider.id}: ${friendlyProviderError(provider.id, error)}`);
    }
  }
  throw new Error(`Nenhum provedor disponivel para partidas e odds. ${errors.join(" | ")}`);
}

export async function getProviderHealth() {
  const calls = await prisma.providerCall.findMany({ orderBy: { createdAt: "desc" }, take: 500 }).catch(() => []);
  return Object.values(providers).map((provider) => {
    const providerCalls = calls.filter((call) => call.provider === provider.id);
    const last = providerCalls[0];
    const failures = providerCalls.filter((call) => call.status === "FAILED").length;
    const exhausted = providerCalls.some((call) => call.status === "EXHAUSTED");
    const latencies = providerCalls.map((call) => call.latencyMs).filter((value): value is number => typeof value === "number");
    const averageLatencyMs = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null;
    return {
      id: provider.id,
      licensed: provider.licensed,
      configured: provider.isConfigured(),
      status: !provider.isConfigured() ? "NOT_CONFIGURED" : last?.status ?? "READY",
      exhausted,
      latencyMs: last?.latencyMs ?? null,
      averageLatencyMs,
      callsMade: providerCalls.length,
      remainingLimit: providerCalls.find((call) => call.remainingLimit != null)?.remainingLimit ?? null,
      failures,
      lastCall: last?.createdAt.toISOString() ?? null,
      lastError: providerCalls.find((call) => call.error)?.error ?? null,
    };
  });
}

export async function getProvidersStatus() {
  const [health, latestExhausted, budget, latestSyncLog, latestSuccessfulSyncLog, schedulerEnabled] = await Promise.all([
    getProviderHealth(),
    prisma.auditLog.findFirst({ where: { category: "provider_exhausted" }, orderBy: { createdAt: "desc" } }).catch(() => null),
    getProviderUsageBudget("the-odds-api"),
    prisma.auditLog.findFirst({ where: { category: "PROVIDER_SYNC" }, orderBy: { createdAt: "desc" } }).catch(() => null),
    prisma.auditLog.findFirst({ where: { category: "PROVIDER_SYNC", status: "SUCCESS" }, orderBy: { createdAt: "desc" } }).catch(() => null),
    isSchedulerEnabled(),
  ]);
  const configuredProviders = priority().filter((provider) => provider.isConfigured()).map((provider) => provider.id);
  const oddsProviders = oddsPriority().map((provider) => provider.id);
  const resultProviders = resultPriority().map((provider) => provider.id);
  const active = health.find((provider) => provider.configured && provider.status === "SUCCESS") ?? health.find((provider) => provider.configured && provider.status === "READY") ?? null;
  const syncMetadata = parseProviderSyncMetadata(latestSyncLog?.metadata);
  const databaseWrites = syncMetadata?.eventsPersisted != null && syncMetadata?.oddsPersisted != null ? syncMetadata.eventsPersisted + syncMetadata.oddsPersisted : null;

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
    oddsProviders,
    resultProviders,
    resultProvider: resultProviders.find((id) => providers[id]?.isConfigured()) ?? "none",
    providerExhausted: Boolean(latestExhausted),
    providerWarnings: [latestExhausted?.message].filter(Boolean),
    exhaustedWarning: latestExhausted?.message ?? null,
    providers: health,
    // Sprint 9.2.1 (Fase 6) — campos expandidos do pipeline de dados ao vivo.
    sport: syncMetadata?.sport ?? null,
    league: syncMetadata?.league ?? null,
    market: syncMetadata?.market ?? null,
    eventsLoaded: syncMetadata?.eventsFound ?? null,
    oddsLoaded: syncMetadata?.oddsFound ?? null,
    databaseWrites,
    lastSuccessfulSync: latestSuccessfulSyncLog?.createdAt.toISOString() ?? null,
    schedulerStatus: schedulerEnabled ? "ENABLED" : "DISABLED",
    remainingCredits: budget.creditsRemaining,
    lastLatency: active?.latencyMs ?? health.find((provider) => provider.configured)?.latencyMs ?? null,
    checkedAt: new Date().toISOString(),
  };
}

export function getProviderConfiguration() {
  return { priority: priority().map((provider) => provider.id), oddsProviders: oddsPriority().map((provider) => provider.id), resultProviders: resultPriority().map((provider) => provider.id), competitionFilter: process.env.COMPETITION_FILTER?.trim() || "ALL" };
}
