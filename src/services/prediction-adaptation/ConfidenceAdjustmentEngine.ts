// Fase 5 — Sprint 5.2 — Adaptive Intelligence & Recommendation Framework.
// Confidence Adjustment Engine: mapeia cada `Recommendation` (já
// classificada por `RecommendationEngine`) para um fator de confiança
// sugerido via `config.confidenceMultipliers` — nunca reclassifica, nunca
// aplica o fator a uma previsão real. Função pura: nenhum acesso a
// Prisma, rede, relógio do sistema ou número aleatório.

import type { PredictionAdaptationConfig } from "./PredictionAdaptationConfig.ts";
import type { ConfidenceAdjustment, Recommendation } from "./types.ts";

/**
 * Constrói exatamente um `ConfidenceAdjustment` por `Recommendation`, na
 * mesma ordem. `suggestedMultiplier` é puramente informativo — nunca
 * aplicado automaticamente às probabilidades de uma previsão.
 */
export function buildConfidenceAdjustments(
  recommendations: Recommendation[],
  config: PredictionAdaptationConfig,
): ConfidenceAdjustment[] {
  return recommendations.map((recommendation) => ({
    dimension: recommendation.dimension,
    key: recommendation.key,
    recommendationType: recommendation.type,
    suggestedMultiplier: config.confidenceMultipliers[recommendation.type],
  }));
}
