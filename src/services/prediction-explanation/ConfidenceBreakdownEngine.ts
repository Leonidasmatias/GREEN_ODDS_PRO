// Sprint 9.0 — Prediction Intelligence Framework, Etapa 2.
// Confidence Breakdown: reexpressa, como 6 percentuais que somam
// exatamente 100, números REAIS já calculados pelo Prediction
// Orchestrator (`featureTrace[].weight`, `expectedGoals.total`,
// `dataSufficiency.status`, `quality.combinedStatus`) — nunca recalcula
// `confidence` em si, apenas normaliza componentes já existentes para
// fins explicativos. Função pura.

import type { PredictionResult } from "../prediction-orchestrator/index.ts";
import { DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES } from "../prediction-orchestrator/index.ts";
import { GOALS_AVERAGE_NEUTRAL_BASELINE } from "./predictionExplanationConstants.ts";
import type { ConfidenceBreakdownCategory, ConfidenceBreakdownItem } from "./predictionExplanationTypes.ts";

const CATEGORY_ORDER: ConfidenceBreakdownCategory[] = ["RECENT_FORM", "GOALS_TREND", "HOME_ADVANTAGE", "HEAD_TO_HEAD", "SAMPLE_SIZE", "DATA_QUALITY"];

function featureWeight<T extends { name: string; availability: string; weight: number }>(featureTrace: T[], name: string): number {
  const feature = featureTrace.find((candidate) => candidate.name === name);
  return feature && feature.availability === "AVAILABLE" ? feature.weight : 0;
}

/**
 * Score bruto (não normalizado) de cada categoria, sempre a partir de um
 * valor real já calculado — nunca inventado:
 * - `RECENT_FORM`/`HOME_ADVANTAGE`/`HEAD_TO_HEAD`: peso da feature
 *   correspondente no Prediction Engine (fallback: Goal Distribution
 *   Engine), 0 se indisponível.
 * - `GOALS_TREND`: distância absoluta de `expectedGoals.total` até o
 *   valor neutro (mesma constante do fator `GOALS_AVERAGE`, Etapa 1).
 * - `SAMPLE_SIZE`/`DATA_QUALITY`: `DataSufficiencyStatus` convertido em
 *   pontuação pela MESMA tabela canônica já usada pelo Green
 *   Score/Confidence Engine (`DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES`),
 *   nunca uma tabela nova.
 */
function rawScores(result: PredictionResult): Record<ConfidenceBreakdownCategory, number> {
  const predictionFeatures = result.prediction.featureTrace;
  const goalFeatures = result.goalDistribution.featureTrace;
  const scores = DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES;

  return {
    RECENT_FORM: featureWeight(predictionFeatures, "formDifference") || featureWeight(goalFeatures, "recentForm"),
    GOALS_TREND: Math.abs(result.goalDistribution.expectedGoals.total - GOALS_AVERAGE_NEUTRAL_BASELINE),
    HOME_ADVANTAGE: featureWeight(predictionFeatures, "homeAdvantage") || featureWeight(goalFeatures, "homeAwaySplit"),
    HEAD_TO_HEAD: featureWeight(predictionFeatures, "headToHead") || featureWeight(goalFeatures, "headToHead"),
    SAMPLE_SIZE: scores[result.prediction.dataSufficiency.status],
    DATA_QUALITY: scores[result.quality.combinedStatus],
  };
}

/** Distribui 100 pontos inteiros proporcionalmente aos scores brutos
 * (método do maior resto — determinístico, nunca depende da ordem de
 * iteração do objeto): parte inteira de cada fração primeiro, depois os
 * pontos restantes vão para as maiores partes fracionárias, com
 * desempate pela ordem fixa de `CATEGORY_ORDER`. Se a soma dos scores
 * brutos for zero (todas as categorias indisponíveis), distribui os 100
 * pontos igualmente. */
function distributePercentages(scores: Record<ConfidenceBreakdownCategory, number>): ConfidenceBreakdownItem[] {
  const total = CATEGORY_ORDER.reduce((sum, category) => sum + scores[category], 0);

  if (total <= 0) {
    const base = Math.floor(100 / CATEGORY_ORDER.length);
    const remainder = 100 - base * CATEGORY_ORDER.length;
    return CATEGORY_ORDER.map((category, index) => ({ category, percentage: base + (index < remainder ? 1 : 0) }));
  }

  const exact = CATEGORY_ORDER.map((category) => ({ category, exact: (scores[category] / total) * 100 }));
  const floored = exact.map((item) => ({ category: item.category, percentage: Math.floor(item.exact), remainder: item.exact - Math.floor(item.exact) }));
  const distributed = floored.reduce((sum, item) => sum + item.percentage, 0);
  let pointsLeft = 100 - distributed;

  const byRemainderDesc = [...floored].sort((a, b) => b.remainder - a.remainder);
  const result = new Map(floored.map((item) => [item.category, item.percentage]));
  for (const item of byRemainderDesc) {
    if (pointsLeft <= 0) break;
    result.set(item.category, (result.get(item.category) ?? 0) + 1);
    pointsLeft -= 1;
  }

  return CATEGORY_ORDER.map((category) => ({ category, percentage: result.get(category) ?? 0 }));
}

/** Constrói o breakdown de confiança (Etapa 2) — a soma de `percentage`
 * é sempre exatamente 100. */
export function buildConfidenceBreakdown(result: PredictionResult): ConfidenceBreakdownItem[] {
  return distributePercentages(rawScores(result));
}
