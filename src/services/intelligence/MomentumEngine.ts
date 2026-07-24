// Fase 1.5 — Intelligence Engine — Módulo 6.
// Momentum Engine: detecta tendência recente comparando a forma dos últimos
// 5 jogos contra uma linha de base mais ampla (últimos 20 jogos). Gera um
// score entre -100 e +100. FÓRMULA PROVISÓRIA — poderá mudar em fases
// futuras conforme backtests reais forem produzidos.

import type { ESoccerPlayerMatchRecord } from "./types.ts";
import { calculateFormWindow } from "./FormEngine.ts";
import { clampScore } from "./types.ts";

export const MOMENTUM_MIN = -100;
export const MOMENTUM_MAX = 100;

export type MomentumResult = {
  momentumScore: number;
  recentPointsPerGame: number;
  baselinePointsPerGame: number;
  recentWinRate: number;
  baselineWinRate: number;
};

/**
 * FÓRMULA PROVISÓRIA (Fase 1.5 — poderá mudar após backtests reais):
 *
 *   momentumScore = clamp(
 *     ((recentPPG - baselinePPG) / 3) * 60 +
 *     (recentWinRate - baselineWinRate) * 40,
 *     -100, 100
 *   )
 *
 * recentPPG/baselinePPG vêm de calculateFormWindow(records, 5) e
 * calculateFormWindow(records, 20) respectivamente. PPG varia de 0 a 3
 * (vitória=3, empate=1, derrota=0); a divisão por 3 normaliza a diferença
 * para o intervalo -1..1 antes de aplicar o peso de 60%. winRate já está em
 * 0..1, então sua diferença já está em -1..1, e recebe peso de 40%.
 * Um jogador melhorando gera score positivo; piorando, negativo; estável,
 * próximo de zero.
 */
export function calculateMomentum(records: ESoccerPlayerMatchRecord[]): MomentumResult {
  const recent = calculateFormWindow(records, 5);
  const baseline = calculateFormWindow(records, 20);

  const ppgDelta = recent.pointsPerGame - baseline.pointsPerGame;
  const winRateDelta = recent.winRate - baseline.winRate;
  const raw = (ppgDelta / 3) * 60 + winRateDelta * 40;

  return {
    momentumScore: Math.round(clampScore(raw, MOMENTUM_MIN, MOMENTUM_MAX)),
    recentPointsPerGame: recent.pointsPerGame,
    baselinePointsPerGame: baseline.pointsPerGame,
    recentWinRate: recent.winRate,
    baselineWinRate: baseline.winRate,
  };
}
