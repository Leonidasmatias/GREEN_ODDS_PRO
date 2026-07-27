// Fase 4 — Sprint 4.3 — Prediction Orchestrator.
// Tipos compartilhados pelo Prediction Orchestrator. Nenhum tipo aqui
// depende do Prisma Client — o orquestrador inteiro opera compondo o
// Prediction Engine (Sprint 4.1) e o Goal Distribution Engine
// (Sprint 4.2) através de seus respectivos barrels públicos, nunca
// duplicando os tipos que eles já expõem.

import type {
  MatchOutcome,
  MatchOutcomePrediction,
  DataSufficiencyResult,
  DataSufficiencyStatus,
  FeatureAvailability,
} from "../prediction/index.ts";
import type {
  GoalDistributionPlayerInputs,
  GoalDistributionPrediction,
  ExpectedGoals,
  ExactScoreProbability,
  GoalLineProbability,
  BothTeamsToScoreProbability,
  ScoreDerivedOutcomeProbabilities,
} from "../goal-distribution/index.ts";
import type { HeadToHeadResult } from "../intelligence/HeadToHeadEngine.ts";

// Reexportados por conveniência: consumidores deste módulo não precisam
// importar diretamente dos barrels da Sprint 4.1/4.2 para os conceitos de
// suficiência de dados/disponibilidade, inteiramente reaproveitados (nunca
// redefinidos) por esta sprint.
export type { DataSufficiencyResult, DataSufficiencyStatus, FeatureAvailability, MatchOutcome };

/** Clampa um valor numérico entre min e max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** true somente para números finitos (rejeita NaN, +Infinity, -Infinity e não-números). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Requisição do orquestrador: exatamente o par jogador + H2H consumido
 * tanto pelo Prediction Engine quanto pelo Goal Distribution Engine.
 * `GoalDistributionPlayerInputs` (Sprint 4.2) já é um superconjunto de
 * `PlayerPredictionInputs` (Sprint 4.1, inclui `goalsRates` a mais) — um
 * único objeto por jogador serve aos dois motores sem duplicar tipos.
 */
export type PredictionOrchestratorRequest = {
  homePlayer: GoalDistributionPlayerInputs;
  awayPlayer: GoalDistributionPlayerInputs;
  headToHead: HeadToHeadResult | null;
};

export type ConsistencyLevel = "ALIGNED" | "MINOR_DIVERGENCE" | "MAJOR_DIVERGENCE";

/**
 * Resultado da verificação de coerência entre o Prediction Engine e o
 * resultado 1X2 derivado da matriz do Goal Distribution Engine.
 * `adjustment` é sempre um número assinado (positivo = bônus, negativo =
 * penalidade) aplicado tanto pela Confidence Engine quanto pela Green
 * Score Engine desta sprint — nunca pelos motores das Sprints 4.1/4.2.
 */
export type ConsistencyAssessment = {
  level: ConsistencyLevel;
  matchingWinner: boolean;
  maxProbabilityDelta: number;
  adjustment: number;
};

/**
 * Avaliação combinada de qualidade de dados: reaproveita
 * `DataSufficiencyStatus` das duas Sprints anteriores (nunca redefinido) e
 * agrega a coerência entre motores (`ConsistencyAssessment`).
 * `combinedStatus` é sempre o mais conservador (rank mais baixo) entre os
 * dois motores — nunca otimista quando um dos dois está incerto.
 */
export type DataQualityAssessment = {
  predictionDataSufficiency: DataSufficiencyStatus;
  goalDistributionDataSufficiency: DataSufficiencyStatus;
  combinedStatus: DataSufficiencyStatus;
  consistency: ConsistencyAssessment;
};

export type GreenScoreCategory = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export type GreenScoreAssessment = {
  score: number;
  category: GreenScoreCategory;
};

export type ModelVersions = {
  prediction: string;
  goalDistribution: string;
  orchestrator: string;
};

/**
 * Sinal estruturado de explicabilidade — nunca um texto em linguagem
 * natural. `type` é um identificador fechado e legível por máquina;
 * `magnitude` (0..1) mede a força relativa do sinal; `favors` indica a
 * direção; `source` identifica qual motor originou o sinal.
 */
export type PredictionSignalType =
  | "RATING_ADVANTAGE"
  | "FORM_ADVANTAGE"
  | "STRENGTH_ADVANTAGE"
  | "MOMENTUM_ADVANTAGE"
  | "HOME_FIELD_ADVANTAGE"
  | "HEAD_TO_HEAD_ADVANTAGE"
  | "GREEN_SCORE_ADVANTAGE"
  | "GOAL_EXPECTATION_ADVANTAGE"
  | "HIGH_SCORING_TREND"
  | "LOW_SCORING_TREND";

export type PredictionSignalFavors = "HOME" | "AWAY" | "NEUTRAL";
export type PredictionSignalSource = "PREDICTION_ENGINE" | "GOAL_DISTRIBUTION_ENGINE";

export type PredictionSignal = {
  type: PredictionSignalType;
  source: PredictionSignalSource;
  favors: PredictionSignalFavors;
  magnitude: number;
};

export type PredictionExplanationResult = {
  topSignals: PredictionSignal[];
  totalSignalsConsidered: number;
};

/**
 * Saída do Prediction Aggregator: um resumo plano e denormalizado que
 * combina os dois motores em um único objeto de consulta rápida.
 * `winner`/`outcomeProbabilities` vêm sempre do Prediction Engine (Sprint
 * 4.1) — o resultado 1X2 derivado da matriz de gols (Sprint 4.2) nunca
 * substitui ou se mistura ao resultado autoritativo do Prediction Engine,
 * permanecendo disponível apenas dentro do objeto `goalDistribution`
 * aninhado em `PredictionResult` para comparação.
 */
export type FinalPrediction = {
  winner: MatchOutcome;
  confidence: number;
  greenScore: GreenScoreAssessment;
  expectedGoals: ExpectedGoals;
  exactScores: ExactScoreProbability[];
  bothTeamsToScore: BothTeamsToScoreProbability;
  overUnder: GoalLineProbability[];
  outcomeProbabilities: ScoreDerivedOutcomeProbabilities;
  dataQuality: DataQualityAssessment;
  warnings: string[];
  modelVersions: ModelVersions;
};

export type PredictionOrchestratorMetadata = {
  predictionModelVersion: string;
  goalDistributionModelVersion: string;
  orchestratorModelVersion: string;
  generatedAt: string;
  configurationHash: string;
};

/**
 * Saída pública de `predictMatch()`. Contém os dois resultados brutos
 * (`prediction`, `goalDistribution`, para rastreabilidade e consumidores
 * avançados) mais os campos agregados/derivados por esta sprint
 * (`greenScore`, `confidence`, `quality`, `warnings`, `explanation`,
 * `metadata`).
 */
export type PredictionResult = {
  prediction: MatchOutcomePrediction;
  goalDistribution: GoalDistributionPrediction;
  greenScore: GreenScoreAssessment;
  confidence: number;
  quality: DataQualityAssessment;
  warnings: string[];
  explanation: PredictionExplanationResult;
  metadata: PredictionOrchestratorMetadata;
};
