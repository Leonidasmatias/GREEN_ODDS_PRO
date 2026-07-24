// Fase 1.5 — Intelligence Engine — Módulo 1.
// Rating Engine: implementação de Elo simplificado, sem bibliotecas
// externas. Mantém o rating de cada jogador (identidade permanente,
// ver docs/ESOCER_DOMAIN_V1.md) ao longo do histórico de partidas.

export const INITIAL_RATING = 1500;
export const K_FACTOR = 20;

export type EloMatchResult = "WIN" | "DRAW" | "LOSS";

/**
 * Probabilidade esperada de A vencer B, dado o rating atual dos dois lados.
 * Fórmula padrão de Elo: 1 / (1 + 10^((ratingB - ratingA) / 400)).
 */
export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function actualScoreFor(result: EloMatchResult): number {
  if (result === "WIN") return 1;
  if (result === "DRAW") return 0.5;
  return 0;
}

/**
 * Calcula os novos ratings de A e B após um confronto direto entre os dois,
 * dado o resultado do ponto de vista de A. K_FACTOR = 20 nesta fase.
 */
export function calculateNewRatings(
  ratingA: number,
  ratingB: number,
  resultForA: EloMatchResult,
): { ratingA: number; ratingB: number } {
  const expectedA = calculateExpectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;
  const scoreA = actualScoreFor(resultForA);
  const scoreB = 1 - scoreA;
  return {
    ratingA: ratingA + K_FACTOR * (scoreA - expectedA),
    ratingB: ratingB + K_FACTOR * (scoreB - expectedB),
  };
}

export type RatingMatchInput = {
  homeRatingBefore: number;
  awayRatingBefore: number;
  homeGoals: number;
  awayGoals: number;
};

export type RatingMatchOutput = { homeRating: number; awayRating: number };

/**
 * Aplica uma única partida (placar já conhecido) aos ratings de entrada e
 * devolve os novos ratings de casa e visitante.
 */
export function applyMatch(input: RatingMatchInput): RatingMatchOutput {
  const result: EloMatchResult =
    input.homeGoals > input.awayGoals ? "WIN" : input.homeGoals === input.awayGoals ? "DRAW" : "LOSS";
  const { ratingA, ratingB } = calculateNewRatings(input.homeRatingBefore, input.awayRatingBefore, result);
  return { homeRating: ratingA, awayRating: ratingB };
}

export type RatingHistoryMatch = {
  matchId: string;
  playedAt: string;
  homePlayerId: string;
  awayPlayerId: string;
  homeGoals: number;
  awayGoals: number;
};

export type PlayerRatingResult = { playerId: string; rating: number; matchesCount: number };

/**
 * Recalcula o rating de todos os jogadores presentes em `matches` do zero,
 * processando as partidas em ordem cronológica (mais antiga primeiro),
 * partindo de INITIAL_RATING para qualquer jogador sem rating anterior.
 */
export function batchRecalculate(
  matches: RatingHistoryMatch[],
  initialRating: number = INITIAL_RATING,
): Map<string, PlayerRatingResult> {
  const ratings = new Map<string, number>();
  const matchesCount = new Map<string, number>();
  const sorted = [...matches].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());

  const getRating = (id: string) => ratings.get(id) ?? initialRating;

  for (const match of sorted) {
    const homeBefore = getRating(match.homePlayerId);
    const awayBefore = getRating(match.awayPlayerId);
    const { homeRating, awayRating } = applyMatch({
      homeRatingBefore: homeBefore,
      awayRatingBefore: awayBefore,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
    });
    ratings.set(match.homePlayerId, homeRating);
    ratings.set(match.awayPlayerId, awayRating);
    matchesCount.set(match.homePlayerId, (matchesCount.get(match.homePlayerId) ?? 0) + 1);
    matchesCount.set(match.awayPlayerId, (matchesCount.get(match.awayPlayerId) ?? 0) + 1);
  }

  const result = new Map<string, PlayerRatingResult>();
  for (const [playerId, rating] of ratings.entries()) {
    result.set(playerId, { playerId, rating, matchesCount: matchesCount.get(playerId) ?? 0 });
  }
  return result;
}
