// Fase 4 — Sprint 4.2 — Goal Distribution Engine Foundation.
// Módulo principal: orquestra Expected Goals Engine + Poisson Distribution
// + Score Matrix Engine + Goal Markets Engine + Data Sufficiency para
// produzir uma distribuição de gols completa, determinística e
// explicável. Não gera nenhuma recomendação de aposta, EV, Kelly ou
// gestão de banca — apenas probabilidades de mercado.
//
// Determinismo: para a mesma `request`/`config`, o resultado numérico é
// sempre idêntico. `now` é injetável e usado apenas para preencher
// `generatedAt` — nunca para influenciar probabilidades, pesos ou
// suficiência de dados. `request.predictionContext` (Sprint 4.1, opcional)
// nunca é lido por este módulo — variar seu valor nunca altera nenhum
// número desta previsão (testado explicitamente).

import { computeExpectedGoals } from "./ExpectedGoalsEngine.ts";
import { evaluateGoalDistributionDataSufficiency } from "./GoalDistributionDataSufficiency.ts";
import { buildPoissonDistribution } from "./PoissonDistribution.ts";
import { buildScoreMatrix, extractExactScores, rankExactScores } from "./ScoreMatrixEngine.ts";
import { computeBothTeamsToScore, computeOverUnder, computeScoreDerivedOutcomeProbabilities } from "./GoalMarketsEngine.ts";
import {
  DEFAULT_GOAL_DISTRIBUTION_CONFIG,
  validateGoalDistributionConfig,
  type GoalDistributionConfig,
} from "./GoalDistributionConfig.ts";
import type { GoalDistributionPrediction, GoalDistributionRequest } from "./types.ts";

export function predictGoalDistribution(
  request: GoalDistributionRequest,
  config: GoalDistributionConfig = DEFAULT_GOAL_DISTRIBUTION_CONFIG,
  now: () => Date = () => new Date(),
): GoalDistributionPrediction {
  validateGoalDistributionConfig(config);

  const { homePlayer, awayPlayer, headToHead } = request;

  const { expectedGoals, featureTrace, warnings } = computeExpectedGoals(
    homePlayer,
    awayPlayer,
    headToHead,
    config,
  );

  const dataSufficiency = evaluateGoalDistributionDataSufficiency(homePlayer, awayPlayer, headToHead, config);

  const homeGoalDistribution = buildPoissonDistribution(expectedGoals.home, config.maxGoalsPerPlayer, config.minLambda, config.maxLambda);
  const awayGoalDistribution = buildPoissonDistribution(expectedGoals.away, config.maxGoalsPerPlayer, config.minLambda, config.maxLambda);

  const matrix = buildScoreMatrix(homeGoalDistribution, awayGoalDistribution);
  const exactScores = extractExactScores(matrix);
  const rankedScores = rankExactScores(exactScores, exactScores.length);
  const topExactScores = rankedScores.slice(0, config.defaultTopExactScores);
  const topExactScoresAggregateProbability = topExactScores.reduce((sum, score) => sum + score.probability, 0);
  const mostLikelyScore = rankedScores[0];

  const overUnder = computeOverUnder(matrix, config.overUnderLines);
  const bothTeamsToScore = computeBothTeamsToScore(matrix);
  const scoreDerivedOutcomeProbabilities = computeScoreDerivedOutcomeProbabilities(matrix);

  return {
    modelVersion: config.modelVersion,
    generatedAt: now().toISOString(),
    expectedGoals,
    homeGoalDistribution,
    awayGoalDistribution,
    exactScores,
    mostLikelyScore,
    topExactScores,
    topExactScoresAggregateProbability,
    overUnder,
    bothTeamsToScore,
    scoreDerivedOutcomeProbabilities,
    dataSufficiency,
    featureTrace,
    warnings,
  };
}
