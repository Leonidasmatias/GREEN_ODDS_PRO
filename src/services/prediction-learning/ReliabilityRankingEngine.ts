// Fase 5 — Sprint 5.1 — Learning Data Foundation & Drift Detection.
// Reliability Ranking Engine: pontuação técnica (0–100) de confiabilidade
// histórica por perfil, a partir EXCLUSIVAMENTE de métricas já calculadas
// (`HistoricalProfile.metrics`, Sprint 4.5) e de sinais de drift já
// detectados. NÃO representa recomendação de aposta, EV, ROI, Kelly ou
// stake — puramente um score técnico, PROVISÓRIO, para fins de
// observabilidade do modelo. Função pura: nenhum acesso a Prisma, rede,
// relógio do sistema ou número aleatório.

import { PROFILE_DIMENSION_ORDER, clamp, isFiniteNumber, type DriftSignal, type HistoricalProfile, type ProfileDimension, type ReliabilityMetricContribution, type ReliabilityRanking, type ReliabilityRankingEntry } from "./types.ts";
import type { PredictionLearningConfig, ReliabilityWeights } from "./PredictionLearningConfig.ts";

type ScoreComponentKey = keyof ReliabilityWeights;
const SCORE_COMPONENT_KEYS: ScoreComponentKey[] = ["accuracy", "macroPrecision", "macroRecall", "brierScore", "logLoss", "sampleSize", "stability"];

function normalizedWeights(weights: ReliabilityWeights): Record<ScoreComponentKey, number> {
  const sum = SCORE_COMPONENT_KEYS.reduce((total, key) => total + weights[key], 0);
  const result = {} as Record<ScoreComponentKey, number>;
  for (const key of SCORE_COMPONENT_KEYS) result[key] = sum > 0 ? weights[key] / sum : 1 / SCORE_COMPONENT_KEYS.length;
  return result;
}

function stabilityPenalty(dimension: ProfileDimension, key: string, driftSignals: DriftSignal[], config: PredictionLearningConfig): number {
  let penalty = 0;
  for (const signal of driftSignals) {
    if (signal.dimension === dimension && signal.key === key) penalty += config.driftSeverityPenalty[signal.severity];
  }
  return clamp(penalty, 0, 1);
}

function sampleSizeScore(validRecords: number, minimumRecordsPerProfile: number): number {
  if (minimumRecordsPerProfile <= 0) return validRecords > 0 ? 1 : 0;
  return clamp(validRecords / minimumRecordsPerProfile, 0, 1);
}

function scoreComponents(profile: HistoricalProfile, config: PredictionLearningConfig, driftSignals: DriftSignal[]): Record<ScoreComponentKey, number> {
  const accuracy = isFiniteNumber(profile.metrics.accuracy) ? clamp(profile.metrics.accuracy, 0, 1) : 0;
  const macroPrecision = isFiniteNumber(profile.metrics.macroPrecision) ? clamp(profile.metrics.macroPrecision, 0, 1) : 0;
  const macroRecall = isFiniteNumber(profile.metrics.macroRecall) ? clamp(profile.metrics.macroRecall, 0, 1) : 0;
  const brierScore = isFiniteNumber(profile.metrics.brierScore) ? clamp(1 - profile.metrics.brierScore / 2, 0, 1) : 0;
  const logLoss = isFiniteNumber(profile.metrics.logLoss) ? clamp(1 - profile.metrics.logLoss / config.reliabilityLogLossCap, 0, 1) : 0;
  const sampleSize = sampleSizeScore(profile.validRecords, config.minimumRecordsPerProfile);
  const stability = 1 - stabilityPenalty(profile.dimension, profile.key, driftSignals, config);
  return { accuracy, macroPrecision, macroRecall, brierScore, logLoss, sampleSize, stability };
}

function buildEntry(profile: HistoricalProfile, config: PredictionLearningConfig, driftSignals: DriftSignal[]): ReliabilityRankingEntry {
  const weights = normalizedWeights(config.reliabilityWeights);
  const components = scoreComponents(profile, config, driftSignals);

  const metricContributions: ReliabilityMetricContribution[] = SCORE_COMPONENT_KEYS.map((key) => ({
    metricName: key,
    weight: weights[key],
    normalizedValue: components[key],
    contribution: weights[key] * components[key] * 100,
  }));

  const rawScore = metricContributions.reduce((sum, contribution) => sum + contribution.contribution, 0);
  const reliabilityScore = profile.status !== "OK" ? Math.min(rawScore, config.insufficientSampleScoreCeiling) : rawScore;

  return {
    rank: 0,
    dimension: profile.dimension,
    key: profile.key,
    reliabilityScore,
    sampleSize: profile.validRecords,
    status: profile.status,
    metricContributions,
    warnings: [...profile.warnings],
  };
}

function compareEntries(a: ReliabilityRankingEntry, b: ReliabilityRankingEntry): number {
  if (a.reliabilityScore !== b.reliabilityScore) return b.reliabilityScore - a.reliabilityScore;
  const dimensionRankA = PROFILE_DIMENSION_ORDER.indexOf(a.dimension);
  const dimensionRankB = PROFILE_DIMENSION_ORDER.indexOf(b.dimension);
  if (dimensionRankA !== dimensionRankB) return dimensionRankA - dimensionRankB;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/**
 * Constrói o ranking técnico de confiabilidade a partir de perfis já
 * calculados. Perfis com amostra insuficiente nunca aparecem com
 * pontuação alta (teto aplicado independentemente da qualidade bruta das
 * métricas). Desempate determinístico: dimensão (ordem fixa), depois
 * chave (ordem alfabética). PROVISÓRIO — nunca representa recomendação de
 * aposta.
 */
export function buildReliabilityRanking(profiles: HistoricalProfile[], config: PredictionLearningConfig, driftSignals: DriftSignal[] = []): ReliabilityRanking {
  const entries = profiles.map((profile) => buildEntry(profile, config, driftSignals)).sort(compareEntries);
  const ranked = entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
  return { entries: ranked, profileCount: profiles.length };
}
