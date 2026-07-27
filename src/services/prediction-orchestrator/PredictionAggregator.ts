// Fase 4 — Sprint 4.3 — Prediction Orchestrator.
// Prediction Aggregator: recebe a saída do Prediction Engine (Sprint 4.1)
// e do Goal Distribution Engine (Sprint 4.2) já calculadas e produz um
// `FinalPrediction` — um resumo plano combinando os dois motores através
// da Consistency Engine, da Confidence Engine e da Green Score Engine
// desta sprint. Nunca recalcula nada dos dois motores originais, apenas
// os combina. Função pura: nenhum acesso a Prisma, rede, relógio do
// sistema ou número aleatório.

import type { MatchOutcomePrediction } from "../prediction/index.ts";
import type { GoalDistributionPrediction } from "../goal-distribution/index.ts";
import { evaluateConsistency } from "./ConsistencyEngine.ts";
import { computeConfidenceScore } from "./ConfidenceEngine.ts";
import { computeGreenScore } from "./GreenScoreEngine.ts";
import type { PredictionOrchestratorConfig } from "./PredictionOrchestratorConfig.ts";
import type { DataQualityAssessment, DataSufficiencyStatus, FinalPrediction } from "./types.ts";

const STATUS_RANK: Record<DataSufficiencyStatus, number> = {
  INSUFFICIENT: 0,
  LIMITED: 1,
  SUFFICIENT: 2,
  STRONG: 3,
};

/** O mais conservador (rank mais baixo) entre os dois status — nunca
 * otimista quando um dos dois motores está incerto. */
function moreConservativeStatus(a: DataSufficiencyStatus, b: DataSufficiencyStatus): DataSufficiencyStatus {
  return STATUS_RANK[a] <= STATUS_RANK[b] ? a : b;
}

/**
 * Combina o Prediction Engine e o Goal Distribution Engine em um único
 * `FinalPrediction`. `winner` e `outcomeProbabilities` vêm sempre do
 * Prediction Engine (autoritativo para o mercado 1X2); o resultado 1X2
 * derivado da matriz de gols permanece disponível apenas dentro do objeto
 * `goalDistribution` bruto de `PredictionResult`, nunca combinado aqui.
 */
export function aggregate(
  prediction: MatchOutcomePrediction,
  goalDistribution: GoalDistributionPrediction,
  config: PredictionOrchestratorConfig,
): FinalPrediction {
  const consistency = evaluateConsistency(prediction, goalDistribution, config.consistencyThresholds, config.consistencyAdjustments);

  const dataQuality: DataQualityAssessment = {
    predictionDataSufficiency: prediction.dataSufficiency.status,
    goalDistributionDataSufficiency: goalDistribution.dataSufficiency.status,
    combinedStatus: moreConservativeStatus(prediction.dataSufficiency.status, goalDistribution.dataSufficiency.status),
    consistency,
  };

  const confidence = computeConfidenceScore(
    prediction,
    goalDistribution,
    consistency,
    config.confidenceWeights,
    config.dataSufficiencyStatusScores,
  );

  const greenScore = computeGreenScore(
    prediction,
    goalDistribution,
    dataQuality,
    consistency,
    config.greenScoreWeights,
    config.dataSufficiencyStatusScores,
    config.greenScoreThresholds,
  );

  const warnings = [
    ...new Set([
      ...prediction.dataSufficiency.warnings,
      ...goalDistribution.dataSufficiency.warnings,
      ...goalDistribution.warnings,
      ...(consistency.level === "MAJOR_DIVERGENCE" ? ["cross_model_major_divergence"] : []),
    ]),
  ];

  return {
    winner: prediction.predictedOutcome,
    confidence,
    greenScore,
    expectedGoals: goalDistribution.expectedGoals,
    exactScores: goalDistribution.topExactScores,
    bothTeamsToScore: goalDistribution.bothTeamsToScore,
    overUnder: goalDistribution.overUnder,
    outcomeProbabilities: prediction.probabilities,
    dataQuality,
    warnings,
    modelVersions: {
      prediction: prediction.modelVersion,
      goalDistribution: goalDistribution.modelVersion,
      orchestrator: config.modelVersion,
    },
  };
}
