// Fase 4 — Sprint 4.2 — Goal Distribution Engine Foundation.
// Expected Goals Feature Builder: converte os resultados já calculados
// pelo Intelligence Engine (Fase 1.5) em cinco features rastreáveis, cada
// uma bidirecional (contribui simultaneamente para os gols esperados do
// mandante e do visitante). Função pura: nunca acessa Prisma, rede ou
// relógio do sistema, e nunca fabrica um valor histórico que os dados de
// entrada não contêm — campos ausentes resultam em features `MISSING` ou
// `NOT_APPLICABLE`, nunca em um valor inventado.
//
// Todas as taxas observadas passam por suavização (shrinkage) antes de
// contribuir, na forma documentada em `GoalDistributionConfig.ts`:
//   adjustedRate = sampleWeight * observedRate + (1 - sampleWeight) * conservativeBaseline
//   sampleWeight = clamp(matchesCount / fullConfidenceSampleSize, 0, 1)
// Uma amostra de 1 partida nunca é tratada com a mesma confiança que uma
// amostra de 100.

import type { GoalDistributionConfig } from "./GoalDistributionConfig.ts";
import type { GoalDistributionPlayerInputs, GoalFeatureTrace, HeadToHeadResult } from "./types.ts";
import { clamp, isFiniteNumber } from "./types.ts";

function unavailableFeature(
  name: string,
  weight: number,
  availability: "MISSING" | "NOT_APPLICABLE",
  explanation: string,
): GoalFeatureTrace {
  return {
    name,
    rawValue: null,
    normalizedValue: null,
    weight,
    contributionHome: 0,
    contributionAway: 0,
    availability,
    explanation,
  };
}

/** `adjustedRate = sampleWeight * observedRate + (1 - sampleWeight) * conservativeBaseline`. */
function applyShrinkage(observedRate: number, matchesCount: number, config: GoalDistributionConfig): number {
  const sampleWeight = clamp(matchesCount / config.shrinkage.fullConfidenceSampleSize, 0, 1);
  return sampleWeight * observedRate + (1 - sampleWeight) * config.shrinkage.conservativeBaselineGoalsPerMatch;
}

/** Módulo 2 (FormEngine) — combina a taxa de ataque recente de um lado com
 * a taxa de defesa (gols concedidos) recente do adversário, cada uma
 * suavizada pela própria amostra, em uma estimativa de gols/partida. */
function buildRecentFormFeature(
  home: GoalDistributionPlayerInputs,
  away: GoalDistributionPlayerInputs,
  weight: number,
  config: GoalDistributionConfig,
): GoalFeatureTrace {
  const name = "recentForm";
  const homeWindow = home.form?.last10 ?? null;
  const awayWindow = away.form?.last10 ?? null;

  if (
    !homeWindow ||
    !awayWindow ||
    homeWindow.matchesCount === 0 ||
    awayWindow.matchesCount === 0 ||
    !isFiniteNumber(homeWindow.avgGoalsFor) ||
    !isFiniteNumber(homeWindow.avgGoalsAgainst) ||
    !isFiniteNumber(awayWindow.avgGoalsFor) ||
    !isFiniteNumber(awayWindow.avgGoalsAgainst)
  ) {
    return unavailableFeature(name, weight, "MISSING", "Recent form (last10) unavailable for at least one side.");
  }

  const homeAttack = applyShrinkage(homeWindow.avgGoalsFor, homeWindow.matchesCount, config);
  const awayDefenseConceded = applyShrinkage(awayWindow.avgGoalsAgainst, awayWindow.matchesCount, config);
  const awayAttack = applyShrinkage(awayWindow.avgGoalsFor, awayWindow.matchesCount, config);
  const homeDefenseConceded = applyShrinkage(homeWindow.avgGoalsAgainst, homeWindow.matchesCount, config);

  const contributionHome = (homeAttack + awayDefenseConceded) / 2;
  const contributionAway = (awayAttack + homeDefenseConceded) / 2;

  return {
    name,
    rawValue: null,
    normalizedValue: null,
    weight,
    contributionHome,
    contributionAway,
    availability: "AVAILABLE",
    explanation: "Blend of each side's shrunk recent scoring rate and the opponent's shrunk recent conceding rate (last10).",
  };
}

/** Módulo 4 (HomeAwayEngine) — mesma ideia do recentForm, mas usando os
 * splits mandante/visitante específicos, só disponível quando ambos os
 * lados atingem a amostra mínima configurada
 * (`dataSufficiencyThresholds.minHomeAwaySampleSize`). */
function buildHomeAwaySplitFeature(
  home: GoalDistributionPlayerInputs,
  away: GoalDistributionPlayerInputs,
  weight: number,
  config: GoalDistributionConfig,
): GoalFeatureTrace {
  const name = "homeAwaySplit";
  const homeSplit = home.homeAway?.home ?? null;
  const awaySplit = away.homeAway?.away ?? null;
  const minSampleSize = config.dataSufficiencyThresholds.minHomeAwaySampleSize;

  if (
    !homeSplit ||
    !awaySplit ||
    !isFiniteNumber(homeSplit.avgGoalsFor) ||
    !isFiniteNumber(homeSplit.avgGoalsAgainst) ||
    !isFiniteNumber(awaySplit.avgGoalsFor) ||
    !isFiniteNumber(awaySplit.avgGoalsAgainst) ||
    !isFiniteNumber(homeSplit.matchesCount) ||
    !isFiniteNumber(awaySplit.matchesCount)
  ) {
    return unavailableFeature(name, weight, "MISSING", "Home/away split data unavailable for at least one side.");
  }
  if (homeSplit.matchesCount < minSampleSize || awaySplit.matchesCount < minSampleSize) {
    return unavailableFeature(
      name,
      weight,
      "NOT_APPLICABLE",
      `Home/away split sample below the configured minimum (${minSampleSize}).`,
    );
  }

  const homeAttack = applyShrinkage(homeSplit.avgGoalsFor, homeSplit.matchesCount, config);
  const awayDefenseConceded = applyShrinkage(awaySplit.avgGoalsAgainst, awaySplit.matchesCount, config);
  const awayAttack = applyShrinkage(awaySplit.avgGoalsFor, awaySplit.matchesCount, config);
  const homeDefenseConceded = applyShrinkage(homeSplit.avgGoalsAgainst, homeSplit.matchesCount, config);

  const contributionHome = (homeAttack + awayDefenseConceded) / 2;
  const contributionAway = (awayAttack + homeDefenseConceded) / 2;

  return {
    name,
    rawValue: null,
    normalizedValue: null,
    weight,
    contributionHome,
    contributionAway,
    availability: "AVAILABLE",
    explanation: "Blend of each side's shrunk home/away-specific scoring rate and the opponent's shrunk conceding rate.",
  };
}

export type OrientedHeadToHeadGoals = { homeGoalsAverage: number; awayGoalsAverage: number; matchesCount: number } | null;

/** Reorienta o H2H canônico (Fase 1.5) para a perspectiva mandante/visitante
 * real desta partida e converte para médias de gols por partida — mesma
 * lógica defensiva de `orientHeadToHead` da Sprint 4.1 (dados inconsistentes
 * nunca lançam erro, apenas tornam o H2H indisponível). */
export function orientHeadToHeadGoals(
  headToHead: HeadToHeadResult | null,
  homePlayerId: string,
  awayPlayerId: string,
): OrientedHeadToHeadGoals {
  if (!headToHead || !isFiniteNumber(headToHead.matchesCount) || headToHead.matchesCount === 0) return null;

  const idsMatchHomeAway =
    (headToHead.playerAId === homePlayerId && headToHead.playerBId === awayPlayerId) ||
    (headToHead.playerAId === awayPlayerId && headToHead.playerBId === homePlayerId);
  if (!idsMatchHomeAway) return null;

  const homeIsPlayerA = headToHead.playerAId === homePlayerId;
  const homeGoals = homeIsPlayerA ? headToHead.playerAGoals : headToHead.playerBGoals;
  const awayGoals = homeIsPlayerA ? headToHead.playerBGoals : headToHead.playerAGoals;

  if (!isFiniteNumber(homeGoals) || !isFiniteNumber(awayGoals)) return null;

  return {
    homeGoalsAverage: homeGoals / headToHead.matchesCount,
    awayGoalsAverage: awayGoals / headToHead.matchesCount,
    matchesCount: headToHead.matchesCount,
  };
}

/** Módulo 5 (HeadToHeadEngine) — média de gols de cada lado especificamente
 * neste confronto direto, suavizada pela amostra de H2H. Desabilitável por
 * completo via `config.headToHeadEnabled`, e sempre limitada por
 * `config.maxHeadToHeadWeight` (validado em `GoalDistributionConfig.ts`). */
function buildHeadToHeadFeature(
  oriented: OrientedHeadToHeadGoals,
  weight: number,
  enabled: boolean,
  config: GoalDistributionConfig,
): GoalFeatureTrace {
  const name = "headToHead";
  if (!enabled) {
    return unavailableFeature(name, weight, "NOT_APPLICABLE", "Head-to-head signal disabled by configuration.");
  }
  if (!oriented) {
    return unavailableFeature(name, weight, "MISSING", "No head-to-head history available for this pair.");
  }

  const contributionHome = applyShrinkage(oriented.homeGoalsAverage, oriented.matchesCount, config);
  const contributionAway = applyShrinkage(oriented.awayGoalsAverage, oriented.matchesCount, config);

  return {
    name,
    rawValue: null,
    normalizedValue: null,
    weight,
    contributionHome,
    contributionAway,
    availability: "AVAILABLE",
    explanation: "Shrunk average goals scored by each side specifically in their head-to-head history.",
  };
}

/** Módulo 6 (MomentumEngine) — sinal secundário e indireto: um pequeno
 * ajuste (em gols/partida) proporcional ao momentum normalizado
 * (-100..100 -> -1..1), sempre limitado por
 * `config.maxMomentumGoalsAdjustment`. Nunca usa rating ou Green Score. */
function buildMomentumFeature(
  home: GoalDistributionPlayerInputs,
  away: GoalDistributionPlayerInputs,
  weight: number,
  config: GoalDistributionConfig,
): GoalFeatureTrace {
  const name = "momentum";
  if (
    !home.momentum ||
    !away.momentum ||
    !isFiniteNumber(home.momentum.momentumScore) ||
    !isFiniteNumber(away.momentum.momentumScore)
  ) {
    return unavailableFeature(name, weight, "MISSING", "Momentum unavailable for at least one side.");
  }

  const homeAdjustment = clamp(
    (home.momentum.momentumScore / 100) * config.maxMomentumGoalsAdjustment,
    -config.maxMomentumGoalsAdjustment,
    config.maxMomentumGoalsAdjustment,
  );
  const awayAdjustment = clamp(
    (away.momentum.momentumScore / 100) * config.maxMomentumGoalsAdjustment,
    -config.maxMomentumGoalsAdjustment,
    config.maxMomentumGoalsAdjustment,
  );

  return {
    name,
    rawValue: null,
    normalizedValue: null,
    weight,
    contributionHome: homeAdjustment,
    contributionAway: awayAdjustment,
    availability: "AVAILABLE",
    explanation: `Secondary momentum-based adjustment, capped at +-${config.maxMomentumGoalsAdjustment} goals/match.`,
  };
}

/** Módulo 7 (StrengthEngine) — sinal secundário e indireto: um pequeno
 * ajuste (em gols/partida) baseado em attackStrength/defenseStrength
 * (0..100), sempre limitado por `config.maxStrengthGoalsAdjustment`. Não
 * usa `overallStrength` (que já incorpora rating) — apenas os componentes
 * de ataque/defesa, que têm interpretação direta em termos de gols. */
function buildStrengthFeature(
  home: GoalDistributionPlayerInputs,
  away: GoalDistributionPlayerInputs,
  weight: number,
  config: GoalDistributionConfig,
): GoalFeatureTrace {
  const name = "strength";
  if (
    !home.strength ||
    !away.strength ||
    !isFiniteNumber(home.strength.attackStrength) ||
    !isFiniteNumber(home.strength.defenseStrength) ||
    !isFiniteNumber(away.strength.attackStrength) ||
    !isFiniteNumber(away.strength.defenseStrength)
  ) {
    return unavailableFeature(name, weight, "MISSING", "Strength unavailable for at least one side.");
  }

  // attackStrength/defenseStrength já estão em 0..100; 50 é o ponto neutro.
  // homeStrengthEdge > 0 significa ataque do mandante mais forte que a
  // defesa do visitante é fraca (e vice-versa).
  const homeEdge = (home.strength.attackStrength - 50 + (50 - away.strength.defenseStrength)) / 100;
  const awayEdge = (away.strength.attackStrength - 50 + (50 - home.strength.defenseStrength)) / 100;

  const homeAdjustment = clamp(homeEdge * config.maxStrengthGoalsAdjustment, -config.maxStrengthGoalsAdjustment, config.maxStrengthGoalsAdjustment);
  const awayAdjustment = clamp(awayEdge * config.maxStrengthGoalsAdjustment, -config.maxStrengthGoalsAdjustment, config.maxStrengthGoalsAdjustment);

  return {
    name,
    rawValue: null,
    normalizedValue: null,
    weight,
    contributionHome: homeAdjustment,
    contributionAway: awayAdjustment,
    availability: "AVAILABLE",
    explanation: `Secondary attack/defense-strength-based adjustment, capped at +-${config.maxStrengthGoalsAdjustment} goals/match.`,
  };
}

/**
 * Constrói, de forma determinística e pura, as cinco features do modelo a
 * partir dos resultados já calculados pelo Intelligence Engine. A mesma
 * entrada sempre produz a mesma saída, em ordem fixa: recentForm,
 * homeAwaySplit, headToHead, momentum, strength.
 */
export function buildExpectedGoalsFeatures(
  homePlayer: GoalDistributionPlayerInputs,
  awayPlayer: GoalDistributionPlayerInputs,
  headToHead: HeadToHeadResult | null,
  config: GoalDistributionConfig,
): GoalFeatureTrace[] {
  const { weights } = config;

  const recentForm = buildRecentFormFeature(homePlayer, awayPlayer, weights.recentForm, config);
  const homeAwaySplit = buildHomeAwaySplitFeature(homePlayer, awayPlayer, weights.homeAwaySplit, config);
  const orientedH2H = orientHeadToHeadGoals(headToHead, homePlayer.playerId, awayPlayer.playerId);
  const headToHeadFeature = buildHeadToHeadFeature(orientedH2H, weights.headToHead, config.headToHeadEnabled, config);
  const momentum = buildMomentumFeature(homePlayer, awayPlayer, weights.momentum, config);
  const strength = buildStrengthFeature(homePlayer, awayPlayer, weights.strength, config);

  return [recentForm, homeAwaySplit, headToHeadFeature, momentum, strength];
}
