// Fase 1.5 — Intelligence Engine — Módulo 10.
// Aggregation Engine: único módulo desta fase que acessa o Prisma. Lê
// ESoccerMatch (partidas finalizadas) e atualiza ESoccerPlayerRollingStats,
// ESoccerHeadToHeadStats e ESoccerPlayerRating. Não acessa nenhuma API
// externa — toda a entrada vem do banco local via ESoccerMatch.
//
// A lógica de cálculo em si é 100% pura (computeRollingStatsForPlayer,
// computeHeadToHeadPairs, computeRatings) e testável sem banco de dados;
// apenas runAggregation() faz I/O real via Prisma e não é coberta por teste
// automatizado nesta fase por depender de uma conexão de banco real (ver
// docs/INTELLIGENCE_ENGINE_V1.md, seção de limitações). O import do
// Prisma Client é feito de forma tardia (dynamic import), dentro da
// própria runAggregation(), para que os testes possam importar este
// módulo (e usar as funções puras acima) sem instanciar o Prisma Client.

import { canonicalizePlayerPair } from "../../lib/esoccer/normalization.ts";
import { calculateFormWindow } from "./FormEngine.ts";
import { calculateGoalsRates } from "./GoalsEngine.ts";
import { calculateHeadToHead, type HeadToHeadMatchRecord } from "./HeadToHeadEngine.ts";
import { batchRecalculate, INITIAL_RATING, type RatingHistoryMatch } from "./RatingEngine.ts";
import type { ESoccerPlayerMatchRecord } from "./types.ts";

export type AggregationMatchInput = {
  matchId: string;
  playedAt: string;
  homePlayerId: string;
  awayPlayerId: string;
  homeScore: number;
  awayScore: number;
};

export type RollingStatsRow = {
  playerId: string;
  windowSize: number;
  matchesCount: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  bothTeamsScoredRate: number;
  over25Rate: number;
  over35Rate: number;
  over45Rate: number;
};

const ROLLING_WINDOWS = [5, 10, 20] as const;

function toPlayerRecords(matches: AggregationMatchInput[], playerId: string): ESoccerPlayerMatchRecord[] {
  const records: ESoccerPlayerMatchRecord[] = [];
  for (const match of matches) {
    if (match.homePlayerId === playerId) {
      records.push({
        matchId: match.matchId,
        playedAt: match.playedAt,
        isHome: true,
        opponentPlayerId: match.awayPlayerId,
        goalsFor: match.homeScore,
        goalsAgainst: match.awayScore,
      });
    } else if (match.awayPlayerId === playerId) {
      records.push({
        matchId: match.matchId,
        playedAt: match.playedAt,
        isHome: false,
        opponentPlayerId: match.homePlayerId,
        goalsFor: match.awayScore,
        goalsAgainst: match.homeScore,
      });
    }
  }
  return records;
}

/**
 * Calcula, de forma pura (sem Prisma), as três linhas de rolling stats
 * (janelas 5/10/20) de um jogador a partir do histórico completo de
 * partidas finalizadas fornecido pelo chamador.
 */
export function computeRollingStatsForPlayer(playerId: string, matches: AggregationMatchInput[]): RollingStatsRow[] {
  const records = toPlayerRecords(matches, playerId);

  return ROLLING_WINDOWS.map((windowSize) => {
    const form = calculateFormWindow(records, windowSize);
    const window = [...records]
      .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
      .slice(0, windowSize);
    const goalsRates = calculateGoalsRates(window);

    return {
      playerId,
      windowSize,
      matchesCount: form.matchesCount,
      wins: form.wins,
      draws: form.draws,
      losses: form.losses,
      goalsFor: form.goalsFor,
      goalsAgainst: form.goalsAgainst,
      avgGoalsFor: form.avgGoalsFor,
      avgGoalsAgainst: form.avgGoalsAgainst,
      bothTeamsScoredRate: goalsRates.bothTeamsScored,
      over25Rate: goalsRates.over25,
      over35Rate: goalsRates.over35,
      over45Rate: goalsRates.over45,
    };
  });
}

export type HeadToHeadRow = {
  playerAId: string;
  playerBId: string;
  matchesCount: number;
  playerAWins: number;
  draws: number;
  playerBWins: number;
  playerAGoals: number;
  playerBGoals: number;
  over25Rate: number;
  over35Rate: number;
  bothTeamsScoredRate: number;
};

/**
 * Calcula, de forma pura, uma linha de H2H para cada par de jogadores que
 * já se enfrentaram em `matches`, usando a ordenação canônica da Fase 1.
 */
export function computeHeadToHeadPairs(matches: AggregationMatchInput[]): HeadToHeadRow[] {
  const asH2HRecords: HeadToHeadMatchRecord[] = matches.map((match) => ({
    matchId: match.matchId,
    playedAt: match.playedAt,
    homePlayerId: match.homePlayerId,
    awayPlayerId: match.awayPlayerId,
    homeGoals: match.homeScore,
    awayGoals: match.awayScore,
  }));

  const pairKeys = new Set<string>();
  for (const match of matches) {
    const [a, b] = canonicalizePlayerPair(match.homePlayerId, match.awayPlayerId);
    pairKeys.add(`${a}::${b}`);
  }

  return [...pairKeys].map((key) => {
    const [playerAId, playerBId] = key.split("::");
    const result = calculateHeadToHead(playerAId, playerBId, asH2HRecords);
    return {
      playerAId: result.playerAId,
      playerBId: result.playerBId,
      matchesCount: result.matchesCount,
      playerAWins: result.playerAWins,
      draws: result.draws,
      playerBWins: result.playerBWins,
      playerAGoals: result.playerAGoals,
      playerBGoals: result.playerBGoals,
      over25Rate: result.over25Rate,
      over35Rate: result.over35Rate,
      bothTeamsScoredRate: result.bothTeamsScoredRate,
    };
  });
}

export type PlayerRatingRow = { playerId: string; rating: number; matchesCount: number };

/** Recalcula, de forma pura, o rating Elo simplificado de todos os
 * jogadores presentes em `matches` (ver RatingEngine.ts, Módulo 1). */
export function computeRatings(matches: AggregationMatchInput[]): Map<string, PlayerRatingRow> {
  const ratingMatches: RatingHistoryMatch[] = matches.map((match) => ({
    matchId: match.matchId,
    playedAt: match.playedAt,
    homePlayerId: match.homePlayerId,
    awayPlayerId: match.awayPlayerId,
    homeGoals: match.homeScore,
    awayGoals: match.awayScore,
  }));
  return batchRecalculate(ratingMatches, INITIAL_RATING);
}

export type AggregationRunSummary = { playersUpdated: number; pairsUpdated: number; ratingsRecorded: number };

/**
 * Lê todas as ESoccerMatch com status FINISHED e placar completo via
 * Prisma, recalcula rolling stats/H2H/ratings usando as funções puras
 * acima, e persiste (upsert) nas tabelas correspondentes. Não acessa
 * nenhuma API externa.
 */
export async function runAggregation(): Promise<AggregationRunSummary> {
  const { prisma } = await import("../../lib/prisma.ts");
  const finishedMatches = await prisma.eSoccerMatch.findMany({
    where: { status: "FINISHED", homeScore: { not: null }, awayScore: { not: null } },
    select: { id: true, scheduledAt: true, homePlayerId: true, awayPlayerId: true, homeScore: true, awayScore: true },
  });

  const matches: AggregationMatchInput[] = finishedMatches.map((match) => ({
    matchId: match.id,
    playedAt: match.scheduledAt.toISOString(),
    homePlayerId: match.homePlayerId,
    awayPlayerId: match.awayPlayerId,
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
  }));

  const playerIds = new Set<string>();
  for (const match of matches) {
    playerIds.add(match.homePlayerId);
    playerIds.add(match.awayPlayerId);
  }

  for (const playerId of playerIds) {
    const rows = computeRollingStatsForPlayer(playerId, matches);
    for (const row of rows) {
      await prisma.eSoccerPlayerRollingStats.upsert({
        where: { playerId_windowSize: { playerId: row.playerId, windowSize: row.windowSize } },
        create: { ...row, calculatedAt: new Date() },
        update: { ...row, calculatedAt: new Date() },
      });
    }
  }

  const h2hRows = computeHeadToHeadPairs(matches);
  for (const row of h2hRows) {
    await prisma.eSoccerHeadToHeadStats.upsert({
      where: { playerAId_playerBId: { playerAId: row.playerAId, playerBId: row.playerBId } },
      create: { ...row, calculatedAt: new Date() },
      update: { ...row, calculatedAt: new Date() },
    });
  }

  const ratings = computeRatings(matches);
  for (const { playerId, rating, matchesCount } of ratings.values()) {
    await prisma.eSoccerPlayerRating.create({
      data: { playerId, rating, matchesCount, ratingSystem: "ELO" },
    });
  }

  return { playersUpdated: playerIds.size, pairsUpdated: h2hRows.length, ratingsRecorded: ratings.size };
}
