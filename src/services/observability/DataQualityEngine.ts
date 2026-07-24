// Fase 3.5 - Observabilidade e Validacao em Producao.
// DataQualityEngine: combina os 6 sub-scores obrigatorios (completude,
// consistencia, classificacao, duplicacao, frescor, confiabilidade do
// provider) em um unico overallScore, todos na escala 0..100, usando os
// pesos centralizados de ObservabilityConfig.weights (que somam
// exatamente 1 - ver ObservabilityConfig.ts). FORMULA OBRIGATORIA (corrigida
// apos auditoria - a versao anterior desta fase usava apenas 4 sub-scores
// em escala 0..1; ambas as lacunas foram corrigidas nesta revisao):
//
//   overallScore =
//       completenessScore        * weights.completeness    (0.25)
//     + consistencyScore         * weights.consistency     (0.20)
//     + classificationScore      * weights.classification  (0.20)
//     + duplicationScore         * weights.duplicate       (0.15)
//     + freshnessScore           * weights.freshness       (0.10)
//     + providerReliabilityScore * weights.providerReliability (0.10)
//
// Pesos PROVISORIOS, sujeitos a recalibracao apos operacao real (mesma
// convencao de "provisorio" usada no EsoccerClassifier da Fase 3).
// Calculo 100% deterministico: nenhuma chamada de rede, nenhum Date.now()
// implicito (o relogio `now` e sempre injetavel).

import { randomUUID } from "node:crypto";
import type { InternalMatchDTO } from "../../providers/types/dto.ts";
import type { EsoccerClassificationResult } from "../../providers/betsapi/EsoccerClassifier.ts";
import type { ObservabilityQualityWeights } from "./ObservabilityConfig.ts";
import { analyzeCompleteness, overallCompletenessScore } from "./DataCompletenessAnalyzer.ts";
import { analyzeConsistency } from "./DataConsistencyAnalyzer.ts";
import { analyzeClassificationMetrics } from "./ClassificationMetrics.ts";
import { analyzeDuplicateMetrics, type DuplicateMetricsResult } from "./DuplicateMetrics.ts";
import { computeFreshnessScore } from "./FreshnessScore.ts";
import { computeProviderReliabilityScore } from "./ProviderMetrics.ts";
import type { DataQualitySnapshot, LeagueQualityMetric, ProviderOperationalMetric } from "./types.ts";

export type DataQualityEngineInput = {
  matches: InternalMatchDTO[];
  classifications: EsoccerClassificationResult[];
  duplicateSummary: Pick<DuplicateMetricsResult, "totalRaw" | "duplicated"> | { totalRaw: number; duplicated: number };
  /** Usado pelo ProviderReliabilityScore. `null` quando nao ha dados operacionais suficientes ainda. */
  providerMetric: ProviderOperationalMetric | null;
  /** Usado pelo FreshnessScore. `null` quando nao ha nenhuma sincronizacao bem-sucedida registrada ainda. */
  lastSuccessfulSyncAt: string | null;
  weights: ObservabilityQualityWeights;
  /** Janela (minutos) a partir da qual dados deixam de ser considerados "frescos" - ver FreshnessScore.ts. */
  staleDataMinutes: number;
  now?: () => Date;
  idGenerator?: () => string;
};

function buildLeagueMetrics(matches: InternalMatchDTO[], classifications: EsoccerClassificationResult[]): LeagueQualityMetric[] {
  const byLeague = new Map<string, { total: number; complete: number; confirmed: number }>();

  matches.forEach((match, index) => {
    const league = match.league?.name?.trim() || "(sem liga)";
    const entry = byLeague.get(league) ?? { total: 0, complete: 0, confirmed: 0 };
    entry.total += 1;
    if (match.externalId && match.scheduledAt && match.status) entry.complete += 1;
    const classification = classifications[index]?.classification;
    if (classification === "confirmed_esoccer") entry.confirmed += 1;
    byLeague.set(league, entry);
  });

  return Array.from(byLeague.entries()).map(([league, entry]) => ({
    league,
    totalMatches: entry.total,
    completenessRatio: entry.total === 0 ? 0 : entry.complete / entry.total,
    confirmedEsoccerRatio: entry.total === 0 ? 0 : entry.confirmed / entry.total,
  }));
}

/** Constroi um DataQualitySnapshot completo (todos os scores 0..100) a partir de uma amostra de partidas ja normalizadas, suas classificacoes, e o estado operacional/de frescor mais recente. */
export function computeDataQualitySnapshot(input: DataQualityEngineInput): DataQualitySnapshot {
  const now = input.now ?? (() => new Date());
  const idGenerator = input.idGenerator ?? randomUUID;

  const fieldMetrics = analyzeCompleteness(input.matches);
  const completenessScore = overallCompletenessScore(fieldMetrics) * 100;

  const consistencyResult = analyzeConsistency(input.matches);
  const consistencyScore = consistencyResult.consistencyRatio * 100;

  const classificationResult = analyzeClassificationMetrics(input.classifications);
  const classificationScore = classificationResult.classificationConfidenceScore * 100;

  const duplicateResult = analyzeDuplicateMetrics(input.duplicateSummary);
  const duplicationScore = duplicateResult.duplicateHealthScore * 100;

  const freshnessScore = computeFreshnessScore(input.lastSuccessfulSyncAt, now, input.staleDataMinutes);
  const providerReliabilityScore = computeProviderReliabilityScore(input.providerMetric);

  const overallScore =
    completenessScore * input.weights.completeness +
    consistencyScore * input.weights.consistency +
    classificationScore * input.weights.classification +
    duplicationScore * input.weights.duplicate +
    freshnessScore * input.weights.freshness +
    providerReliabilityScore * input.weights.providerReliability;

  return {
    id: idGenerator(),
    generatedAt: now().toISOString(),
    sampleSize: input.matches.length,
    completenessScore,
    consistencyScore,
    classificationScore,
    duplicationScore,
    freshnessScore,
    providerReliabilityScore,
    overallScore,
    fieldMetrics,
    leagueMetrics: buildLeagueMetrics(input.matches, input.classifications),
    inconsistencies: consistencyResult.inconsistencies,
  };
}
