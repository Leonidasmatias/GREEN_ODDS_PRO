// Fase 4 — Sprint 4.3 — Prediction Orchestrator.
// Consistency Engine: verifica a coerência entre o Prediction Engine
// (Sprint 4.1) e o resultado 1X2 derivado da matriz de gols do Goal
// Distribution Engine (Sprint 4.2), produzindo um `ConsistencyAssessment`
// consumido tanto pela Confidence Engine quanto pela Green Score Engine
// desta sprint — motivo pelo qual este algoritmo vive em um módulo
// próprio (não listado explicitamente na missão, mas necessário para não
// duplicar a mesma lógica em dois lugares; ver Seção "Arquitetura" do
// relatório final da Sprint 4.3). NÃO confundir com
// `src/services/intelligence/ConfidenceEngine.ts` (Fase 1.5) — mesmo
// diretório de nível superior, responsabilidade completamente diferente.
//
// Função pura: nenhum acesso a Prisma, rede, relógio do sistema ou número
// aleatório. Nunca gera EV, Kelly, stake ou recomendação de aposta —
// apenas um score de coerência entre dois modelos estatísticos.

import type { MatchOutcomePrediction } from "../prediction/index.ts";
import type { GoalDistributionPrediction, ScoreDerivedOutcomeProbabilities } from "../goal-distribution/index.ts";
import type { ConsistencyThresholds, ConsistencyAdjustments } from "./PredictionOrchestratorConfig.ts";
import type { ConsistencyAssessment, MatchOutcome } from "./types.ts";

/**
 * Escolhe o resultado com a maior probabilidade entre as três, com a
 * mesma regra de desempate explícita e determinística já usada pelo
 * Prediction Engine (Sprint 4.1): HOME_WIN > DRAW > AWAY_WIN quando há
 * empate exato entre as maiores probabilidades.
 */
function pickWinner(probabilities: ScoreDerivedOutcomeProbabilities): MatchOutcome {
  const { homeWin, draw, awayWin } = probabilities;
  if (homeWin >= draw && homeWin >= awayWin) return "HOME_WIN";
  if (draw >= awayWin) return "DRAW";
  return "AWAY_WIN";
}

/**
 * Maior divergência absoluta entre as probabilidades correspondentes dos
 * dois motores (homeWin/draw/awayWin), usada como métrica única e
 * conservadora de desacordo — captura o pior descompasso entre os três
 * componentes, não apenas o de vitória do mandante.
 */
function maxProbabilityDelta(
  predictionProbabilities: MatchOutcomePrediction["probabilities"],
  goalDistributionProbabilities: ScoreDerivedOutcomeProbabilities,
): number {
  return Math.max(
    Math.abs(predictionProbabilities.homeWin - goalDistributionProbabilities.homeWin),
    Math.abs(predictionProbabilities.draw - goalDistributionProbabilities.draw),
    Math.abs(predictionProbabilities.awayWin - goalDistributionProbabilities.awayWin),
  );
}

/**
 * Avalia a coerência entre os dois motores. Exemplos documentados na
 * missão desta sprint:
 *
 * - Prediction Home 80% vs Goal Distribution (derivado) Away 60%:
 *   vencedores diferentes e delta grande -> `MAJOR_DIVERGENCE`, penalidade.
 * - Prediction Home 61% vs Goal Distribution Home 59%: mesmo vencedor e
 *   delta pequeno -> `ALIGNED`, bônus.
 *
 * Quando os vencedores coincidem mas o delta é maior que
 * `alignedThreshold`, o resultado permanece `ALIGNED` (os motores
 * concordam no resultado) porém sem bônus (`adjustment = 0`) — a
 * discordância de magnitude, sem discordância de vencedor, não é tratada
 * como uma divergência real.
 */
export function evaluateConsistency(
  prediction: MatchOutcomePrediction,
  goalDistribution: GoalDistributionPrediction,
  thresholds: ConsistencyThresholds,
  adjustments: ConsistencyAdjustments,
): ConsistencyAssessment {
  const predictionWinner = prediction.predictedOutcome;
  const goalDistributionWinner = pickWinner(goalDistribution.scoreDerivedOutcomeProbabilities);
  const matchingWinner = predictionWinner === goalDistributionWinner;
  const delta = maxProbabilityDelta(prediction.probabilities, goalDistribution.scoreDerivedOutcomeProbabilities);

  if (matchingWinner) {
    if (delta <= thresholds.alignedThreshold) {
      return { level: "ALIGNED", matchingWinner, maxProbabilityDelta: delta, adjustment: adjustments.alignedBonus };
    }
    return { level: "ALIGNED", matchingWinner, maxProbabilityDelta: delta, adjustment: 0 };
  }

  if (delta >= thresholds.majorDivergenceThreshold) {
    return { level: "MAJOR_DIVERGENCE", matchingWinner, maxProbabilityDelta: delta, adjustment: -adjustments.majorDivergencePenalty };
  }
  return { level: "MINOR_DIVERGENCE", matchingWinner, maxProbabilityDelta: delta, adjustment: -adjustments.minorDivergencePenalty };
}
