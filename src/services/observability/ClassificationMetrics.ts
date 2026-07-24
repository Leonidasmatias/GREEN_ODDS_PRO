// Fase 3.5 - Observabilidade e Validacao em Producao.
// ClassificationMetrics: agrega resultados do EsoccerClassifier (Fase 3)
// sobre uma amostra de eventos em contagens/ratios e um
// classificationConfidenceScore ponderado (PROVISORIO): confirmed_esoccer
// pesa 1.0, probable_esoccer pesa 0.5, unknown/not_esoccer pesam 0 -
// refletindo o quanto a amostra observada permite confiar na
// classificacao antes de qualquer persistencia automatica.

import type { EsoccerClassification, EsoccerClassificationResult } from "../../providers/betsapi/EsoccerClassifier.ts";

export type ClassificationMetricsResult = {
  totalCount: number;
  confirmedEsoccer: number;
  probableEsoccer: number;
  notEsoccer: number;
  unknown: number;
  confirmedRatio: number;
  probableRatio: number;
  unknownRatio: number;
  classificationConfidenceScore: number;
};

const CONFIDENCE_WEIGHTS: Record<EsoccerClassification, number> = {
  confirmed_esoccer: 1,
  probable_esoccer: 0.5,
  unknown: 0,
  not_esoccer: 0,
};

export function analyzeClassificationMetrics(results: EsoccerClassificationResult[]): ClassificationMetricsResult {
  const totalCount = results.length;
  const counts: Record<EsoccerClassification, number> = {
    confirmed_esoccer: 0,
    probable_esoccer: 0,
    not_esoccer: 0,
    unknown: 0,
  };
  for (const result of results) counts[result.classification] += 1;

  const weightedSum = results.reduce((sum, result) => sum + CONFIDENCE_WEIGHTS[result.classification], 0);

  return {
    totalCount,
    confirmedEsoccer: counts.confirmed_esoccer,
    probableEsoccer: counts.probable_esoccer,
    notEsoccer: counts.not_esoccer,
    unknown: counts.unknown,
    confirmedRatio: totalCount === 0 ? 0 : counts.confirmed_esoccer / totalCount,
    probableRatio: totalCount === 0 ? 0 : counts.probable_esoccer / totalCount,
    unknownRatio: totalCount === 0 ? 0 : counts.unknown / totalCount,
    classificationConfidenceScore: totalCount === 0 ? 0 : weightedSum / totalCount,
  };
}
