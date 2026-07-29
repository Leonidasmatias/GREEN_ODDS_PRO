// Sprint 9.0 — Prediction Intelligence Framework.
// Contratos públicos deste módulo. NUNCA redefine tipos já existentes do
// Prediction Orchestrator (Sprint 4.3) — reaproveita `PredictionSignalType`/
// `PredictionSignalFavors` por `import type`. Todos os tipos aqui são
// puramente de apresentação/explicabilidade — nenhum representa uma nova
// grandeza matemática do motor de previsão.

// Import relativo (não `@/`) — precisa ser executável também por
// `node --test` (sem bundler), mesma justificativa documentada em
// `predictionCenterFormatters.ts`.
import type { PredictionSignalFavors, PredictionSignalType } from "../prediction-orchestrator/index.ts";

export type { PredictionSignalFavors, PredictionSignalType };

/**
 * Os 7 fatores considerados por esta sprint (Etapa 1). Nem todo fator
 * mapeia 1:1 para uma feature do motor: `GOALS_AVERAGE`, `SAMPLE_CONSISTENCY`
 * e `DATA_CONFIDENCE` são derivados de campos já calculados
 * (`expectedGoals`/`quality`), nunca de uma nova conta.
 */
export type PredictionFactorCode =
  | "RECENT_FORM"
  | "TEAM_STRENGTH"
  | "GOALS_AVERAGE"
  | "HOME_AWAY_PERFORMANCE"
  | "HEAD_TO_HEAD"
  | "SAMPLE_CONSISTENCY"
  | "DATA_CONFIDENCE";

export type PredictionFactorAvailability = "AVAILABLE" | "MISSING" | "NOT_APPLICABLE";

/**
 * Um fator estruturado. `weight` é `null` quando o fator não corresponde a
 * uma feature com peso próprio no motor (`GOALS_AVERAGE`/
 * `SAMPLE_CONSISTENCY`/`DATA_CONFIDENCE`) — nunca um peso inventado.
 * `magnitude` é `null` quando `availability !== "AVAILABLE"`.
 */
export type PredictionFactor = {
  code: PredictionFactorCode;
  availability: PredictionFactorAvailability;
  direction: PredictionSignalFavors;
  magnitude: number | null;
  weight: number | null;
};

/** As 6 categorias da Etapa 2 — a soma de `percentage` sobre o array
 * completo é sempre exatamente 100. */
export type ConfidenceBreakdownCategory = "RECENT_FORM" | "GOALS_TREND" | "HOME_ADVANTAGE" | "HEAD_TO_HEAD" | "SAMPLE_SIZE" | "DATA_QUALITY";

export type ConfidenceBreakdownItem = {
  category: ConfidenceBreakdownCategory;
  percentage: number;
};

/** Uma razão — `text` é gerado por um template determinístico fixo
 * (keyed por `signalType`/`favors`), nunca texto livre/gerado
 * dinamicamente. `rank` é 1-based, na mesma ordem (por magnitude
 * decrescente) já usada por `explanation.topSignals`. */
export type PredictionReason = {
  rank: number;
  signalType: PredictionSignalType;
  favors: PredictionSignalFavors;
  magnitude: number;
  text: string;
};

export type PredictionRiskCode =
  | "LOW_SAMPLE_SIZE"
  | "STALE_DATA"
  | "INDICATOR_CONFLICT"
  | "INSUFFICIENT_CONFIDENCE"
  | "HIGH_VOLATILITY"
  | "NO_HEAD_TO_HEAD_HISTORY";

export type PredictionRiskSeverity = "LOW" | "MEDIUM" | "HIGH";

/** Só aparece no array de saída quando a condição real for verdadeira —
 * nunca uma lista fixa de 6 itens sempre presentes. */
export type PredictionRiskIndicator = {
  code: PredictionRiskCode;
  severity: PredictionRiskSeverity;
  description: string;
};

export type PredictionQualityGrade = "A_PLUS" | "A" | "B_PLUS" | "B" | "C" | "D";

/** `score` (0..100) é a base numérica que gerou `grade` — exposto para
 * transparência/teste, nunca um substituto do Green Score. */
export type PredictionQualityScore = {
  grade: PredictionQualityGrade;
  score: number;
};

/** Saída composta do motor de explicação (Etapa 1 + 2 + 3 + 4 + 5). */
export type PredictionExplanationView = {
  factors: PredictionFactor[];
  confidenceBreakdown: ConfidenceBreakdownItem[];
  reasons: PredictionReason[];
  risks: PredictionRiskIndicator[];
  quality: PredictionQualityScore;
};
