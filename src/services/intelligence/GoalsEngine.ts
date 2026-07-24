// Fase 1.5 — Intelligence Engine — Módulo 3.
// Goals Engine: taxas de gols (Over 0.5..5.5, BTTS, Clean Sheet, Failed To
// Score) sempre no intervalo 0..1, a partir do histórico de um jogador.

import type { ESoccerPlayerMatchRecord } from "./types.ts";

export type GoalsRates = {
  matchesCount: number;
  over05: number;
  over15: number;
  over25: number;
  over35: number;
  over45: number;
  over55: number;
  bothTeamsScored: number;
  cleanSheet: number;
  failedToScore: number;
};

const EMPTY_RATES: GoalsRates = {
  matchesCount: 0,
  over05: 0,
  over15: 0,
  over25: 0,
  over35: 0,
  over45: 0,
  over55: 0,
  bothTeamsScored: 0,
  cleanSheet: 0,
  failedToScore: 0,
};

/**
 * Calcula, para o conjunto de partidas fornecido, a fração de partidas que
 * ultrapassa cada limiar de total de gols (0.5 a 5.5), a fração com ambas
 * as equipes marcando (BTTS), a fração em que o jogador não sofreu gol
 * (clean sheet) e a fração em que o jogador não marcou (failed to score).
 * Todos os valores ficam entre 0 e 1. Lista vazia devolve tudo zerado.
 */
export function calculateGoalsRates(records: ESoccerPlayerMatchRecord[]): GoalsRates {
  const matchesCount = records.length;
  if (matchesCount === 0) {
    return { ...EMPTY_RATES };
  }

  let over05 = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let over45 = 0;
  let over55 = 0;
  let bothTeamsScored = 0;
  let cleanSheet = 0;
  let failedToScore = 0;

  for (const record of records) {
    const totalGoals = record.goalsFor + record.goalsAgainst;
    if (totalGoals > 0.5) over05 += 1;
    if (totalGoals > 1.5) over15 += 1;
    if (totalGoals > 2.5) over25 += 1;
    if (totalGoals > 3.5) over35 += 1;
    if (totalGoals > 4.5) over45 += 1;
    if (totalGoals > 5.5) over55 += 1;
    if (record.goalsFor > 0 && record.goalsAgainst > 0) bothTeamsScored += 1;
    if (record.goalsAgainst === 0) cleanSheet += 1;
    if (record.goalsFor === 0) failedToScore += 1;
  }

  return {
    matchesCount,
    over05: over05 / matchesCount,
    over15: over15 / matchesCount,
    over25: over25 / matchesCount,
    over35: over35 / matchesCount,
    over45: over45 / matchesCount,
    over55: over55 / matchesCount,
    bothTeamsScored: bothTeamsScored / matchesCount,
    cleanSheet: cleanSheet / matchesCount,
    failedToScore: failedToScore / matchesCount,
  };
}
