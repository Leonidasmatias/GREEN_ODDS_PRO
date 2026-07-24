// Fase 1.5 — Intelligence Engine — Módulo 9.
// Green Score Engine: o principal indicador interno desta fase. Combina
// Overall Strength (rating+forma+ataque+defesa+mandante/visitante),
// Momentum, H2H, taxas de gols (BTTS/Over 2.5) e Confidence em um único
// score de 0 a 100, com classificação provisória em quatro faixas.

import type { StrengthResult } from "./StrengthEngine.ts";
import type { MomentumResult } from "./MomentumEngine.ts";
import type { GoalsRates } from "./GoalsEngine.ts";
import type { HeadToHeadResult } from "./HeadToHeadEngine.ts";
import type { ConfidenceResult } from "./ConfidenceEngine.ts";
import { clampScore } from "./types.ts";

/**
 * Limites de classificação PROVISÓRIOS, centralizados em constantes para
 * facilitar recalibração futura:
 *   0–39   Fraco
 *   40–59  Regular
 *   60–79  Bom
 *   80–100 Excelente
 */
export const GREEN_SCORE_THRESHOLDS = {
  FRACO_MAX: 39,
  REGULAR_MAX: 59,
  BOM_MAX: 79,
} as const;

export type GreenScoreClassification = "FRACO" | "REGULAR" | "BOM" | "EXCELENTE";

export function classifyGreenScore(score: number): GreenScoreClassification {
  if (score <= GREEN_SCORE_THRESHOLDS.FRACO_MAX) return "FRACO";
  if (score <= GREEN_SCORE_THRESHOLDS.REGULAR_MAX) return "REGULAR";
  if (score <= GREEN_SCORE_THRESHOLDS.BOM_MAX) return "BOM";
  return "EXCELENTE";
}

export type GreenScoreInput = {
  strength: StrengthResult;
  momentum: MomentumResult;
  headToHead: HeadToHeadResult | null;
  goalsRates: GoalsRates;
  confidence: ConfidenceResult;
};

export type GreenScoreResult = {
  greenScore: number;
  classification: GreenScoreClassification;
};

const BASE_WEIGHTS = { strength: 0.35, momentum: 0.15, h2h: 0.1, goals: 0.15, confidence: 0.25 } as const;

/**
 * Pesos PROVISÓRIOS de combinação (Fase 1.5, centralizados para
 * recalibração futura após backtests reais):
 *   overallStrength                                   — 35%
 *   momentum (normalizado de -100..100 para 0..100)    — 15%
 *   H2H win rate do jogador avaliado (quando disponível) — 10%
 *   média de BTTS e Over 2.5                           — 15%
 *   confidenceScore                                    — 25%
 * Quando não há H2H disponível (matchesCount === 0), o peso do H2H (10%) é
 * redistribuído proporcionalmente entre os demais componentes, para que a
 * soma dos pesos continue 100% mesmo sem histórico de confronto direto.
 */
export function calculateGreenScore(input: GreenScoreInput): GreenScoreResult {
  const momentumNormalized = clampScore((input.momentum.momentumScore + 100) / 2);
  const goalsComponent = clampScore(((input.goalsRates.bothTeamsScored + input.goalsRates.over25) / 2) * 100);
  const hasH2H = Boolean(input.headToHead && input.headToHead.matchesCount > 0);
  const h2hComponent = hasH2H ? clampScore((input.headToHead!.playerAWins / input.headToHead!.matchesCount) * 100) : 0;

  let weights: { strength: number; momentum: number; h2h: number; goals: number; confidence: number } = {
    ...BASE_WEIGHTS,
  };

  if (!hasH2H) {
    const redistributed = BASE_WEIGHTS.h2h;
    const othersTotal = BASE_WEIGHTS.strength + BASE_WEIGHTS.momentum + BASE_WEIGHTS.goals + BASE_WEIGHTS.confidence;
    weights = {
      strength: BASE_WEIGHTS.strength + (redistributed * BASE_WEIGHTS.strength) / othersTotal,
      momentum: BASE_WEIGHTS.momentum + (redistributed * BASE_WEIGHTS.momentum) / othersTotal,
      h2h: 0,
      goals: BASE_WEIGHTS.goals + (redistributed * BASE_WEIGHTS.goals) / othersTotal,
      confidence: BASE_WEIGHTS.confidence + (redistributed * BASE_WEIGHTS.confidence) / othersTotal,
    };
  }

  const raw =
    input.strength.overallStrength * weights.strength +
    momentumNormalized * weights.momentum +
    h2hComponent * weights.h2h +
    goalsComponent * weights.goals +
    input.confidence.confidenceScore * weights.confidence;

  const greenScore = Math.round(clampScore(raw));
  return { greenScore, classification: classifyGreenScore(greenScore) };
}
