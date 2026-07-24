// Fase 3.5 - Observabilidade e Validacao em Producao.
// RateLimitMetrics: agrega uma serie de BetsApiRateLimitState (Fase 3,
// sempre derivados de headers reais da BetsAPI - nunca de um limite
// hardcoded) observados ao longo do tempo, para detectar quao perto do
// limite a integracao real esta operando.

import type { BetsApiRateLimitState } from "../../providers/betsapi/BetsApiResponse.ts";

export type RateLimitMetricsResult = {
  observationCount: number;
  minRemainingObserved: number | null;
  blockedCount: number;
  reserveReachedCount: number;
  lastObservedAt: string | null;
};

export function analyzeRateLimitMetrics(observations: BetsApiRateLimitState[]): RateLimitMetricsResult {
  if (observations.length === 0) {
    return {
      observationCount: 0,
      minRemainingObserved: null,
      blockedCount: 0,
      reserveReachedCount: 0,
      lastObservedAt: null,
    };
  }

  const remainings = observations.map((observation) => observation.remaining).filter((value): value is number => value !== null);
  const sortedByTime = [...observations].sort((a, b) => a.observedAt.localeCompare(b.observedAt));

  return {
    observationCount: observations.length,
    minRemainingObserved: remainings.length > 0 ? Math.min(...remainings) : null,
    blockedCount: observations.filter((observation) => observation.blocked).length,
    reserveReachedCount: observations.filter((observation) => observation.reserveReached).length,
    lastObservedAt: sortedByTime[sortedByTime.length - 1]?.observedAt ?? null,
  };
}
