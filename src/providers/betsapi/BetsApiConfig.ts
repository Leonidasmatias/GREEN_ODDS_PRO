// Fase 3 — BetsAPI Real Integration.
// Carregamento e validacao centralizados da configuracao da integracao
// real com a BetsAPI. Por padrao a integracao fica DESATIVADA: nenhuma
// chamada real ocorre sem configuracao explicita por variavel de
// ambiente (BETSAPI_ENABLED=true e BETSAPI_MODE=live, com
// BETSAPI_TOKEN presente). O token NUNCA e lido de um valor hardcoded no
// codigo nem de um default — somente de variavel de ambiente.

import { BetsApiConfigurationError } from "./BetsApiErrors.ts";

export type BetsApiMode = "fixture" | "sandbox" | "live";

export type BetsApiConfig = {
  enabled: boolean;
  mode: BetsApiMode;
  token: string | null;
  baseUrl: string;
  fallbackBaseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  rateLimitReserve: number;
  sportId: string;
};

export type BetsApiFeatureFlags = {
  persistEnabled: boolean;
  aggregationEnabled: boolean;
  esoccerAllowlist: string[];
  esoccerDenylist: string[];
  maxPagesPerSync: number;
  maxEventsPerSync: number;
};

const DEFAULT_BASE_URL = "https://api.b365api.com";
const DEFAULT_FALLBACK_BASE_URL = "https://api.betsapi.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_RATE_LIMIT_RESERVE = 20;
const DEFAULT_SPORT_ID = "1";
const DEFAULT_MAX_PAGES_PER_SYNC = 3;
const DEFAULT_MAX_EVENTS_PER_SYNC = 200;

const VALID_MODES: BetsApiMode[] = ["fixture", "sandbox", "live"];

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.trim().toLowerCase() === "true";
}

function parsePositiveInt(value: string | undefined, defaultValue: number, field: string): number {
  if (value === undefined || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BetsApiConfigurationError(`Variavel ${field} deve ser um inteiro nao-negativo; valor recebido nao e valido.`);
  }
  return parsed;
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Carrega e valida a BetsApiConfig a partir de variaveis de ambiente.
 * Nunca lanca por ausencia de token quando mode !== "live" — apenas o
 * modo live exige token e enabled=true. Lanca BetsApiConfigurationError
 * de forma estruturada (sem nunca incluir o valor do token na mensagem)
 * para qualquer combinacao invalida.
 */
export function loadBetsApiConfig(env: Record<string, string | undefined> = process.env): BetsApiConfig {
  const modeRaw = (env.BETSAPI_MODE ?? "fixture").trim().toLowerCase();
  if (!VALID_MODES.includes(modeRaw as BetsApiMode)) {
    throw new BetsApiConfigurationError(
      `BETSAPI_MODE invalido: "${modeRaw}". Valores aceitos: ${VALID_MODES.join(", ")}.`,
    );
  }
  const mode = modeRaw as BetsApiMode;
  const enabled = parseBoolean(env.BETSAPI_ENABLED, false);
  const token = env.BETSAPI_TOKEN && env.BETSAPI_TOKEN.trim().length > 0 ? env.BETSAPI_TOKEN : null;

  if (mode === "live") {
    if (!enabled) {
      throw new BetsApiConfigurationError(
        "Modo live exige BETSAPI_ENABLED=true. Integracao real permanece desativada por padrao.",
      );
    }
    if (!token) {
      throw new BetsApiConfigurationError("Modo live exige BETSAPI_TOKEN configurado.");
    }
  }
  if (mode === "sandbox" && !token) {
    throw new BetsApiConfigurationError("Modo sandbox exige BETSAPI_TOKEN configurado para chamadas explicitas de teste.");
  }

  return {
    enabled,
    mode,
    token,
    baseUrl: env.BETSAPI_BASE_URL && env.BETSAPI_BASE_URL.trim().length > 0 ? env.BETSAPI_BASE_URL : DEFAULT_BASE_URL,
    fallbackBaseUrl:
      env.BETSAPI_FALLBACK_BASE_URL && env.BETSAPI_FALLBACK_BASE_URL.trim().length > 0
        ? env.BETSAPI_FALLBACK_BASE_URL
        : DEFAULT_FALLBACK_BASE_URL,
    timeoutMs: parsePositiveInt(env.BETSAPI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, "BETSAPI_TIMEOUT_MS"),
    maxRetries: parsePositiveInt(env.BETSAPI_MAX_RETRIES, DEFAULT_MAX_RETRIES, "BETSAPI_MAX_RETRIES"),
    retryBaseDelayMs: parsePositiveInt(env.BETSAPI_RETRY_BASE_DELAY_MS, DEFAULT_RETRY_BASE_DELAY_MS, "BETSAPI_RETRY_BASE_DELAY_MS"),
    rateLimitReserve: parsePositiveInt(env.BETSAPI_RATE_LIMIT_RESERVE, DEFAULT_RATE_LIMIT_RESERVE, "BETSAPI_RATE_LIMIT_RESERVE"),
    sportId: env.BETSAPI_SPORT_ID && env.BETSAPI_SPORT_ID.trim().length > 0 ? env.BETSAPI_SPORT_ID : DEFAULT_SPORT_ID,
  };
}

/**
 * Carrega os feature flags de sincronizacao (persistencia, aggregation,
 * allow/denylist de ligas eSoccer, limites de paginas/eventos por
 * execucao). Valores padrao sempre seguros: persistencia e aggregation
 * desativadas mesmo em modo live — exigem flag propria.
 */
export function loadBetsApiFeatureFlags(env: Record<string, string | undefined> = process.env): BetsApiFeatureFlags {
  return {
    persistEnabled: parseBoolean(env.BETSAPI_PERSIST_ENABLED, false),
    aggregationEnabled: parseBoolean(env.BETSAPI_AGGREGATION_ENABLED, false),
    esoccerAllowlist: parseList(env.BETSAPI_ESOCCER_ALLOWLIST),
    esoccerDenylist: parseList(env.BETSAPI_ESOCCER_DENYLIST),
    maxPagesPerSync: parsePositiveInt(env.BETSAPI_MAX_PAGES_PER_SYNC, DEFAULT_MAX_PAGES_PER_SYNC, "BETSAPI_MAX_PAGES_PER_SYNC"),
    maxEventsPerSync: parsePositiveInt(env.BETSAPI_MAX_EVENTS_PER_SYNC, DEFAULT_MAX_EVENTS_PER_SYNC, "BETSAPI_MAX_EVENTS_PER_SYNC"),
  };
}
