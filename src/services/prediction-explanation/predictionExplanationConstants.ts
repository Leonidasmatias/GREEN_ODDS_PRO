// Sprint 9.0 — Prediction Intelligence Framework.
// Constantes de exibição/classificação deste módulo — nunca reaproveitadas
// pelo Prediction Orchestrator (Sprint 4.3) nem usadas para alterar
// probabilidade, Green Score ou Confidence. Documentadas individualmente
// porque são julgamento de engenharia desta sprint (mesma convenção de
// "PROVISIONAL" já usada em `PredictionOrchestratorConfig.ts`).

/** Escala de referência (gols/partida) para normalizar, só para exibição,
 * a magnitude de um fator derivado do Goal Distribution Engine
 * (`contributionHome - contributionAway`) para 0..1. Independente da
 * escala interna do motor (`magnitudeReferenceScale`, usada para o
 * ranking de `topSignals`) — este módulo nunca lê configuração interna
 * do orquestrador. */
export const FACTOR_MAGNITUDE_REFERENCE_SCALE = 2.0;

/** Total de gols esperados considerado "neutro" (nem alta, nem baixa
 * tendência) — usado só para calcular a magnitude de exibição do fator
 * `GOALS_AVERAGE`, nunca para reclassificar `expectedGoals`. */
export const GOALS_AVERAGE_NEUTRAL_BASELINE = 2.5;

/** Horas após `generatedAt` a partir das quais o risco `STALE_DATA` passa
 * a ser considerado. */
export const STALE_DATA_HOURS = 24;

/** Limiares de `confidence` (0..100) para o risco `INSUFFICIENT_CONFIDENCE`. */
export const INSUFFICIENT_CONFIDENCE_HIGH_THRESHOLD = 40;
export const INSUFFICIENT_CONFIDENCE_MEDIUM_THRESHOLD = 60;

/** `prediction.probabilityMargin` abaixo do qual o risco `HIGH_VOLATILITY`
 * é sinalizado (previsão "apertada" entre o resultado mais provável e o
 * segundo). */
export const HIGH_VOLATILITY_MARGIN_THRESHOLD = 0.08;

/** Ajuste (soma direta, nunca multiplicação) aplicado ao score-base de
 * qualidade (Etapa 5) conforme `ConsistencyLevel` — mesmo espírito do
 * `consistency.adjustment` já usado pelo Green Score/Confidence Engine,
 * porém com constantes próprias deste módulo (nunca as mesmas usadas
 * internamente pelo orquestrador). */
export const QUALITY_CONSISTENCY_ADJUSTMENT: Record<"ALIGNED" | "MINOR_DIVERGENCE" | "MAJOR_DIVERGENCE", number> = {
  ALIGNED: 5,
  MINOR_DIVERGENCE: -5,
  MAJOR_DIVERGENCE: -15,
};

/** Limiares (score mínimo, inclusive) para cada nota de qualidade
 * (Etapa 5) — em ordem decrescente. */
export const QUALITY_GRADE_THRESHOLDS: { grade: "A_PLUS" | "A" | "B_PLUS" | "B" | "C" | "D"; minScore: number }[] = [
  { grade: "A_PLUS", minScore: 90 },
  { grade: "A", minScore: 80 },
  { grade: "B_PLUS", minScore: 70 },
  { grade: "B", minScore: 60 },
  { grade: "C", minScore: 40 },
  { grade: "D", minScore: 0 },
];
