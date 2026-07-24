// Fase 1.5 — Intelligence Engine — Módulo 4.
// Home/Away Engine: separa o histórico de um jogador em mandante x
// visitante e calcula estatísticas de cada lado independentemente.

import type { ESoccerPlayerMatchRecord } from "./types.ts";
import { outcomeForRecord } from "./types.ts";
import { calculateGoalsRates } from "./GoalsEngine.ts";

export type HomeAwaySplitStats = {
  matchesCount: number;
  winRate: number;
  goalsFor: number;
  goalsAgainst: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  bothTeamsScored: number;
  over25: number;
};

function summarizeSplit(records: ESoccerPlayerMatchRecord[]): HomeAwaySplitStats {
  const matchesCount = records.length;
  const wins = records.filter((record) => outcomeForRecord(record) === "WIN").length;
  const goalsFor = records.reduce((sum, record) => sum + record.goalsFor, 0);
  const goalsAgainst = records.reduce((sum, record) => sum + record.goalsAgainst, 0);
  const goalsRates = calculateGoalsRates(records);

  return {
    matchesCount,
    winRate: matchesCount ? wins / matchesCount : 0,
    goalsFor,
    goalsAgainst,
    avgGoalsFor: matchesCount ? goalsFor / matchesCount : 0,
    avgGoalsAgainst: matchesCount ? goalsAgainst / matchesCount : 0,
    bothTeamsScored: goalsRates.bothTeamsScored,
    over25: goalsRates.over25,
  };
}

export type HomeAwaySnapshot = {
  home: HomeAwaySplitStats;
  away: HomeAwaySplitStats;
};

/** Separa o histórico do jogador em mandante/visitante e resume cada lado. */
export function calculateHomeAwaySnapshot(records: ESoccerPlayerMatchRecord[]): HomeAwaySnapshot {
  return {
    home: summarizeSplit(records.filter((record) => record.isHome)),
    away: summarizeSplit(records.filter((record) => !record.isHome)),
  };
}
