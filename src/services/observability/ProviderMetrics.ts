// Fase 3.5 - Observabilidade e Validacao em Producao.
// ProviderMetrics: agrega, por provider, uma janela de SyncRun (Fase 3.5,
// via SyncRunTracker) combinada com o ultimo BetsApiHostMetrics (Fase 3)
// observado logo apos cada execucao, em um unico ProviderOperationalMetric.
// Tambem computa o ProviderReliabilityScore (0..100) usado pelo
// DataQualityEngine, a partir do mesmo ProviderOperationalMetric.
//
// LIMITACAO DOCUMENTADA (ver docs/OBSERVABILITY_AND_PRODUCTION_VALIDATION.md):
// o BetsApiClient da Fase 3 nao expoe contadores internos de tentativas
// de retry nem de uso do host de fallback (apenas o ultimo estado por
// host), nem categoriza falhas por causa (timeout vs. indisponibilidade) -
// ambas surgem apenas como um SyncRun.status="failed" com uma mensagem de
// erro sanitizada. Por isso retryCount/fallbackCount permanecem 0 nesta
// fase - nenhum numero e inventado, e o efeito de timeouts/indisponibilidade
// e refletido apenas indiretamente via failedRequests. Uma fase futura
// poderia estender BetsApiHostMetrics (por composicao) para expor esses
// contadores/causas reais.

import type { BetsApiHostMetrics } from "../../providers/betsapi/BetsApiClient.ts";
import type { ProviderOperationalMetric, SyncRun } from "./types.ts";

export type ProviderMetricWindowInput = {
  syncRun: SyncRun;
  hostMetrics: BetsApiHostMetrics | null;
};

export function analyzeProviderMetrics(provider: string, windows: ProviderMetricWindowInput[]): ProviderOperationalMetric {
  if (windows.length === 0) {
    const now = new Date().toISOString();
    return {
      provider,
      windowStart: now,
      windowEnd: now,
      totalRequests: 0,
      successfulRequests: 0,
      partialRequests: 0,
      failedRequests: 0,
      retryCount: 0,
      fallbackCount: 0,
      rateLimitHits: 0,
      lastError: null,
    };
  }

  const totalRequests = windows.length;
  const successfulRequests = windows.filter((window) => window.syncRun.status === "success").length;
  const partialRequests = windows.filter((window) => window.syncRun.status === "partial").length;
  const failedRequests = windows.filter((window) => window.syncRun.status === "failed").length;
  const rateLimitHits = windows.filter(
    (window) => window.syncRun.rateLimitRemaining !== null && window.syncRun.rateLimitRemaining <= 0,
  ).length;

  const sortedByStart = [...windows].sort((a, b) => a.syncRun.startedAt.localeCompare(b.syncRun.startedAt));
  const lastWithError = [...sortedByStart]
    .reverse()
    .find((window) => (window.hostMetrics?.lastError ?? null) !== null || window.syncRun.errors.length > 0);
  const lastError = lastWithError?.hostMetrics?.lastError ?? lastWithError?.syncRun.errors[0] ?? null;

  return {
    provider,
    windowStart: sortedByStart[0].syncRun.startedAt,
    windowEnd: sortedByStart[sortedByStart.length - 1].syncRun.finishedAt ?? sortedByStart[sortedByStart.length - 1].syncRun.startedAt,
    totalRequests,
    successfulRequests,
    partialRequests,
    failedRequests,
    retryCount: 0,
    fallbackCount: 0,
    rateLimitHits,
    lastError,
  };
}

/**
 * Score neutro (nem confiavel, nem nao-confiavel) usado exclusivamente
 * quando nao ha dados operacionais suficientes (totalRequests === 0).
 * PROVISORIO - a escolha explicita de 50 (em vez de 100) e deliberada:
 * a ausencia de dados NUNCA deve ser lida como confiabilidade maxima.
 */
export const PROVIDER_RELIABILITY_NEUTRAL_SCORE = 50;

/** Peso (0..1) de uma janela "partial" dentro da taxa de sucesso efetiva - conta como "meio sucesso". PROVISORIO. */
const PARTIAL_SUCCESS_WEIGHT = 0.5;
/** Penalidades (0..1) aplicadas sobre a taxa de rate-limit/retry/fallback observada. PROVISORIAS. */
const RATE_LIMIT_PENALTY_WEIGHT = 0.2;
const RETRY_PENALTY_WEIGHT = 0.1;
const FALLBACK_PENALTY_WEIGHT = 0.1;

/**
 * Computa o ProviderReliabilityScore (0..100) a partir de um
 * ProviderOperationalMetric ja calculado. Considera taxa de sucesso,
 * falhas parciais (peso reduzido) e totais (via successRate/partialRate
 * complementares), eventos de rate-limit, retries e uso de fallback -
 * nunca inventa uma metrica que o modelo de dados nao contem (retryCount/
 * fallbackCount continuam 0 nesta fase, ver limitacao acima). Quando nao
 * ha dados suficientes (metric nulo ou totalRequests === 0), devolve
 * PROVIDER_RELIABILITY_NEUTRAL_SCORE (50) explicitamente - nunca assume
 * confiabilidade maxima por falta de evidencia.
 */
export function computeProviderReliabilityScore(metric: ProviderOperationalMetric | null): number {
  if (!metric || metric.totalRequests === 0) return PROVIDER_RELIABILITY_NEUTRAL_SCORE;

  const effectiveSuccessRate =
    (metric.successfulRequests + metric.partialRequests * PARTIAL_SUCCESS_WEIGHT) / metric.totalRequests;
  const rateLimitRate = metric.rateLimitHits / metric.totalRequests;
  const retryRate = metric.retryCount / metric.totalRequests;
  const fallbackRate = metric.fallbackCount / metric.totalRequests;

  const raw =
    effectiveSuccessRate * 100 -
    rateLimitRate * 100 * RATE_LIMIT_PENALTY_WEIGHT -
    retryRate * 100 * RETRY_PENALTY_WEIGHT -
    fallbackRate * 100 * FALLBACK_PENALTY_WEIGHT;

  return Math.max(0, Math.min(100, raw));
}
