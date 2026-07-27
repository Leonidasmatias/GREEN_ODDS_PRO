// Fase 4 — Sprint 4.1 — Prediction Engine Foundation.
// Feature Builder: converte os resultados já calculados pelo Intelligence
// Engine (Fase 1.5) em um conjunto determinístico de features com
// rastreabilidade completa. Função pura: nunca acessa Prisma, rede ou
// relógio do sistema, e nunca fabrica um valor histórico que os dados de
// entrada não contêm — campos ausentes resultam em features `MISSING` ou
// `NOT_APPLICABLE`, nunca em um valor inventado.
//
// Reaproveita `calculateExpectedScore` do Módulo 1 (RatingEngine, Fase 1.5)
// para normalizar a diferença de rating — a mesma fórmula de Elo já usada
// para recalcular ratings, em vez de reinventar uma escala nova.

import { calculateExpectedScore } from "../intelligence/RatingEngine.ts";
import type { PredictionModelConfig } from "./PredictionModelConfig.ts";
import type { MatchOutcomePredictionRequest, PredictionFeatureTrace, PlayerPredictionInputs } from "./types.ts";
import { clamp, isFiniteNumber } from "./types.ts";

const STRENGTH_SCALE_MAX = 100;
const GREEN_SCORE_SCALE_MAX = 100;
const MOMENTUM_SCALE_MAX = 200;

function directionFromContribution(contribution: number): "FAVORS_HOME" | "FAVORS_AWAY" | "NEUTRAL" {
  if (contribution > 0) return "FAVORS_HOME";
  if (contribution < 0) return "FAVORS_AWAY";
  return "NEUTRAL";
}

function unavailableFeature(name: string, weight: number, availability: "MISSING" | "NOT_APPLICABLE"): PredictionFeatureTrace {
  return {
    name,
    rawValue: null,
    normalizedValue: null,
    weight,
    contribution: 0,
    availability,
    direction: "NEUTRAL",
  };
}

/** Módulo 1 (Rating) — diferença de rating, normalizada via a probabilidade
 * esperada de Elo (a mesma fórmula usada pelo RatingEngine para recalcular
 * ratings), reescalada de 0..1 para -1..1. */
function buildRatingDifference(
  home: PlayerPredictionInputs,
  away: PlayerPredictionInputs,
  weight: number,
): PredictionFeatureTrace {
  const name = "ratingDifference";
  if (!home.rating || !away.rating || !isFiniteNumber(home.rating.rating) || !isFiniteNumber(away.rating.rating)) {
    return unavailableFeature(name, weight, "MISSING");
  }

  const rawValue = home.rating.rating - away.rating.rating;
  const expectedHome = calculateExpectedScore(home.rating.rating, away.rating.rating);
  const normalizedValue = clamp((expectedHome - 0.5) * 2);
  const contribution = weight * normalizedValue;

  return { name, rawValue, normalizedValue, weight, contribution, availability: "AVAILABLE", direction: directionFromContribution(contribution) };
}

/** Módulo 2 (Form) — diferença de pontos por jogo na janela configurada
 * (`config.formWindow`), normalizada pela mesma referência de 3 pontos por
 * jogo já usada pelo StrengthEngine (Módulo 7) para o próprio formScore. */
function buildFormDifference(
  home: PlayerPredictionInputs,
  away: PlayerPredictionInputs,
  weight: number,
  formWindow: 5 | 10 | 20,
): PredictionFeatureTrace {
  const name = "formDifference";
  const homeWindowKey = formWindow === 5 ? "last5" : formWindow === 10 ? "last10" : "last20";
  const homeWindow = home.form?.[homeWindowKey] ?? null;
  const awayWindow = away.form?.[homeWindowKey] ?? null;

  if (
    !homeWindow ||
    !awayWindow ||
    homeWindow.matchesCount === 0 ||
    awayWindow.matchesCount === 0 ||
    !isFiniteNumber(homeWindow.pointsPerGame) ||
    !isFiniteNumber(awayWindow.pointsPerGame)
  ) {
    return unavailableFeature(name, weight, "MISSING");
  }

  const rawValue = homeWindow.pointsPerGame - awayWindow.pointsPerGame;
  const normalizedValue = clamp(rawValue / 3);
  const contribution = weight * normalizedValue;

  return { name, rawValue, normalizedValue, weight, contribution, availability: "AVAILABLE", direction: directionFromContribution(contribution) };
}

/** Módulo 7 (Strength) — diferença de força geral (ataque+defesa+forma já
 * combinados pelo StrengthEngine), evitando duplicar o cálculo de
 * ataque/defesa separadamente. */
function buildStrengthDifference(
  home: PlayerPredictionInputs,
  away: PlayerPredictionInputs,
  weight: number,
): PredictionFeatureTrace {
  const name = "strengthDifference";
  if (
    !home.strength ||
    !away.strength ||
    !isFiniteNumber(home.strength.overallStrength) ||
    !isFiniteNumber(away.strength.overallStrength)
  ) {
    return unavailableFeature(name, weight, "MISSING");
  }

  const rawValue = home.strength.overallStrength - away.strength.overallStrength;
  const normalizedValue = clamp(rawValue / STRENGTH_SCALE_MAX);
  const contribution = weight * normalizedValue;

  return { name, rawValue, normalizedValue, weight, contribution, availability: "AVAILABLE", direction: directionFromContribution(contribution) };
}

/** Módulo 6 (Momentum) — diferença de momentum (-100..100 cada lado). */
function buildMomentumDifference(
  home: PlayerPredictionInputs,
  away: PlayerPredictionInputs,
  weight: number,
): PredictionFeatureTrace {
  const name = "momentumDifference";
  if (
    !home.momentum ||
    !away.momentum ||
    !isFiniteNumber(home.momentum.momentumScore) ||
    !isFiniteNumber(away.momentum.momentumScore)
  ) {
    return unavailableFeature(name, weight, "MISSING");
  }

  const rawValue = home.momentum.momentumScore - away.momentum.momentumScore;
  const normalizedValue = clamp(rawValue / MOMENTUM_SCALE_MAX);
  const contribution = weight * normalizedValue;

  return { name, rawValue, normalizedValue, weight, contribution, availability: "AVAILABLE", direction: directionFromContribution(contribution) };
}

/** Módulo 4 (Home/Away) — vantagem de mandante: taxa de vitória do jogador
 * mandante jogando em casa menos a taxa de vitória do jogador visitante
 * jogando fora, separado da força permanente do jogador (StrengthEngine) e
 * só aplicado quando ambos os lados têm amostra mínima
 * (`config.dataSufficiencyThresholds.minHomeAwaySampleSize`) — nunca
 * dominante sozinho por causa do peso pequeno padrão (ver
 * PredictionModelConfig). */
function buildHomeAdvantage(
  home: PlayerPredictionInputs,
  away: PlayerPredictionInputs,
  weight: number,
  minSampleSize: number,
): PredictionFeatureTrace {
  const name = "homeAdvantage";
  const homeSplit = home.homeAway?.home ?? null;
  const awaySplit = away.homeAway?.away ?? null;

  if (
    !homeSplit ||
    !awaySplit ||
    !isFiniteNumber(homeSplit.winRate) ||
    !isFiniteNumber(awaySplit.winRate) ||
    !isFiniteNumber(homeSplit.matchesCount) ||
    !isFiniteNumber(awaySplit.matchesCount)
  ) {
    return unavailableFeature(name, weight, "MISSING");
  }
  if (homeSplit.matchesCount < minSampleSize || awaySplit.matchesCount < minSampleSize) {
    return unavailableFeature(name, weight, "NOT_APPLICABLE");
  }

  const rawValue = homeSplit.winRate - awaySplit.winRate;
  const normalizedValue = clamp(rawValue);
  const contribution = weight * normalizedValue;

  return { name, rawValue, normalizedValue, weight, contribution, availability: "AVAILABLE", direction: directionFromContribution(contribution) };
}

export type OrientedHeadToHead = { homeWins: number; awayWins: number; matchesCount: number } | null;

/**
 * Reorienta o resultado canônico do HeadToHeadEngine (Módulo 5, par sempre
 * ordenado playerAId <= playerBId) para a perspectiva mandante/visitante
 * real desta partida. Devolve `null` quando não há H2H, quando não há
 * confrontos registrados, ou quando os identificadores do H2H não
 * correspondem a nenhum dos dois jogadores desta requisição (dado
 * inconsistente — tratado defensivamente, nunca lançado como erro).
 */
export function orientHeadToHead(
  headToHead: MatchOutcomePredictionRequest["headToHead"],
  homePlayerId: string,
  awayPlayerId: string,
): OrientedHeadToHead {
  if (!headToHead || !isFiniteNumber(headToHead.matchesCount) || headToHead.matchesCount === 0) return null;

  const idsMatchHomeAway =
    (headToHead.playerAId === homePlayerId && headToHead.playerBId === awayPlayerId) ||
    (headToHead.playerAId === awayPlayerId && headToHead.playerBId === homePlayerId);
  if (!idsMatchHomeAway) return null;

  const homeIsPlayerA = headToHead.playerAId === homePlayerId;
  const homeWins = homeIsPlayerA ? headToHead.playerAWins : headToHead.playerBWins;
  const awayWins = homeIsPlayerA ? headToHead.playerBWins : headToHead.playerAWins;

  if (!isFiniteNumber(homeWins) || !isFiniteNumber(awayWins)) return null;

  return { homeWins, awayWins, matchesCount: headToHead.matchesCount };
}

/** Módulo 5 (Head to Head) — vantagem no confronto direto, reorientado para
 * mandante/visitante desta partida via `orientHeadToHead`. */
function buildHeadToHead(oriented: OrientedHeadToHead, weight: number): PredictionFeatureTrace {
  const name = "headToHead";
  if (!oriented) {
    return unavailableFeature(name, weight, "MISSING");
  }

  const rawValue = oriented.homeWins - oriented.awayWins;
  const normalizedValue = clamp(rawValue / oriented.matchesCount);
  const contribution = weight * normalizedValue;

  return { name, rawValue, normalizedValue, weight, contribution, availability: "AVAILABLE", direction: directionFromContribution(contribution) };
}

/** Módulo 9 (Green Score) — diferença do indicador consolidado. */
function buildGreenScoreDifference(
  home: PlayerPredictionInputs,
  away: PlayerPredictionInputs,
  weight: number,
): PredictionFeatureTrace {
  const name = "greenScoreDifference";
  if (
    !home.greenScore ||
    !away.greenScore ||
    !isFiniteNumber(home.greenScore.greenScore) ||
    !isFiniteNumber(away.greenScore.greenScore)
  ) {
    return unavailableFeature(name, weight, "MISSING");
  }

  const rawValue = home.greenScore.greenScore - away.greenScore.greenScore;
  const normalizedValue = clamp(rawValue / GREEN_SCORE_SCALE_MAX);
  const contribution = weight * normalizedValue;

  return { name, rawValue, normalizedValue, weight, contribution, availability: "AVAILABLE", direction: directionFromContribution(contribution) };
}

/**
 * Componente de empate (própria, não derivada de "1 - home - away"): média
 * dos sub-sinais de equilíbrio realmente disponíveis (proximidade de
 * rating/forma/força/H2H/Green Score + frequência histórica de empates de
 * cada jogador), redistribuindo o peso entre os sub-sinais disponíveis —
 * o mesmo padrão de redistribuição já usado por GreenScoreEngine quando o
 * H2H está ausente. Quando NENHUM sub-sinal está disponível (ex.: os dois
 * jogadores são estreantes), o componente inteiro fica `NOT_APPLICABLE`
 * (contribuição zero) em vez de assumir um valor neutro arbitrário.
 */
function buildDrawBalance(
  home: PlayerPredictionInputs,
  away: PlayerPredictionInputs,
  ratingDifference: PredictionFeatureTrace,
  formDifference: PredictionFeatureTrace,
  strengthDifference: PredictionFeatureTrace,
  headToHeadFeature: PredictionFeatureTrace,
  greenScoreDifference: PredictionFeatureTrace,
  weight: number,
  formWindow: 5 | 10 | 20,
): PredictionFeatureTrace {
  const name = "drawBalance";
  const subSignals: number[] = [];

  if (ratingDifference.availability === "AVAILABLE" && ratingDifference.normalizedValue !== null) {
    subSignals.push(1 - Math.abs(ratingDifference.normalizedValue));
  }
  if (formDifference.availability === "AVAILABLE" && formDifference.normalizedValue !== null) {
    subSignals.push(1 - Math.abs(formDifference.normalizedValue));
  }
  if (strengthDifference.availability === "AVAILABLE" && strengthDifference.normalizedValue !== null) {
    subSignals.push(1 - Math.abs(strengthDifference.normalizedValue));
  }
  if (headToHeadFeature.availability === "AVAILABLE" && headToHeadFeature.normalizedValue !== null) {
    subSignals.push(1 - Math.abs(headToHeadFeature.normalizedValue));
  }
  if (greenScoreDifference.availability === "AVAILABLE" && greenScoreDifference.normalizedValue !== null) {
    subSignals.push(1 - Math.abs(greenScoreDifference.normalizedValue));
  }

  const homeWindowKey = formWindow === 5 ? "last5" : formWindow === 10 ? "last10" : "last20";
  const homeWindow = home.form?.[homeWindowKey] ?? null;
  const awayWindow = away.form?.[homeWindowKey] ?? null;
  if (
    homeWindow &&
    awayWindow &&
    homeWindow.matchesCount > 0 &&
    awayWindow.matchesCount > 0 &&
    isFiniteNumber(homeWindow.draws) &&
    isFiniteNumber(awayWindow.draws)
  ) {
    const homeDrawRate = homeWindow.draws / homeWindow.matchesCount;
    const awayDrawRate = awayWindow.draws / awayWindow.matchesCount;
    subSignals.push((homeDrawRate + awayDrawRate) / 2);
  }

  if (subSignals.length === 0) {
    return unavailableFeature(name, weight, "NOT_APPLICABLE");
  }

  const drawBalanceScore = clamp(
    subSignals.reduce((sum, value) => sum + value, 0) / subSignals.length,
    0,
    1,
  );
  const contribution = weight * drawBalanceScore;

  return {
    name,
    rawValue: null,
    normalizedValue: drawBalanceScore,
    weight,
    contribution,
    availability: "AVAILABLE",
    direction: "FAVORS_DRAW",
  };
}

/**
 * Constrói, de forma determinística e pura, as oito features do modelo a
 * partir dos resultados já calculados pelo Intelligence Engine. A mesma
 * entrada sempre produz a mesma saída, em ordem fixa:
 * ratingDifference, formDifference, strengthDifference, momentumDifference,
 * homeAdvantage, headToHead, greenScoreDifference, drawBalance.
 */
export function buildPredictionFeatures(
  request: MatchOutcomePredictionRequest,
  config: PredictionModelConfig,
): PredictionFeatureTrace[] {
  const { homePlayer, awayPlayer } = request;
  const { weights, dataSufficiencyThresholds, formWindow } = config;

  const ratingDifference = buildRatingDifference(homePlayer, awayPlayer, weights.ratingDifference);
  const formDifference = buildFormDifference(homePlayer, awayPlayer, weights.formDifference, formWindow);
  const strengthDifference = buildStrengthDifference(homePlayer, awayPlayer, weights.strengthDifference);
  const momentumDifference = buildMomentumDifference(homePlayer, awayPlayer, weights.momentumDifference);
  const homeAdvantage = buildHomeAdvantage(
    homePlayer,
    awayPlayer,
    weights.homeAdvantage,
    dataSufficiencyThresholds.minHomeAwaySampleSize,
  );
  const orientedH2H = orientHeadToHead(request.headToHead, homePlayer.playerId, awayPlayer.playerId);
  const headToHead = buildHeadToHead(orientedH2H, weights.headToHead);
  const greenScoreDifference = buildGreenScoreDifference(homePlayer, awayPlayer, weights.greenScoreDifference);
  const drawBalance = buildDrawBalance(
    homePlayer,
    awayPlayer,
    ratingDifference,
    formDifference,
    strengthDifference,
    headToHead,
    greenScoreDifference,
    weights.drawBalance,
    formWindow,
  );

  return [
    ratingDifference,
    formDifference,
    strengthDifference,
    momentumDifference,
    homeAdvantage,
    headToHead,
    greenScoreDifference,
    drawBalance,
  ];
}
