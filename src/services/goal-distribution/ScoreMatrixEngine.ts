// Fase 4 — Sprint 4.2 — Goal Distribution Engine Foundation.
// Score Matrix Engine: constrói a matriz conjunta de placares
// P(Home=h, Away=a) = P(Home=h) * P(Away=a) assumindo independência entre
// os gols do mandante e do visitante (a mesma premissa padrão de modelos
// de Poisson bivariados simples — documentada como limitação em
// `docs/ESOCER_GOAL_DISTRIBUTION_ENGINE_PHASE_4_2.md`), normaliza a soma
// para 1 e extrai/ordena placares exatos. Funções puras: nenhum acesso a
// Prisma, rede, relógio do sistema ou número aleatório.

import { clamp } from "./types.ts";
import type { ExactScoreProbability, PoissonProbability } from "./types.ts";

/**
 * Constrói a matriz `matrix[h][a] = P(Home=h) * P(Away=a)`, normalizada
 * para que a soma de todas as células seja exatamente 1 (dentro da
 * tolerância de ponto flutuante) — a divisão por `total` corrige
 * numericamente qualquer pequeno desvio residual das duas distribuições
 * marginais (cada uma já renormalizada por `buildPoissonDistribution`).
 */
export function buildScoreMatrix(homeDistribution: PoissonProbability[], awayDistribution: PoissonProbability[]): number[][] {
  const matrix: number[][] = [];
  let total = 0;

  for (const homeEntry of homeDistribution) {
    const row: number[] = [];
    for (const awayEntry of awayDistribution) {
      const cell = homeEntry.probability * awayEntry.probability;
      row.push(cell);
      total += cell;
    }
    matrix.push(row);
  }

  if (total <= 0) return matrix.map((row) => row.map(() => 0));

  return matrix.map((row) => row.map((cell) => clamp(cell / total, 0, 1)));
}

/** Achata a matriz em uma lista de placares exatos (sem ordenação). */
export function extractExactScores(matrix: number[][]): ExactScoreProbability[] {
  const scores: ExactScoreProbability[] = [];
  for (let homeGoals = 0; homeGoals < matrix.length; homeGoals += 1) {
    const row = matrix[homeGoals];
    for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
      scores.push({ homeGoals, awayGoals, totalGoals: homeGoals + awayGoals, probability: row[awayGoals] });
    }
  }
  return scores;
}

/**
 * Ordena placares por probabilidade decrescente, com critério de
 * desempate explícito e determinístico (aplicado em ordem, cada nível só
 * decide entre placares empatados no nível anterior): (1) maior
 * probabilidade; (2) menor total de gols; (3) menor quantidade de gols do
 * mandante; (4) menor quantidade de gols do visitante. Devolve os
 * primeiros `topN` (ou todos, se `topN` for maior que a quantidade de
 * placares).
 */
export function rankExactScores(scores: ExactScoreProbability[], topN: number): ExactScoreProbability[] {
  const sorted = [...scores].sort((a, b) => {
    if (b.probability !== a.probability) return b.probability - a.probability;
    if (a.totalGoals !== b.totalGoals) return a.totalGoals - b.totalGoals;
    if (a.homeGoals !== b.homeGoals) return a.homeGoals - b.homeGoals;
    return a.awayGoals - b.awayGoals;
  });
  return sorted.slice(0, Math.max(0, topN));
}
