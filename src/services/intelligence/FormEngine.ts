// Fase 1.5 — Intelligence Engine — Módulo 2.
// Form Engine: calcula forma recente de um jogador em janelas de 5, 10 e 20
// partidas, a partir do histórico completo fornecido pelo chamador.

import type { ESoccerPlayerMatchRecord } from "./types.ts";
import { outcomeForRecord } from "./types.ts";

export type FormWindowStats = {
  windowSize: number;
  matchesCount: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  pointsPerGame: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
};

/**
 * Calcula estatísticas de forma para uma janela de até `windowSize`
 * partidas mais recentes. Ordena `records` por `playedAt` decrescente
 * internamente, então o chamador não precisa pré-ordenar a entrada.
 * Se houver menos partidas do que `windowSize`, usa todas as disponíveis.
 */
export function calculateFormWindow(records: ESoccerPlayerMatchRecord[], windowSize: number): FormWindowStats {
  const sorted = [...records].sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
  const window = sorted.slice(0, windowSize);
  const matchesCount = window.length;

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const record of window) {
    const outcome = outcomeForRecord(record);
    if (outcome === "WIN") wins += 1;
    else if (outcome === "DRAW") draws += 1;
    else losses += 1;
    goalsFor += record.goalsFor;
    goalsAgainst += record.goalsAgainst;
  }

  const points = wins * 3 + draws;

  return {
    windowSize,
    matchesCount,
    wins,
    draws,
    losses,
    winRate: matchesCount ? wins / matchesCount : 0,
    pointsPerGame: matchesCount ? points / matchesCount : 0,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    avgGoalsFor: matchesCount ? goalsFor / matchesCount : 0,
    avgGoalsAgainst: matchesCount ? goalsAgainst / matchesCount : 0,
  };
}

export type FormSnapshot = {
  last5: FormWindowStats;
  last10: FormWindowStats;
  last20: FormWindowStats;
};

/** Calcula as três janelas padrão (5, 10, 20) de uma vez. */
export function calculateFormSnapshot(records: ESoccerPlayerMatchRecord[]): FormSnapshot {
  return {
    last5: calculateFormWindow(records, 5),
    last10: calculateFormWindow(records, 10),
    last20: calculateFormWindow(records, 20),
  };
}
