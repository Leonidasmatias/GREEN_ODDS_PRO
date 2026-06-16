import { prisma } from "@/lib/prisma";
import { ApiFootballProvider } from "./apiFootball";
import { MockProvider } from "./mockProvider";
import { SportMonksProvider } from "./sportMonks";
import { TheOddsApiProvider } from "./theOddsApi";
import type { OddsProvider, ProviderMatch, ProviderOdd, ProviderResponse, ProviderResult } from "./types";
import { redactSecrets } from "@/services/securityService";

const providers: Record<string, OddsProvider> = {
  "the-odds-api": new TheOddsApiProvider(),
  sportmonks: new SportMonksProvider(),
  "api-football": new ApiFootballProvider(),
  mock: new MockProvider(),
};

function priority() {
  const configured = (process.env.ODDS_PROVIDER_PRIORITY || "the-odds-api,sportmonks,api-football").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return configured.map((id) => providers[id]).filter((provider): provider is OddsProvider => Boolean(provider));
}

async function monitoredCall<T>(provider: OddsProvider, operation: string, call: () => Promise<ProviderResponse<T>>) {
  const started = Date.now();
  try {
    const response = await call();
    await prisma.providerCall.create({ data: { provider: provider.id, operation, status: "SUCCESS", latencyMs: Date.now() - started, remainingLimit: response.remainingLimit } }).catch(() => undefined);
    return response;
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : "Falha desconhecida");
    await prisma.providerCall.create({ data: { provider: provider.id, operation, status: "FAILED", latencyMs: Date.now() - started, error: message } }).catch(() => undefined);
    throw error;
  }
}

async function failover<T>(operation: string, call: (provider: OddsProvider) => Promise<ProviderResponse<T>>, accept: (data: T) => boolean) {
  const errors: string[] = [];
  for (const provider of priority()) {
    if (!provider.isConfigured()) { errors.push(`${provider.id}: não configurado`); continue; }
    try {
      const response = await monitoredCall(provider, operation, () => call(provider));
      if (!accept(response.data)) { errors.push(`${provider.id}: resposta vazia`); continue; }
      return { provider, ...response, failoverErrors: errors };
    } catch (error) { errors.push(`${provider.id}: ${redactSecrets(error instanceof Error ? error.message : "falha")}`); }
  }
  throw new Error(`Nenhum provedor disponível para ${operation}. ${errors.join(" | ")}`);
}

export async function getProviderMatches() { return failover<ProviderMatch[]>("getMatches", (provider) => provider.getMatches(), (data) => data.length > 0); }
export async function getProviderOdds() { return failover<ProviderOdd[]>("getOdds", (provider) => provider.getOdds(), (data) => data.length > 0); }
export async function getProviderResults() { return failover<ProviderResult[]>("getResults", (provider) => provider.getResults(), () => true); }
export async function getProviderMarkets() { return failover<string[]>("getMarkets", (provider) => provider.getMarkets(), (data) => data.length > 0); }

export async function getProviderLiveFeed() {
  const errors: string[] = [];
  for (const provider of priority()) {
    if (!provider.isConfigured()) { errors.push(`${provider.id}: não configurado`); continue; }
    try {
      const matches = await monitoredCall(provider, "getMatches", () => provider.getMatches());
      const odds = await monitoredCall(provider, "getOdds", () => provider.getOdds());
      if (!matches.data.length || !odds.data.length) { errors.push(`${provider.id}: partidas ou odds vazias`); continue; }
      return { provider, matches: matches.data, odds: odds.data, remainingLimit: odds.remainingLimit ?? matches.remainingLimit, failoverErrors: errors };
    } catch (error) { errors.push(`${provider.id}: ${redactSecrets(error instanceof Error ? error.message : "falha")}`); }
  }
  throw new Error(`Nenhum provedor forneceu partidas e odds. ${errors.join(" | ")}`);
}

export async function getProviderHealth() {
  const calls = await prisma.providerCall.findMany({ orderBy: { createdAt: "desc" }, take: 500 }).catch(() => []);
  return Object.values(providers).map((provider) => {
    const providerCalls = calls.filter((call) => call.provider === provider.id);
    const last = providerCalls[0];
    const failures = providerCalls.filter((call) => call.status === "FAILED").length;
    return { id: provider.id, licensed: provider.licensed, configured: provider.isConfigured(), status: !provider.isConfigured() ? "NOT_CONFIGURED" : last?.status ?? "READY", latencyMs: last?.latencyMs ?? null, callsMade: providerCalls.length, remainingLimit: providerCalls.find((call) => call.remainingLimit != null)?.remainingLimit ?? null, failures, lastCall: last?.createdAt.toISOString() ?? null, lastError: providerCalls.find((call) => call.error)?.error ?? null };
  });
}

export function getProviderConfiguration() { return { priority: priority().map((provider) => provider.id), competitionFilter: process.env.COMPETITION_FILTER?.trim() || "ALL" }; }
