// Sprint 9.0 — Prediction Intelligence Framework, Etapa 1.
// Prediction Explanation Engine: reempacota, em 7 fatores estruturados,
// dados que o Prediction Orchestrator (Sprint 4.3) já calculou —
// `featureTrace` do Prediction Engine e do Goal Distribution Engine,
// `expectedGoals` e `quality`. NUNCA recalcula probabilidade, Green Score,
// Confidence ou qualquer feature — apenas lê e classifica. Função pura:
// nenhum acesso a Prisma, rede, relógio do sistema ou número aleatório
// (a "força ofensiva"/"força defensiva" da missão são representadas por
// um único fator `TEAM_STRENGTH`, porque o motor não calcula essas duas
// grandezas separadamente — nunca inventamos uma divisão que os motores
// da Sprint 4.1/4.2 não produzem).

import type { PredictionFeatureTrace } from "../prediction/index.ts";
import type { GoalFeatureTrace } from "../goal-distribution/index.ts";
import type { PredictionResult } from "../prediction-orchestrator/index.ts";
import { FACTOR_MAGNITUDE_REFERENCE_SCALE, GOALS_AVERAGE_NEUTRAL_BASELINE } from "./predictionExplanationConstants.ts";
import type { PredictionFactor, PredictionFactorCode, PredictionSignalFavors } from "./predictionExplanationTypes.ts";

/** Duplicata mínima e deliberada de `clamp` (idêntica à de
 * `prediction-orchestrator/types.ts`) — não reexportada pelo barrel
 * público do orquestrador, e este módulo nunca importa de fora do
 * barrel. Função trivial de uma linha, sem risco de divergência. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function findFeature<T extends { name: string }>(featureTrace: T[], name: string): T | undefined {
  return featureTrace.find((candidate) => candidate.name === name);
}

/** Um fator a partir de UMA feature do Prediction Engine (escala -1..1 já
 * normalizada pelo próprio motor). */
function fromPredictionFeature(code: PredictionFactorCode, feature: PredictionFeatureTrace | undefined): PredictionFactor {
  if (!feature || feature.availability !== "AVAILABLE" || feature.normalizedValue === null) {
    return { code, availability: feature ? "MISSING" : "NOT_APPLICABLE", direction: "NEUTRAL", magnitude: null, weight: null };
  }
  const magnitude = clamp(Math.abs(feature.normalizedValue), 0, 1);
  const direction: PredictionSignalFavors = feature.contribution > 0 ? "HOME" : feature.contribution < 0 ? "AWAY" : "NEUTRAL";
  return { code, availability: "AVAILABLE", direction, magnitude, weight: feature.weight };
}

/** Um fator a partir de UMA feature do Goal Distribution Engine (sem
 * `normalizedValue` único — usa `contributionHome`/`contributionAway`,
 * mesma técnica já usada por `PredictionExplanation.ts`, Sprint 4.3). */
function fromGoalDistributionFeature(code: PredictionFactorCode, feature: GoalFeatureTrace | undefined): PredictionFactor {
  if (!feature || feature.availability !== "AVAILABLE") {
    return { code, availability: feature ? "MISSING" : "NOT_APPLICABLE", direction: "NEUTRAL", magnitude: null, weight: null };
  }
  const rawDelta = feature.contributionHome - feature.contributionAway;
  const magnitude = clamp(Math.abs(rawDelta) / FACTOR_MAGNITUDE_REFERENCE_SCALE, 0, 1);
  const direction: PredictionSignalFavors = rawDelta > 0 ? "HOME" : rawDelta < 0 ? "AWAY" : "NEUTRAL";
  return { code, availability: "AVAILABLE", direction, magnitude, weight: feature.weight };
}

/** Fator com fonte primária (Prediction Engine) e fallback (Goal
 * Distribution Engine) — nunca combina/faz média dos dois (escalas
 * diferentes); usa o primeiro disponível, mesma prioridade já adotada
 * por `PredictionExplanation.ts` para os sinais equivalentes. */
function factorWithFallback(
  code: PredictionFactorCode,
  primary: PredictionFeatureTrace | undefined,
  fallback: GoalFeatureTrace | undefined,
): PredictionFactor {
  if (primary && primary.availability === "AVAILABLE") return fromPredictionFeature(code, primary);
  if (fallback && fallback.availability === "AVAILABLE") return fromGoalDistributionFeature(code, fallback);
  return fromPredictionFeature(code, primary);
}

/** `GOALS_AVERAGE`: derivado diretamente de `expectedGoals.total` (valor
 * já calculado pelo Goal Distribution Engine) — sempre disponível
 * (`expectedGoals` nunca é `null`), sem direção casa/fora (é uma
 * tendência do jogo como um todo, não um tilt), sem peso próprio de
 * motor (por isso `weight: null`). */
function goalsAverageFactor(result: PredictionResult): PredictionFactor {
  const total = result.goalDistribution.expectedGoals.total;
  const magnitude = clamp(Math.abs(total - GOALS_AVERAGE_NEUTRAL_BASELINE) / GOALS_AVERAGE_NEUTRAL_BASELINE, 0, 1);
  return { code: "GOALS_AVERAGE", availability: "AVAILABLE", direction: "NEUTRAL", magnitude, weight: null };
}

/** `SAMPLE_CONSISTENCY`: derivado de `quality.consistency` — sempre
 * disponível (a checagem de coerência é sempre executada). Magnitude alta
 * = motores muito alinhados (delta de probabilidade pequeno). */
function sampleConsistencyFactor(result: PredictionResult): PredictionFactor {
  const magnitude = clamp(1 - result.quality.consistency.maxProbabilityDelta, 0, 1);
  return { code: "SAMPLE_CONSISTENCY", availability: "AVAILABLE", direction: "NEUTRAL", magnitude, weight: null };
}

/** `DATA_CONFIDENCE`: derivado de `confidence` (0..100, já calculado pelo
 * Confidence Engine) — nunca recalculado aqui, apenas normalizado para
 * 0..1 para exibição consistente com os demais fatores. */
function dataConfidenceFactor(result: PredictionResult): PredictionFactor {
  const magnitude = clamp(result.confidence / 100, 0, 1);
  return { code: "DATA_CONFIDENCE", availability: "AVAILABLE", direction: "NEUTRAL", magnitude, weight: null };
}

/** Normaliza `weight` entre os fatores `AVAILABLE` que possuem peso real
 * de motor, para que reflitam importância relativa (soma 1 entre eles) —
 * nunca altera `magnitude`/`direction`, apenas reescala `weight`. */
function normalizeWeights(factors: PredictionFactor[]): PredictionFactor[] {
  const weightSum = factors.reduce((sum, factor) => sum + (factor.weight ?? 0), 0);
  if (weightSum <= 0) return factors;
  return factors.map((factor) => (factor.weight === null ? factor : { ...factor, weight: factor.weight / weightSum }));
}

/**
 * Constrói os 7 fatores estruturados (Etapa 1). Ordem fixa e sempre a
 * mesma, independente de disponibilidade — o chamador decide como exibir
 * fatores `MISSING`/`NOT_APPLICABLE`.
 */
export function buildPredictionFactors(result: PredictionResult): PredictionFactor[] {
  const predictionFeatures = result.prediction.featureTrace;
  const goalFeatures = result.goalDistribution.featureTrace;

  const factors: PredictionFactor[] = [
    factorWithFallback("RECENT_FORM", findFeature(predictionFeatures, "formDifference"), findFeature(goalFeatures, "recentForm")),
    factorWithFallback("TEAM_STRENGTH", findFeature(predictionFeatures, "strengthDifference"), findFeature(goalFeatures, "strength")),
    goalsAverageFactor(result),
    factorWithFallback("HOME_AWAY_PERFORMANCE", findFeature(predictionFeatures, "homeAdvantage"), findFeature(goalFeatures, "homeAwaySplit")),
    factorWithFallback("HEAD_TO_HEAD", findFeature(predictionFeatures, "headToHead"), findFeature(goalFeatures, "headToHead")),
    sampleConsistencyFactor(result),
    dataConfidenceFactor(result),
  ];

  return normalizeWeights(factors);
}
