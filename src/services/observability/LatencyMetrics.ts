// Fase 3.5 - Observabilidade e Validacao em Producao.
// LatencyMetrics: calcula p50/p95/p99 e media sobre uma serie de
// latencias (ms), sem nenhuma biblioteca externa - metodo "nearest rank"
// sobre a lista ordenada, deterministico e facil de auditar.

import type { LatencyPercentiles } from "./types.ts";

function nearestRankPercentile(sortedAscending: number[], percentileValue: number): number {
  const rank = Math.ceil((percentileValue / 100) * sortedAscending.length);
  const index = Math.min(sortedAscending.length, Math.max(1, rank)) - 1;
  return sortedAscending[index];
}

/** Ignora amostras invalidas (NaN/negativas). Retorna tudo null quando a amostra fica vazia apos o filtro. */
export function computeLatencyPercentiles(samplesMs: number[]): LatencyPercentiles {
  const valid = samplesMs.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);

  if (valid.length === 0) {
    return { count: 0, p50: null, p95: null, p99: null, averageMs: null };
  }

  const sum = valid.reduce((acc, value) => acc + value, 0);

  return {
    count: valid.length,
    p50: nearestRankPercentile(valid, 50),
    p95: nearestRankPercentile(valid, 95),
    p99: nearestRankPercentile(valid, 99),
    averageMs: sum / valid.length,
  };
}
