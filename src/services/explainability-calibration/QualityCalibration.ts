// Sprint 9.1 — Explainability Calibration & Backtest, Etapa 4.
// Quality Calibration: para cada `PredictionQualityGrade` (A+..D, Sprint
// 9.0), calcula a acurácia real observada — reaproveitando
// `computeEvaluationMetrics`/`toOutcomeProbabilityPair` (Sprint 4.5, NUNCA
// reimplementados aqui). Função pura.

import { computeEvaluationMetrics, toOutcomeProbabilityPair } from "../prediction-evaluation/index.ts";
import type { EvaluationMetrics } from "../prediction-evaluation/index.ts";
import type { PredictionQualityGrade } from "../prediction-explanation/index.ts";
import type { CalibrationRecord } from "./CalibrationDataset.ts";

export type QualityGradeCalibration = {
  grade: PredictionQualityGrade;
  sampleSize: number;
  metrics: EvaluationMetrics;
};

/** Ordem fixa, da nota mais alta para a mais baixa — a mesma ordem usada
 * em `predictionExplanationConstants.ts` (Sprint 9.0). */
const GRADE_ORDER: PredictionQualityGrade[] = ["A_PLUS", "A", "B_PLUS", "B", "C", "D"];

/**
 * Calcula, para cada nota, quantos registros a receberam e qual a
 * acurácia real observada nesse grupo. Notas sem nenhum registro
 * aparecem com `sampleSize: 0` e métricas zeradas — nunca omitidas.
 */
export function calibrateQualityGrades(records: CalibrationRecord[]): QualityGradeCalibration[] {
  return GRADE_ORDER.map((grade) => {
    const group = records.filter((record) => record.explanation.quality.grade === grade);
    return {
      grade,
      sampleSize: group.length,
      metrics: computeEvaluationMetrics(group.map((record) => toOutcomeProbabilityPair(record.historical))),
    };
  });
}

/**
 * Verifica se a escala de notas está "monotonicamente calibrada": a
 * acurácia observada de A+ deveria ser >= A >= B+ >= B >= C >= D (dentro
 * de uma tolerância, já que amostras pequenas produzem ruído). Compara
 * apenas pares de notas com amostra suficiente (`minSampleSize`) — pares
 * sem amostra nunca entram na comparação, nunca fabricando uma violação
 * ou uma confirmação sem evidência.
 */
export function isQualityScaleMonotonic(calibration: QualityGradeCalibration[], minSampleSize: number, tolerance: number): boolean {
  const withSample = calibration.filter((item) => item.sampleSize >= minSampleSize);
  for (let i = 0; i < withSample.length - 1; i += 1) {
    if (withSample[i].metrics.accuracy + tolerance < withSample[i + 1].metrics.accuracy) return false;
  }
  return true;
}
