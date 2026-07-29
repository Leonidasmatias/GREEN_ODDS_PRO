// Sprint 9.0 — Prediction Intelligence Framework.
// Formatadores puros de apresentação para a explicabilidade — mesma
// separação já usada por `predictionCenterFormatters.ts`/
// `predictionHistoryFormatters.ts`. Nunca calculam nada, apenas traduzem
// códigos já produzidos por `src/services/prediction-explanation/`.

// Import relativo (não `@/`) — precisa ser executável também por
// `node --test` (sem bundler), mesma justificativa documentada em
// `predictionCenterFormatters.ts`.
import type {
  PredictionFactorCode,
  PredictionQualityGrade,
  PredictionRiskCode,
  PredictionRiskSeverity,
  PredictionSignalFavors,
} from "../services/prediction-explanation/index.ts";
import type { ConfidenceBreakdownCategory } from "../services/prediction-explanation/index.ts";

const FACTOR_LABELS: Record<PredictionFactorCode, string> = {
  RECENT_FORM: "Forma recente",
  TEAM_STRENGTH: "Força da equipe",
  GOALS_AVERAGE: "Média de gols",
  HOME_AWAY_PERFORMANCE: "Desempenho casa/fora",
  HEAD_TO_HEAD: "Confronto direto (H2H)",
  SAMPLE_CONSISTENCY: "Consistência da amostra",
  DATA_CONFIDENCE: "Confiança dos dados",
};

export function formatPredictionFactorCode(code: PredictionFactorCode): string {
  return FACTOR_LABELS[code];
}

const CONFIDENCE_BREAKDOWN_LABELS: Record<ConfidenceBreakdownCategory, string> = {
  RECENT_FORM: "Forma recente",
  GOALS_TREND: "Tendência de gols",
  HOME_ADVANTAGE: "Vantagem de mando",
  HEAD_TO_HEAD: "Confronto direto",
  SAMPLE_SIZE: "Tamanho da amostra",
  DATA_QUALITY: "Qualidade dos dados",
};

export function formatConfidenceBreakdownCategory(category: ConfidenceBreakdownCategory): string {
  return CONFIDENCE_BREAKDOWN_LABELS[category];
}

const RISK_LABELS: Record<PredictionRiskCode, string> = {
  LOW_SAMPLE_SIZE: "Baixa amostragem",
  STALE_DATA: "Dados desatualizados",
  INDICATOR_CONFLICT: "Conflito entre indicadores",
  INSUFFICIENT_CONFIDENCE: "Confiança insuficiente",
  HIGH_VOLATILITY: "Alta volatilidade",
  NO_HEAD_TO_HEAD_HISTORY: "Sem histórico H2H",
};

export function formatPredictionRiskCode(code: PredictionRiskCode): string {
  return RISK_LABELS[code];
}

const RISK_SEVERITY_LABELS: Record<PredictionRiskSeverity, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
};

export function formatPredictionRiskSeverity(severity: PredictionRiskSeverity): string {
  return RISK_SEVERITY_LABELS[severity];
}

const QUALITY_GRADE_LABELS: Record<PredictionQualityGrade, string> = {
  A_PLUS: "A+",
  A: "A",
  B_PLUS: "B+",
  B: "B",
  C: "C",
  D: "D",
};

export function formatPredictionQualityGrade(grade: PredictionQualityGrade): string {
  return QUALITY_GRADE_LABELS[grade];
}

const DIRECTION_LABELS: Record<PredictionSignalFavors, string> = {
  HOME: "Favorece o mandante",
  AWAY: "Favorece o visitante",
  NEUTRAL: "Neutro",
};

export function formatPredictionFactorDirection(direction: PredictionSignalFavors): string {
  return DIRECTION_LABELS[direction];
}
