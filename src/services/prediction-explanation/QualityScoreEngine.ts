// Sprint 9.0 — Prediction Intelligence Framework, Etapa 5.
// Prediction Quality Score: índice letrado (A+..D), INDEPENDENTE do Green
// Score (nunca o substitui nem o reutiliza como entrada) — combina
// `confidence` (0..100, já calculado) com `quality.combinedStatus`
// (convertido pela MESMA tabela canônica do Green Score/Confidence
// Engine) e um ajuste por `consistency.level` (constantes próprias deste
// módulo, documentadas em `predictionExplanationConstants.ts`). Função
// pura.

import type { PredictionResult } from "../prediction-orchestrator/index.ts";
import { DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES } from "../prediction-orchestrator/index.ts";
import { QUALITY_CONSISTENCY_ADJUSTMENT, QUALITY_GRADE_THRESHOLDS } from "./predictionExplanationConstants.ts";
import type { PredictionQualityGrade, PredictionQualityScore } from "./predictionExplanationTypes.ts";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function gradeForScore(score: number): PredictionQualityGrade {
  for (const { grade, minScore } of QUALITY_GRADE_THRESHOLDS) {
    if (score >= minScore) return grade;
  }
  return "D";
}

/**
 * Score-base (0..100): média simples entre `confidence` e
 * `combinedStatus` (convertido em pontuação), mais o ajuste de
 * consistência. Critérios da missão (quantidade de dados, estabilidade,
 * confiança, consistência) mapeiam assim: "quantidade de dados" e
 * "estabilidade" já estão embutidos em `combinedStatus`
 * (`DataQualityAssessment` combina `dataSufficiency` dos dois motores);
 * "confiança" é `confidence`; "consistência" é o ajuste de
 * `consistency.level`.
 */
export function buildPredictionQualityScore(result: PredictionResult): PredictionQualityScore {
  const dataQualityScore = DEFAULT_DATA_SUFFICIENCY_STATUS_SCORES[result.quality.combinedStatus];
  const baseScore = (result.confidence + dataQualityScore) / 2;
  const adjustment = QUALITY_CONSISTENCY_ADJUSTMENT[result.quality.consistency.level];
  const score = clamp(Math.round(baseScore + adjustment), 0, 100);
  return { grade: gradeForScore(score), score };
}
