// Fase 4 — Sprint 4.3 — Prediction Orchestrator.
// Green Score Engine: indicador consolidado 0..100 (com categoria
// LOW/MEDIUM/HIGH/VERY_HIGH) combinando a confiança de cada motor, a
// qualidade de dados combinada, a coerência entre motores e a
// confiabilidade específica dos sinais de H2H e de forma recente — os
// dois únicos sinais que existem, de forma equivalente, nos dois motores
// (Prediction Engine e Goal Distribution Engine), por isso tratados à
// parte dos demais. NÃO confundir com
// `src/services/intelligence/GreenScoreEngine.ts` (Fase 1.5, indicador de
// UM jogador) nem com `greenScoreDifference`
// (`src/services/prediction/PredictionFeatureBuilder.ts`, uma feature de
// diferença entre dois jogadores) — este módulo combina a saída de DOIS
// MOTORES inteiros desta sprint.
//
// Função pura: nenhum acesso a Prisma, rede, relógio do sistema ou número
// aleatório.

import type { MatchOutcomePrediction, PredictionFeatureTrace } from "../prediction/index.ts";
import type { GoalDistributionPrediction, GoalFeatureTrace } from "../goal-distribution/index.ts";
import type {
  DataSufficiencyStatusScores,
  GreenScoreThresholds,
  GreenScoreWeights,
} from "./PredictionOrchestratorConfig.ts";
import type { ConsistencyAssessment, DataQualityAssessment, GreenScoreAssessment, GreenScoreCategory } from "./types.ts";
import { clamp } from "./types.ts";

function featureAvailabilityScore(featureTrace: { name: string; availability: string }[], name: string): number {
  const feature = featureTrace.find((candidate) => candidate.name === name);
  return feature && feature.availability === "AVAILABLE" ? 100 : 0;
}

/** Confiabilidade do sinal de H2H: média entre a disponibilidade da
 * feature `headToHead` do Prediction Engine e da feature `headToHead` do
 * Goal Distribution Engine (0, 50 ou 100). */
function headToHeadReliability(
  predictionFeatures: PredictionFeatureTrace[],
  goalDistributionFeatures: GoalFeatureTrace[],
): number {
  return (
    (featureAvailabilityScore(predictionFeatures, "headToHead") + featureAvailabilityScore(goalDistributionFeatures, "headToHead")) / 2
  );
}

/** Confiabilidade do sinal de forma recente: média entre a
 * disponibilidade de `formDifference` (Prediction Engine) e `recentForm`
 * (Goal Distribution Engine). */
function formReliability(predictionFeatures: PredictionFeatureTrace[], goalDistributionFeatures: GoalFeatureTrace[]): number {
  return (
    (featureAvailabilityScore(predictionFeatures, "formDifference") + featureAvailabilityScore(goalDistributionFeatures, "recentForm")) / 2
  );
}

export function classifyGreenScore(score: number, thresholds: GreenScoreThresholds): GreenScoreCategory {
  if (score <= thresholds.lowMax) return "LOW";
  if (score <= thresholds.mediumMax) return "MEDIUM";
  if (score <= thresholds.highMax) return "HIGH";
  return "VERY_HIGH";
}

/**
 * Calcula o Green Score combinado (0..100) e sua categoria. Componentes,
 * combinados por média ponderada (pesos renormalizados pela soma
 * configurada): confiança do Prediction Engine, confiança do Goal
 * Distribution Engine (ambas via `dataSufficiency.status` convertido em
 * pontuação), `dataQuality.combinedStatus` (idem), confiabilidade de H2H
 * e confiabilidade de forma. O ajuste de `ConsistencyAssessment` é somado
 * por fora, com o resultado final sempre limitado a `[0, 100]`.
 */
export function computeGreenScore(
  prediction: MatchOutcomePrediction,
  goalDistribution: GoalDistributionPrediction,
  dataQuality: DataQualityAssessment,
  consistency: ConsistencyAssessment,
  weights: GreenScoreWeights,
  statusScores: DataSufficiencyStatusScores,
  thresholds: GreenScoreThresholds,
): GreenScoreAssessment {
  const predictionConfidence = statusScores[prediction.dataSufficiency.status];
  const goalDistributionConfidence = statusScores[goalDistribution.dataSufficiency.status];
  const dataQualityScore = statusScores[dataQuality.combinedStatus];
  const h2hReliability = headToHeadReliability(prediction.featureTrace, goalDistribution.featureTrace);
  const formSignalReliability = formReliability(prediction.featureTrace, goalDistribution.featureTrace);

  const weightSum =
    weights.predictionConfidence + weights.goalDistributionConfidence + weights.dataQuality + weights.headToHeadReliability + weights.formReliability;

  const baseScore =
    weightSum > 0
      ? (weights.predictionConfidence * predictionConfidence +
          weights.goalDistributionConfidence * goalDistributionConfidence +
          weights.dataQuality * dataQualityScore +
          weights.headToHeadReliability * h2hReliability +
          weights.formReliability * formSignalReliability) /
        weightSum
      : 0;

  const score = clamp(Math.round(baseScore + consistency.adjustment), 0, 100);
  return { score, category: classifyGreenScore(score, thresholds) };
}
