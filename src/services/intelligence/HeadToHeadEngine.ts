// Fase 1.5 — Intelligence Engine — Módulo 5.
// Head to Head Engine: estatísticas de confronto direto entre dois
// jogadores, usando a ordenação canônica de par implementada na Fase 1
// (src/lib/esoccer/normalization.ts) para que o par (A, B) seja sempre
// representado de forma estável, independente de quem foi mandante.

import { canonicalizePlayerPair } from "../../lib/esoccer/normalization.ts";

export type HeadToHeadMatchRecord = {
  matchId: string;
  playedAt: string;
  homePlayerId: string;
  awayPlayerId: string;
  homeGoals: number;
  awayGoals: number;
};

export type HeadToHeadResult = {
  playerAId: string;
  playerBId: string;
  matchesCount: number;
  playerAWins: number;
  playerBWins: number;
  draws: number;
  playerAGoals: number;
  playerBGoals: number;
  over25Rate: number;
  over35Rate: number;
  bothTeamsScoredRate: number;
  lastMatch: HeadToHeadMatchRecord | null;
  lastFiveMatches: HeadToHeadMatchRecord[];
};

/**
 * Calcula o confronto direto entre playerAId e playerBId a partir de
 * `matches` (histórico completo, não pré-filtrado). Os identificadores são
 * canonicalizados internamente (menor sempre em playerAId), então o
 * chamador pode passar os dois IDs em qualquer ordem.
 */
export function calculateHeadToHead(
  playerAId: string,
  playerBId: string,
  matches: HeadToHeadMatchRecord[],
): HeadToHeadResult {
  const [canonicalA, canonicalB] = canonicalizePlayerPair(playerAId, playerBId);

  const relevant = matches.filter(
    (match) =>
      (match.homePlayerId === canonicalA && match.awayPlayerId === canonicalB) ||
      (match.homePlayerId === canonicalB && match.awayPlayerId === canonicalA),
  );
  const sorted = [...relevant].sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

  let playerAWins = 0;
  let playerBWins = 0;
  let draws = 0;
  let playerAGoals = 0;
  let playerBGoals = 0;
  let over25 = 0;
  let over35 = 0;
  let bothTeamsScored = 0;

  for (const match of sorted) {
    const aIsHome = match.homePlayerId === canonicalA;
    const goalsA = aIsHome ? match.homeGoals : match.awayGoals;
    const goalsB = aIsHome ? match.awayGoals : match.homeGoals;

    playerAGoals += goalsA;
    playerBGoals += goalsB;
    if (goalsA > goalsB) playerAWins += 1;
    else if (goalsB > goalsA) playerBWins += 1;
    else draws += 1;

    const total = goalsA + goalsB;
    if (total > 2.5) over25 += 1;
    if (total > 3.5) over35 += 1;
    if (goalsA > 0 && goalsB > 0) bothTeamsScored += 1;
  }

  const matchesCount = sorted.length;

  return {
    playerAId: canonicalA,
    playerBId: canonicalB,
    matchesCount,
    playerAWins,
    playerBWins,
    draws,
    playerAGoals,
    playerBGoals,
    over25Rate: matchesCount ? over25 / matchesCount : 0,
    over35Rate: matchesCount ? over35 / matchesCount : 0,
    bothTeamsScoredRate: matchesCount ? bothTeamsScored / matchesCount : 0,
    lastMatch: sorted[0] ?? null,
    lastFiveMatches: sorted.slice(0, 5),
  };
}
