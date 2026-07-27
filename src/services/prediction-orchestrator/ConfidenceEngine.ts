// Fase 4 — Sprint 4.3 — Prediction Orchestrator.
// Confidence Engine: combina a confiança do Prediction Engine (Sprint
// 4.1), a confiança do Goal Distribution Engine (Sprint 4.2), a
// quantidade de sinais disponíveis nos dois motores e a coerência entre
// eles (Consistency Engine) em um único score 0..100. Determinístico, sem
// machine learning. NÃO confundir com
// `src/services/intelligence/ConfidenceEngine.ts` (Fase 1.5, confiança
// por tamanho de amostra de UM jogador) — este módulo combina a saída de
// DOIS motores inteiros, não estatísticas de um jogador.
//
// Função pura: nenhum acesso a Prisma, rede, relógio do sistema ou número
// aleatório.

import type { MatchOutcomePrediction } from "../prediction/index.ts";
import type { GoalDistributionPrediction } from "../goal-distribution/index.ts";
import type { ConfidenceWeights, DataSufficiencyStatusScores } from "./PredictionOrchestratorConfig.ts";
import type { ConsistencyAssessment } from "./types.ts";
import { clamp } from "./types.ts";

/** Converte um `DataSufficiencyStatus` (Sprints 4.1/4.2) em uma pontuação
 * 0..100, segundo a tabela configurada — nunca inventa confiança para um
 * status que a tabela não cobre (TypeScript já garante exaustividade do
 * enum). */
function statusScore(status: keyof DataSufficiencyStatusScores, scores: DataSufficiencyStatusScores): number {
  return scores[status];
}

function countAvailable(featureTrace: { availability: string }[]): number {
  return featureTrace.filter((feature) => feature.availability === "AVAILABLE").length;
}

/**
 * Calcula o score de confiança combinado (0..100). Componentes:
 *
 * - `predictionConfidence`: `dataSufficiency.status` do Prediction Engine,
 *   convertido em pontuação pela tabela configurada.
 * - `goalDistributionConfidence`: idem, para o Goal Distribution Engine.
 * - `signalCount`: proporção de features `AVAILABLE` entre as 8 do
 *   Prediction Engine e as 5 do Goal Distribution Engine (13 no total).
 *
 * Os três componentes são combinados por média ponderada (pesos
 * renormalizados pela soma configurada — nunca assume que os pesos somam
 * exatamente 1), e o ajuste de `ConsistencyAssessment` (bônus/penalidade
 * assinado) é somado por fora, com o resultado final sempre limitado a
 * `[0, 100]`.
 */
export function computeConfidenceScore(
  prediction: MatchOutcomePrediction,
  goalDistribution: GoalDistributionPrediction,
  consistency: ConsistencyAssessment,
  weights: ConfidenceWeights,
  statusScores: DataSufficiencyStatusScores,
): number {
  const predictionConfidence = statusScore(prediction.dataSufficiency.status, statusScores);
  const goalDistributionConfidence = statusScore(goalDistribution.dataSufficiency.status, statusScores);

  const totalPossibleSignals = prediction.featureTrace.length + goalDistribution.featureTrace.length;
  const availableSignals = countAvailable(prediction.featureTrace) + countAvailable(goalDistribution.featureTrace);
  const signalCountScore = totalPossibleSignals > 0 ? (availableSignals / totalPossibleSignals) * 100 : 0;

  const weightSum = weights.predictionConfidence + weights.goalDistributionConfidence + weights.signalCount;
  const baseConfidence =
    weightSum > 0
      ? (weights.predictionConfidence * predictionConfidence +
          weights.goalDistributionConfidence * goalDistributionConfidence +
          weights.signalCount * signalCountScore) /
        weightSum
      : 0;

  return clamp(Math.round(baseConfidence + consistency.adjustment), 0, 100);
}
