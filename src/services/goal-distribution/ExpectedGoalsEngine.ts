// Fase 4 — Sprint 4.2 — Goal Distribution Engine Foundation.
// Expected Goals Engine: combina as cinco features produzidas pelo
// Expected Goals Feature Builder em um lambda final por lado (mandante e
// visitante), aplicando o mesmo padrão de redistribuição de peso entre
// features disponíveis já usado por `GreenScoreEngine`/`drawBalance`
// (Fase 1.5 / Sprint 4.1) quando alguma feature está ausente. Quando
// NENHUMA feature está disponível (ex.: os dois jogadores são estreantes),
// ou quando as features disponíveis têm peso efetivo zero, aplica o
// fallback conservador de `config.fallbackBaseGoalsPerPlayer` — nunca zero
// absoluto. Função pura: nenhum acesso a Prisma, rede ou relógio do
// sistema.

import { buildExpectedGoalsFeatures } from "./ExpectedGoalsFeatureBuilder.ts";
import type { GoalDistributionConfig } from "./GoalDistributionConfig.ts";
import type { ExpectedGoals, GoalDistributionPlayerInputs, GoalFeatureTrace, HeadToHeadResult } from "./types.ts";
import { clamp } from "./types.ts";

export type ExpectedGoalsComputation = {
  expectedGoals: ExpectedGoals;
  featureTrace: GoalFeatureTrace[];
  warnings: string[];
};

/**
 * Combina as contribuições de todas as features `AVAILABLE` em uma média
 * ponderada, renormalizando os pesos sobre o subconjunto disponível (peso
 * de uma feature ausente é redistribuído proporcionalmente entre as
 * demais, nunca descartado silenciosamente nem tratado como zero
 * definitivo do modelo).
 */
function weightedAverageOfAvailable(
  featureTrace: GoalFeatureTrace[],
  pick: (feature: GoalFeatureTrace) => number,
): number | null {
  const available = featureTrace.filter((feature) => feature.availability === "AVAILABLE");
  const totalWeight = available.reduce((sum, feature) => sum + feature.weight, 0);
  if (available.length === 0 || totalWeight <= 0) return null;

  const weightedSum = available.reduce((sum, feature) => sum + feature.weight * pick(feature), 0);
  return weightedSum / totalWeight;
}

/**
 * Calcula `expectedGoals` (mandante, visitante, total) a partir do
 * histórico já calculado pelo Intelligence Engine, com rastreabilidade
 * completa e fallback conservador documentado.
 */
export function computeExpectedGoals(
  homePlayer: GoalDistributionPlayerInputs,
  awayPlayer: GoalDistributionPlayerInputs,
  headToHead: HeadToHeadResult | null,
  config: GoalDistributionConfig,
): ExpectedGoalsComputation {
  const featureTrace = buildExpectedGoalsFeatures(homePlayer, awayPlayer, headToHead, config);
  const warnings: string[] = [];

  const rawHome = weightedAverageOfAvailable(featureTrace, (feature) => feature.contributionHome);
  const rawAway = weightedAverageOfAvailable(featureTrace, (feature) => feature.contributionAway);

  let home: number;
  let away: number;

  if (rawHome === null || rawAway === null) {
    warnings.push("fallback_conservative_baseline_applied");
    home = config.fallbackBaseGoalsPerPlayer;
    away = config.fallbackBaseGoalsPerPlayer;
  } else {
    home = rawHome;
    away = rawAway;
  }

  home = clamp(home, config.minLambda, config.maxLambda);
  away = clamp(away, config.minLambda, config.maxLambda);

  return {
    expectedGoals: { home, away, total: home + away },
    featureTrace,
    warnings,
  };
}
