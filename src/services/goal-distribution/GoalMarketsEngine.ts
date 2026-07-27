// Fase 4 — Sprint 4.2 — Goal Distribution Engine Foundation.
// Goal Markets Engine: deriva Over/Under, BTTS e as probabilidades 1X2
// implícitas na matriz de placares (`scoreDerivedOutcomeProbabilities`).
// Cada par complementar (Over/Under; BTTS Yes/No) é computado somando as
// células relevantes de UM lado e definindo o outro como o complemento
// algébrico exato (`1 - lado`) — não duas somas independentes — o que
// garante `ladoA + ladoB === 1` dentro de `Number.EPSILON` por construção,
// já que a matriz de entrada está normalizada para somar 1 (ver
// `ScoreMatrixEngine.ts`). Funções puras: nenhum acesso a Prisma, rede,
// relógio do sistema ou número aleatório.
//
// Nota de reuso: `PredictionNormalizer.computeOutcomeProbabilities`
// (Sprint 4.1) não é reaproveitado aqui — aquela função aplica softmax a
// LOGITS, o que distorceria probabilidades já bem-formadas se usada como
// um normalizador genérico. `scoreDerivedOutcomeProbabilities` precisa
// apenas de uma correção de soma exata sobre valores já em [0,1], por isso
// usa a mesma técnica de "atribuir o menor valor como complemento exato
// dos outros dois", reimplementada localmente para esse propósito distinto.

import { clamp } from "./types.ts";
import type { BothTeamsToScoreProbability, GoalLineProbability, ScoreDerivedOutcomeProbabilities } from "./types.ts";

/**
 * Soma das células da matriz cujo total de gols é `<= Math.floor(line)`
 * (definição de "Under" para uma linha x.5, ex.: Under 2.5 = 0, 1 ou 2
 * gols). `over` é definido como o complemento algébrico exato
 * (`1 - under`), nunca uma segunda soma independente.
 */
export function computeGoalLineProbability(matrix: number[][], line: number): GoalLineProbability {
  const threshold = Math.floor(line);
  let under = 0;
  for (let homeGoals = 0; homeGoals < matrix.length; homeGoals += 1) {
    const row = matrix[homeGoals];
    for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
      if (homeGoals + awayGoals <= threshold) under += row[awayGoals];
    }
  }
  under = clamp(under, 0, 1);
  const over = clamp(1 - under, 0, 1);
  return { line, over, under };
}

/** Calcula Over/Under para cada linha configurada, em ordem. */
export function computeOverUnder(matrix: number[][], lines: number[]): GoalLineProbability[] {
  return lines.map((line) => computeGoalLineProbability(matrix, line));
}

/**
 * BTTS Yes = P(homeGoals > 0 && awayGoals > 0); BTTS No é o complemento
 * algébrico exato.
 */
export function computeBothTeamsToScore(matrix: number[][]): BothTeamsToScoreProbability {
  let yes = 0;
  for (let homeGoals = 1; homeGoals < matrix.length; homeGoals += 1) {
    const row = matrix[homeGoals];
    for (let awayGoals = 1; awayGoals < row.length; awayGoals += 1) {
      yes += row[awayGoals];
    }
  }
  yes = clamp(yes, 0, 1);
  const no = clamp(1 - yes, 0, 1);
  return { yes, no };
}

/**
 * Probabilidades 1X2 implícitas na matriz de placares (soma das células
 * onde home>away, home===away, home<away). Os três valores são corrigidos
 * para somar exatamente 1: os dois maiores são mantidos como calculados, e
 * o menor é redefinido como o complemento exato dos outros dois — a mesma
 * técnica de correção de soma usada por `PredictionNormalizer` (Sprint
 * 4.1), aqui aplicada a probabilidades já somadas, não a logits.
 * **Nunca combinada com o resultado do Prediction Engine** — apenas
 * derivada desta matriz, para comparação e validação cruzada futura.
 */
export function computeScoreDerivedOutcomeProbabilities(matrix: number[][]): ScoreDerivedOutcomeProbabilities {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  for (let homeGoals = 0; homeGoals < matrix.length; homeGoals += 1) {
    const row = matrix[homeGoals];
    for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
      const cell = row[awayGoals];
      if (homeGoals > awayGoals) homeWin += cell;
      else if (homeGoals === awayGoals) draw += cell;
      else awayWin += cell;
    }
  }

  const entries: [keyof ScoreDerivedOutcomeProbabilities, number][] = [
    ["homeWin", homeWin],
    ["draw", draw],
    ["awayWin", awayWin],
  ];
  entries.sort((a, b) => a[1] - b[1]);

  const result: ScoreDerivedOutcomeProbabilities = { homeWin, draw, awayWin };
  const [smallestKey] = entries[0];
  const remainderOfOthers = entries[1][1] + entries[2][1];
  result[smallestKey] = 1 - remainderOfOthers;

  result.homeWin = clamp(result.homeWin, 0, 1);
  result.draw = clamp(result.draw, 0, 1);
  result.awayWin = clamp(result.awayWin, 0, 1);

  return result;
}
