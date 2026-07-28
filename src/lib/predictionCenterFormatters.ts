// Sprint 6.5 — Prediction Center.
// Formatadores puros de apresentação — únicas responsáveis por texto em
// português neste feature (mesma separação já usada por
// `intelligenceFormatters.ts` na Sprint 6.0). Nunca calculam nada: apenas
// traduzem valores/códigos já produzidos pelo Prediction Orchestrator ou
// por `predictionMarketUtils.ts`.

// Imports relativos (não `@/`) neste arquivo especificamente: precisa ser
// executável tanto pelo bundler do Next.js quanto diretamente pelo
// `node --test` (sem bundler) nos testes de lógica pura — `node --test`
// não resolve o alias `@/`. Componentes/página continuam usando `@/`
// normalmente, conforme o padrão já adotado pelo projeto.
import { formatDateTimeBrt } from "./timezone.ts";
import type {
  ConsistencyLevel,
  DataSufficiencyStatus,
  GreenScoreCategory,
  MarketCode,
  MatchOutcome,
  PredictionRiskLevel,
  PredictionRiskReasonCode,
  PredictionSignalFavors,
  PredictionSignalSource,
  PredictionSignalType,
} from "./predictionCenterTypes.ts";

/** Rótulo padrão para valor ausente — NUNCA `0` ou string vazia quando o
 * dado realmente não existe. Usado por todo o Prediction Center. */
export const NOT_AVAILABLE = "Não disponível";

/** Formata uma probabilidade em escala 0–1 (ex.: outcome probabilities,
 * Over/Under, BTTS) como percentual (ex.: `0.715` -> `"71.5%"`). */
export function formatProbability(value: number | null, decimals = 1): string {
  if (value === null || Number.isNaN(value)) return NOT_AVAILABLE;
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Formata um valor já em escala 0–100 (ex.: Green Score, Confidence)
 * como percentual (ex.: `71.5` -> `"71.5%"`). Nunca multiplica por 100 —
 * escala já confirmada nos motores (`confidence`/`greenScore.score`
 * sempre 0–100). */
export function formatScore(value: number | null, decimals = 1): string {
  if (value === null || Number.isNaN(value)) return NOT_AVAILABLE;
  return `${value.toFixed(decimals)}%`;
}

/** Formata uma contagem de gols (placar previsto). */
export function formatGoals(value: number | null): string {
  if (value === null || Number.isNaN(value)) return NOT_AVAILABLE;
  return value.toLocaleString("pt-BR");
}

/** Formata uma data ISO já fornecida pelo snapshot — nunca gera a data
 * atual. Reaproveita `formatDateTimeBrt` (nunca duplica a lógica de fuso). */
export function formatReportDate(value: string | null | undefined): string {
  return formatDateTimeBrt(value, NOT_AVAILABLE);
}

const MATCH_OUTCOME_LABELS: Record<MatchOutcome, string> = {
  HOME_WIN: "Vitória do mandante",
  DRAW: "Empate",
  AWAY_WIN: "Vitória do visitante",
};

export function formatMatchOutcome(outcome: MatchOutcome): string {
  return MATCH_OUTCOME_LABELS[outcome];
}

const MARKET_LABELS: Record<MarketCode, string> = {
  HOME_WIN: "Vitória do mandante",
  DRAW: "Empate",
  AWAY_WIN: "Vitória do visitante",
  OVER_1_5: "Mais de 1.5 gols",
  OVER_2_5: "Mais de 2.5 gols",
  BTTS: "Ambas equipes marcam",
};

export function formatMarketCode(code: MarketCode): string {
  return MARKET_LABELS[code];
}

const GREEN_SCORE_CATEGORY_LABELS: Record<GreenScoreCategory, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
  VERY_HIGH: "Muito alto",
};

export function formatGreenScoreCategory(category: GreenScoreCategory): string {
  return GREEN_SCORE_CATEGORY_LABELS[category];
}

const DATA_SUFFICIENCY_STATUS_LABELS: Record<DataSufficiencyStatus, string> = {
  INSUFFICIENT: "Dados insuficientes",
  LIMITED: "Dados limitados",
  SUFFICIENT: "Dados suficientes",
  STRONG: "Dados robustos",
};

export function formatDataSufficiencyStatus(status: DataSufficiencyStatus): string {
  return DATA_SUFFICIENCY_STATUS_LABELS[status];
}

const CONSISTENCY_LEVEL_LABELS: Record<ConsistencyLevel, string> = {
  ALIGNED: "Motores alinhados",
  MINOR_DIVERGENCE: "Divergência leve entre motores",
  MAJOR_DIVERGENCE: "Divergência relevante entre motores",
};

export function formatConsistencyLevel(level: ConsistencyLevel): string {
  return CONSISTENCY_LEVEL_LABELS[level];
}

const PREDICTION_RISK_LEVEL_LABELS: Record<PredictionRiskLevel, string> = {
  LOW: "Risco baixo",
  MEDIUM: "Risco médio",
  HIGH: "Risco alto",
  ELEVATED: "Risco elevado",
};

export function formatPredictionRiskLevel(level: PredictionRiskLevel): string {
  return PREDICTION_RISK_LEVEL_LABELS[level];
}

const PREDICTION_RISK_REASON_LABELS: Record<PredictionRiskReasonCode, string> = {
  LIMITED_DATA_SUFFICIENCY: "Amostra de dados limitada para esta partida",
  INSUFFICIENT_DATA_SUFFICIENCY: "Amostra de dados insuficiente para esta partida",
  MINOR_ENGINE_DIVERGENCE: "Leve divergência entre o motor de resultado e o de gols",
  MAJOR_ENGINE_DIVERGENCE: "Divergência relevante entre o motor de resultado e o de gols",
  ENGINE_WARNINGS_PRESENT: "O motor reportou avisos para esta previsão",
};

export function formatPredictionRiskReason(code: PredictionRiskReasonCode): string {
  return PREDICTION_RISK_REASON_LABELS[code];
}

const PREDICTION_SIGNAL_TYPE_LABELS: Record<PredictionSignalType, string> = {
  RATING_ADVANTAGE: "Vantagem de rating",
  FORM_ADVANTAGE: "Vantagem de forma recente",
  STRENGTH_ADVANTAGE: "Vantagem de força",
  MOMENTUM_ADVANTAGE: "Vantagem de momentum",
  HOME_FIELD_ADVANTAGE: "Vantagem de mando de campo",
  HEAD_TO_HEAD_ADVANTAGE: "Vantagem no confronto direto",
  GREEN_SCORE_ADVANTAGE: "Vantagem de Green Score",
  GOAL_EXPECTATION_ADVANTAGE: "Vantagem na expectativa de gols",
  HIGH_SCORING_TREND: "Tendência de jogo com muitos gols",
  LOW_SCORING_TREND: "Tendência de jogo com poucos gols",
};

export function formatPredictionSignalType(type: PredictionSignalType): string {
  return PREDICTION_SIGNAL_TYPE_LABELS[type];
}

const PREDICTION_SIGNAL_FAVORS_LABELS: Record<PredictionSignalFavors, string> = {
  HOME: "Favorece o mandante",
  AWAY: "Favorece o visitante",
  NEUTRAL: "Neutro",
};

export function formatPredictionSignalFavors(favors: PredictionSignalFavors): string {
  return PREDICTION_SIGNAL_FAVORS_LABELS[favors];
}

const PREDICTION_SIGNAL_SOURCE_LABELS: Record<PredictionSignalSource, string> = {
  PREDICTION_ENGINE: "Motor de resultado (1X2)",
  GOAL_DISTRIBUTION_ENGINE: "Motor de distribuição de gols",
};

export function formatPredictionSignalSource(source: PredictionSignalSource): string {
  return PREDICTION_SIGNAL_SOURCE_LABELS[source];
}

/** Formata a magnitude de um sinal (0–1) — mesma escala e mesmo
 * formatador de `formatProbability`, reaproveitado (nunca duplicado). */
export function formatSignalMagnitude(value: number): string {
  return formatProbability(value);
}
