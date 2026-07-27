// Fase 4 — Sprint 4.3 — Prediction Orchestrator.
// Prediction Explanation: gera um objeto estruturado de sinais mais
// relevantes (`topSignals`) a partir dos feature traces já produzidos
// pelo Prediction Engine (Sprint 4.1) e pelo Goal Distribution Engine
// (Sprint 4.2) — nunca recalcula nada, apenas reempacota e classifica o
// que os dois motores já expõem. Nenhum texto em linguagem natural é
// gerado — apenas dados estruturados (`type`, `source`, `favors`,
// `magnitude`), como exigido pela missão desta sprint.
//
// Função pura: nenhum acesso a Prisma, rede, relógio do sistema ou número
// aleatório.

import type { MatchOutcomePrediction } from "../prediction/index.ts";
import type { GoalDistributionPrediction } from "../goal-distribution/index.ts";
import type { PredictionExplanationConfig } from "./PredictionOrchestratorConfig.ts";
import type { PredictionExplanationResult, PredictionSignal, PredictionSignalFavors, PredictionSignalType } from "./types.ts";
import { clamp } from "./types.ts";

const MAGNITUDE_EPSILON = 0.001;

/** Sinal a partir de uma feature direcional do Prediction Engine
 * (`normalizedValue` já em -1..1; `contribution` decide o sinal). */
function fromPredictionFeature(
  featureTrace: MatchOutcomePrediction["featureTrace"],
  featureName: string,
  signalType: PredictionSignalType,
): PredictionSignal | null {
  const feature = featureTrace.find((candidate) => candidate.name === featureName);
  if (!feature || feature.availability !== "AVAILABLE" || feature.normalizedValue === null) return null;

  const magnitude = clamp(Math.abs(feature.normalizedValue), 0, 1);
  if (magnitude <= MAGNITUDE_EPSILON) return null;

  const favors: PredictionSignalFavors = feature.contribution > 0 ? "HOME" : feature.contribution < 0 ? "AWAY" : "NEUTRAL";
  if (favors === "NEUTRAL") return null;

  return { type: signalType, source: "PREDICTION_ENGINE", favors, magnitude };
}

/** Sinal a partir de uma feature bidirecional do Goal Distribution Engine
 * (`contributionHome`/`contributionAway`, sem `normalizedValue` único —
 * ver `docs/ESOCER_GOAL_DISTRIBUTION_ENGINE_PHASE_4_2.md`). A magnitude é
 * a diferença absoluta entre os dois lados, normalizada por
 * `config.magnitudeReferenceScale` (gols/partida). */
function fromGoalDistributionFeature(
  featureTrace: GoalDistributionPrediction["featureTrace"],
  featureName: string,
  signalType: PredictionSignalType,
  magnitudeReferenceScale: number,
): PredictionSignal | null {
  const feature = featureTrace.find((candidate) => candidate.name === featureName);
  if (!feature || feature.availability !== "AVAILABLE") return null;

  const rawDelta = feature.contributionHome - feature.contributionAway;
  const magnitude = clamp(Math.abs(rawDelta) / magnitudeReferenceScale, 0, 1);
  if (magnitude <= MAGNITUDE_EPSILON) return null;

  const favors: PredictionSignalFavors = rawDelta > 0 ? "HOME" : rawDelta < 0 ? "AWAY" : "NEUTRAL";
  if (favors === "NEUTRAL") return null;

  return { type: signalType, source: "GOAL_DISTRIBUTION_ENGINE", favors, magnitude };
}

function scoringTrendSignal(
  goalDistribution: GoalDistributionPrediction,
  config: PredictionExplanationConfig,
): PredictionSignal | null {
  const total = goalDistribution.expectedGoals.total;
  if (total >= config.highScoringTotalGoalsThreshold) {
    const magnitude = clamp((total - config.highScoringTotalGoalsThreshold) / config.highScoringTotalGoalsThreshold, 0, 1);
    return { type: "HIGH_SCORING_TREND", source: "GOAL_DISTRIBUTION_ENGINE", favors: "NEUTRAL", magnitude: Math.max(magnitude, MAGNITUDE_EPSILON * 2) };
  }
  if (total <= config.lowScoringTotalGoalsThreshold) {
    const magnitude = clamp((config.lowScoringTotalGoalsThreshold - total) / config.lowScoringTotalGoalsThreshold, 0, 1);
    return { type: "LOW_SCORING_TREND", source: "GOAL_DISTRIBUTION_ENGINE", favors: "NEUTRAL", magnitude: Math.max(magnitude, MAGNITUDE_EPSILON * 2) };
  }
  return null;
}

/**
 * Constrói a explicação estruturada: coleta todos os sinais candidatos
 * dos dois motores, descarta os de magnitude desprezível ou sem direção,
 * ordena por magnitude decrescente (ordem de construção fixa garante
 * desempate determinístico — `Array.prototype.sort` é estável desde
 * ES2019) e devolve os `topSignalsCount` primeiros.
 */
export function buildPredictionExplanation(
  prediction: MatchOutcomePrediction,
  goalDistribution: GoalDistributionPrediction,
  config: PredictionExplanationConfig,
): PredictionExplanationResult {
  const candidates: PredictionSignal[] = [];

  const predictionSignalMap: [string, PredictionSignalType][] = [
    ["ratingDifference", "RATING_ADVANTAGE"],
    ["formDifference", "FORM_ADVANTAGE"],
    ["strengthDifference", "STRENGTH_ADVANTAGE"],
    ["momentumDifference", "MOMENTUM_ADVANTAGE"],
    ["homeAdvantage", "HOME_FIELD_ADVANTAGE"],
    ["headToHead", "HEAD_TO_HEAD_ADVANTAGE"],
    ["greenScoreDifference", "GREEN_SCORE_ADVANTAGE"],
  ];
  for (const [featureName, signalType] of predictionSignalMap) {
    const signal = fromPredictionFeature(prediction.featureTrace, featureName, signalType);
    if (signal) candidates.push(signal);
  }

  const goalDistributionSignalMap: [string, PredictionSignalType][] = [
    ["recentForm", "GOAL_EXPECTATION_ADVANTAGE"],
    ["homeAwaySplit", "GOAL_EXPECTATION_ADVANTAGE"],
    ["headToHead", "HEAD_TO_HEAD_ADVANTAGE"],
    ["momentum", "MOMENTUM_ADVANTAGE"],
    ["strength", "STRENGTH_ADVANTAGE"],
  ];
  for (const [featureName, signalType] of goalDistributionSignalMap) {
    const signal = fromGoalDistributionFeature(goalDistribution.featureTrace, featureName, signalType, config.magnitudeReferenceScale);
    if (signal) candidates.push(signal);
  }

  const trendSignal = scoringTrendSignal(goalDistribution, config);
  if (trendSignal) candidates.push(trendSignal);

  const ranked = [...candidates].sort((a, b) => b.magnitude - a.magnitude);

  return {
    topSignals: ranked.slice(0, config.topSignalsCount),
    totalSignalsConsidered: candidates.length,
  };
}
