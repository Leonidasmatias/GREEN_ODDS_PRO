// Fase 5 — Sprint 5.2 — Adaptive Intelligence & Recommendation Framework.
// Risk Assessment Engine: mapeia cada `Recommendation` para um nível de
// risco base (`config.riskLevelByRecommendation`), escalado em um degrau
// quando o score de confiabilidade do perfil está abaixo de
// `config.riskReliabilityFloor` — nunca recalcula métricas. Função pura:
// nenhum acesso a Prisma, rede, relógio do sistema ou número aleatório.

import { reliabilityScoreFor } from "./types.ts";
import type { PredictionAdaptationConfig } from "./PredictionAdaptationConfig.ts";
import type { Recommendation, ReliabilityRanking, RiskAssessment, RiskLevel } from "./types.ts";

const RISK_TIER_ORDER: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/** Escala um nível de risco em exatamente um degrau — nunca além de `CRITICAL`. */
function escalate(level: RiskLevel): RiskLevel {
  const index = RISK_TIER_ORDER.indexOf(level);
  return RISK_TIER_ORDER[Math.min(index + 1, RISK_TIER_ORDER.length - 1)];
}

/**
 * Constrói exatamente um `RiskAssessment` por `Recommendation`, na mesma
 * ordem. `reliabilityScore` é `null` quando nenhuma entrada de ranking
 * corresponde à dimensão+chave (nunca fabricado como `0`).
 */
export function buildRiskAssessments(
  recommendations: Recommendation[],
  reliabilityRanking: ReliabilityRanking,
  config: PredictionAdaptationConfig,
): RiskAssessment[] {
  return recommendations.map((recommendation) => {
    const reliabilityScore = reliabilityScoreFor(reliabilityRanking, recommendation.dimension, recommendation.key);
    const baseLevel = config.riskLevelByRecommendation[recommendation.type];
    const level = reliabilityScore !== null && reliabilityScore < config.riskReliabilityFloor ? escalate(baseLevel) : baseLevel;
    return { dimension: recommendation.dimension, key: recommendation.key, level, reliabilityScore };
  });
}
