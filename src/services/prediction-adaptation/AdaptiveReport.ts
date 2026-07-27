// Fase 5 — Sprint 5.2 — Adaptive Intelligence & Recommendation Framework.
// Módulo principal: orquestra `RecommendationEngine` + `StrategyEngine` +
// `ConfidenceAdjustmentEngine` + `RiskAssessmentEngine` em um único
// `AdaptiveReport` serializável, a partir de um `LearningReport` (Sprint
// 5.1) já calculado — a ÚNICA integração cross-sprint deste módulo. Nunca
// lê `Date.now()`/relógio do sistema, gera UUID aleatório ou qualquer
// valor dependente do ambiente — `reportId`/`generatedAt` são sempre
// fornecidos pelo chamador. Arredondamento (`config.decimalPlaces`) é
// aplicado apenas nesta camada de serialização, nunca durante o cálculo
// interno, e nunca sobre `config`.

import { buildRecommendations } from "./RecommendationEngine.ts";
import { classifyStrategy } from "./StrategyEngine.ts";
import { buildConfidenceAdjustments } from "./ConfidenceAdjustmentEngine.ts";
import { buildRiskAssessments } from "./RiskAssessmentEngine.ts";
import { validatePredictionAdaptationConfig, type PredictionAdaptationConfig } from "./PredictionAdaptationConfig.ts";
import { isFiniteNumber, type AdaptiveDecision, type AdaptiveReport, type AdaptiveReportOptions, type LearningReport } from "./types.ts";

function roundNumber(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/** Arredonda recursivamente todo número finito encontrado em `value` para
 * `decimalPlaces` casas decimais — aplicado uma única vez, no final da
 * montagem do relatório, nunca durante o cálculo interno. Números não
 * finitos são preservados sem alteração, nunca silenciosamente zerados. */
function roundDeep<T>(value: T, decimalPlaces: number): T {
  if (typeof value === "number") {
    return (isFiniteNumber(value) ? roundNumber(value, decimalPlaces) : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => roundDeep(item, decimalPlaces)) as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = roundDeep(entryValue, decimalPlaces);
    }
    return result as T;
  }
  return value;
}

/**
 * Monta o relatório adaptativo final a partir de um `LearningReport` já
 * calculado (Sprint 5.1). Lança `PredictionAdaptationConfigurationError`
 * para uma configuração inválida; nunca lança por causa do conteúdo do
 * `LearningReport` — um relatório de origem vazio produz `decisions: []`,
 * nunca uma exceção.
 */
export function buildAdaptiveReport(
  learningReport: LearningReport,
  config: PredictionAdaptationConfig,
  options: AdaptiveReportOptions,
): AdaptiveReport {
  validatePredictionAdaptationConfig(config);

  const { historicalProfiles, driftSignals, reliabilityRankings } = learningReport;

  const recommendations = buildRecommendations(historicalProfiles, driftSignals, reliabilityRankings, config);
  const confidenceAdjustments = buildConfidenceAdjustments(recommendations, config);
  const riskAssessments = buildRiskAssessments(recommendations, reliabilityRankings, config);
  const strategyStatus = classifyStrategy(historicalProfiles, driftSignals, reliabilityRankings, config);

  const decisions: AdaptiveDecision[] = recommendations.map((recommendation, index) => ({
    dimension: recommendation.dimension,
    key: recommendation.key,
    recommendation,
    confidenceAdjustment: confidenceAdjustments[index],
    riskAssessment: riskAssessments[index],
  }));

  // `config` é deliberadamente excluído do arredondamento — mesma razão
  // documentada em `EvaluationReport.ts` (Sprint 4.5) e `LearningReport.ts`
  // (Sprint 5.1): arredondar limiares/multiplicadores junto com os
  // valores calculados poderia corrompê-los silenciosamente.
  const roundedDecisions = roundDeep(decisions, config.decimalPlaces);

  return {
    reportId: options.reportId,
    generatedAt: options.generatedAt ?? null,
    modelVersion: config.modelVersion,
    config,
    sourceReportId: learningReport.reportId,
    sourceStatus: learningReport.status,
    strategyStatus,
    decisions: roundedDecisions,
  };
}
