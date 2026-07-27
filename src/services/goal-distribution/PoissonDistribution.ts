// Fase 4 — Sprint 4.2 — Goal Distribution Engine Foundation.
// Poisson Distribution: massa de probabilidade de Poisson
// (P(X=k) = exp(-lambda) * lambda^k / k!) implementada via recorrência
// numericamente estável, sem biblioteca estatística externa e sem nunca
// calcular `lambda^k` ou `k!` diretamente (o que estouraria para k grande).
// Função pura: nenhum acesso a Prisma, rede, relógio do sistema ou número
// aleatório.

import { clamp, isFiniteNumber } from "./types.ts";
import type { PoissonProbability } from "./types.ts";

/**
 * Sanitiza lambda para o intervalo `[minLambda, maxLambda]`. NaN e
 * ±Infinity são tratados como ausência de sinal e recebem `minLambda`
 * (nunca zero absoluto, nunca propagados) — um fallback conservador
 * explícito, nunca uma falha silenciosa que produziria NaN a jusante.
 */
export function sanitizeLambda(lambda: number, minLambda: number, maxLambda: number): number {
  if (!isFiniteNumber(lambda)) return minLambda;
  return clamp(lambda, minLambda, maxLambda);
}

/**
 * P(X = k) para uma distribuição de Poisson de parâmetro `lambda`,
 * calculada pela recorrência `p(0) = exp(-lambda)`,
 * `p(k) = p(k-1) * lambda / k` — nunca `Math.pow(lambda, k)` nem `k!`
 * diretamente, o que evitaria overflow apenas para `k` muito maior do que
 * qualquer `maxGoalsPerPlayer` realista, mas cuja instabilidade não vale o
 * risco. `lambda` é sanitizado internamente (nunca NaN/Infinity/negativo
 * chega ao cálculo) e `k` negativo ou não inteiro sempre devolve `0`.
 */
export function poissonProbability(lambda: number, k: number, minLambda = 1e-6, maxLambda = 1000): number {
  const safeLambda = sanitizeLambda(lambda, minLambda, maxLambda);
  if (!isFiniteNumber(k) || k < 0 || !Number.isInteger(k)) return 0;

  let probability = Math.exp(-safeLambda);
  for (let i = 1; i <= k; i += 1) {
    probability = (probability * safeLambda) / i;
  }
  // Guarda defensiva: cada termo de uma distribuição de Poisson real é
  // <= 1, então esta recorrência é autolimitada por construção — uma
  // varredura numérica extensa (lambda/k até a casa das centenas, incluindo
  // a fronteira de underflow de exp(-lambda) por volta de lambda~745) não
  // encontrou nenhuma combinação capaz de produzir um `probability` não
  // finito. Mantida mesmo assim como defesa em profundidade exigida pela
  // missão ("sem overflow; sem NaN; sem Infinity"), documentada como
  // provavelmente inalcançável em vez de forçada por um teste artificial.
  return isFiniteNumber(probability) ? clamp(probability, 0, 1) : 0;
}

/**
 * Constrói a distribuição de Poisson truncada para `k = 0..maxGoals`,
 * **renormalizada** para que a massa que exceder `maxGoals` (a "cauda"
 * truncada) seja redistribuída proporcionalmente entre os valores
 * calculados — garantindo soma igual a 1 dentro da tolerância de ponto
 * flutuante, em vez de silenciosamente somar menos que 1. Quando a soma
 * bruta é `0` (lambda sanitizado extremamente pequeno e `maxGoals`
 * pequeno — caso patológico, não esperado com os limites padrão de
 * configuração), devolve toda a massa em `k=0` como fallback seguro em
 * vez de dividir por zero.
 */
export function buildPoissonDistribution(
  lambda: number,
  maxGoals: number,
  minLambda = 1e-6,
  maxLambda = 1000,
): PoissonProbability[] {
  const safeMaxGoals = isFiniteNumber(maxGoals) && Number.isInteger(maxGoals) && maxGoals >= 0 ? maxGoals : 0;
  const raw: number[] = [];
  for (let k = 0; k <= safeMaxGoals; k += 1) {
    raw.push(poissonProbability(lambda, k, minLambda, maxLambda));
  }

  const sum = raw.reduce((total, value) => total + value, 0);
  if (sum <= 0) {
    return raw.map((_, k) => ({ goals: k, probability: k === 0 ? 1 : 0 }));
  }

  return raw.map((value, k) => ({ goals: k, probability: clamp(value / sum, 0, 1) }));
}
