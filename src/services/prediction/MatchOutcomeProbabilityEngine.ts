// Fase 4 — Sprint 4.1 — Prediction Engine Foundation.
// Módulo principal: orquestra Feature Builder + Data Sufficiency +
// Normalizer para produzir uma previsão de resultado 1X2 completa,
// determinística e explicável. Esta sprint cobre exclusivamente
// HOME_WIN/DRAW/AWAY_WIN — mercados de gols (Over/Under, BTTS, Expected
// Goals) pertencem à Sprint 4.2 (Goal Distribution Engine) e não são
// calculados aqui.
//
// Determinismo: para a mesma `request`/`config`, o resultado numérico é
// sempre idêntico. `now` é injetável e usado apenas para preencher
// `generatedAt` — nunca para influenciar probabilidades, pesos ou
// suficiência de dados.

import { buildPredictionFeatures } from "./PredictionFeatureBuilder.ts";
import { evaluateDataSufficiency } from "./PredictionDataSufficiency.ts";
import { computeOutcomeProbabilities } from "./PredictionNormalizer.ts";
import {
  DEFAULT_PREDICTION_MODEL_CONFIG,
  validatePredictionModelConfig,
  type PredictionModelConfig,
} from "./PredictionModelConfig.ts";
import type { MatchOutcome, MatchOutcomePrediction, MatchOutcomePredictionRequest, PredictionFeatureTrace } from "./types.ts";

const DRAW_BALANCE_FEATURE_NAME = "drawBalance";

function sumHomeAwayTilt(featureTrace: PredictionFeatureTrace[]): number {
  return featureTrace
    .filter((feature) => feature.name !== DRAW_BALANCE_FEATURE_NAME)
    .reduce((sum, feature) => sum + feature.contribution, 0);
}

function drawContribution(featureTrace: PredictionFeatureTrace[]): number {
  const drawFeature = featureTrace.find((feature) => feature.name === DRAW_BALANCE_FEATURE_NAME);
  return drawFeature ? drawFeature.contribution : 0;
}

/**
 * Escolhe o resultado previsto a partir das três probabilidades. Regra de
 * desempate explícita e determinística quando há empate exato entre as
 * maiores probabilidades: HOME_WIN tem prioridade sobre DRAW, que tem
 * prioridade sobre AWAY_WIN. Esta ordem é arbitrária (não há fundamento
 * estatístico para preferir um lado em um empate perfeito) mas fixa e
 * documentada, exigida sempre que os três (ou dois) valores coincidem
 * exatamente — o caso mais comum sendo ausência total de dados dos dois
 * jogadores (thirds exatos, ver `docs/ESOCER_PREDICTION_ENGINE_PHASE_4_1.md`).
 */
function pickPredictedOutcome(probabilities: { homeWin: number; draw: number; awayWin: number }): MatchOutcome {
  const { homeWin, draw, awayWin } = probabilities;
  if (homeWin >= draw && homeWin >= awayWin) return "HOME_WIN";
  if (draw >= awayWin) return "DRAW";
  return "AWAY_WIN";
}

export function predictMatchOutcome(
  request: MatchOutcomePredictionRequest,
  config: PredictionModelConfig = DEFAULT_PREDICTION_MODEL_CONFIG,
  now: () => Date = () => new Date(),
): MatchOutcomePrediction {
  validatePredictionModelConfig(config);

  const featureTrace = buildPredictionFeatures(request, config);
  const dataSufficiency = evaluateDataSufficiency(request, featureTrace, config);

  const homeLogit = sumHomeAwayTilt(featureTrace);
  const awayLogit = -homeLogit;
  const drawLogit = drawContribution(featureTrace);

  const temperature = config.temperature;
  const probabilities = computeOutcomeProbabilities({
    home: homeLogit / temperature,
    draw: drawLogit / temperature,
    away: awayLogit / temperature,
  });

  const predictedOutcome = pickPredictedOutcome(probabilities);
  const sortedProbabilities = [probabilities.homeWin, probabilities.draw, probabilities.awayWin].sort((a, b) => b - a);
  const topProbability = sortedProbabilities[0];
  const probabilityMargin = topProbability - sortedProbabilities[1];

  return {
    modelVersion: config.modelVersion,
    generatedAt: now().toISOString(),
    probabilities,
    predictedOutcome,
    topProbability,
    probabilityMargin,
    dataSufficiency,
    featureTrace,
  };
}
