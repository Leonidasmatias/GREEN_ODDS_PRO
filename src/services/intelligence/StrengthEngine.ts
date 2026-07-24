// Fase 1.5 — Intelligence Engine — Módulo 7.
// Strength Engine: combina Rating, Forma, Ataque, Defesa, desempenho
// mandante/visitante e Momentum em três indicadores de 0 a 100: Attack
// Strength, Defense Strength e Overall Strength. Pesos PROVISÓRIOS,
// documentados para recalibração futura.

import type { FormWindowStats } from "./FormEngine.ts";
import type { HomeAwaySplitStats } from "./HomeAwayEngine.ts";
import type { MomentumResult } from "./MomentumEngine.ts";
import { clampScore } from "./types.ts";

const RATING_FLOOR = 1000;
const RATING_CEILING = 2000;
const GOALS_REFERENCE = 3;

export type StrengthInput = {
  rating: number;
  form: FormWindowStats;
  homeAway: HomeAwaySplitStats;
  momentum: MomentumResult;
};

export type StrengthResult = {
  attackStrength: number;
  defenseStrength: number;
  overallStrength: number;
};

/**
 * Pesos PROVISÓRIOS de combinação (Fase 1.5, poderão ser recalibrados):
 *   Attack Strength  = ataque 45% + forma 25% + rating 15% + momentum 15%
 *   Defense Strength = defesa 45% + forma 25% + rating 15% + momentum 15%
 *   Overall Strength = média de Attack Strength, Defense Strength, rating,
 *                       forma, momentum e desempenho mandante/visitante.
 *
 * Cada componente é normalizado para 0..100 antes da combinação:
 *   ratingScore    = (rating - 1000) / (2000 - 1000) * 100
 *   formScore      = pointsPerGame / 3 * 100
 *   attackScore    = avgGoalsFor / 3 * 100
 *   defenseScore   = (1 - avgGoalsAgainst / 3) * 100
 *   homeAwayScore  = winRate (do lado relevante) * 100
 *   momentumScore  = (momentumScore original [-100..100] + 100) / 2
 */
export function calculateStrength(input: StrengthInput): StrengthResult {
  const ratingScore = clampScore(((input.rating - RATING_FLOOR) / (RATING_CEILING - RATING_FLOOR)) * 100);
  const formScore = clampScore((input.form.pointsPerGame / 3) * 100);
  const attackScore = clampScore((input.form.avgGoalsFor / GOALS_REFERENCE) * 100);
  const defenseScore = clampScore((1 - input.form.avgGoalsAgainst / GOALS_REFERENCE) * 100);
  const homeAwayScore = clampScore(input.homeAway.winRate * 100);
  const momentumScore = clampScore((input.momentum.momentumScore + 100) / 2);

  const attackStrength = clampScore(attackScore * 0.45 + formScore * 0.25 + ratingScore * 0.15 + momentumScore * 0.15);
  const defenseStrength = clampScore(
    defenseScore * 0.45 + formScore * 0.25 + ratingScore * 0.15 + momentumScore * 0.15,
  );
  const overallStrength = clampScore(
    (attackStrength + defenseStrength + ratingScore + formScore + momentumScore + homeAwayScore) / 6,
  );

  return {
    attackStrength: Math.round(attackStrength),
    defenseStrength: Math.round(defenseStrength),
    overallStrength: Math.round(overallStrength),
  };
}
