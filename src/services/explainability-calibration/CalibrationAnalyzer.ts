// Sprint 9.1 — Explainability Calibration & Backtest, Etapa 4.
// Analyzer: compõe a Confidence Calibration (reaproveitando os segmentos
// `CONFIDENCE_BUCKET` já calculados pela Sprint 4.5 — nunca
// reimplementados), a Quality Calibration e a Risk Calibration (deste
// módulo), e a Factor Importance (nova nesta sprint, mas usando
// exclusivamente `computeEvaluationMetrics` já existente). Função pura.

import { computeEvaluationMetrics, computeSegmentEvaluations, DEFAULT_PREDICTION_EVALUATION_CONFIG, toOutcomeProbabilityPair } from "../prediction-evaluation/index.ts";
import type { EvaluationMetrics, PredictionEvaluationConfig, SegmentEvaluation } from "../prediction-evaluation/index.ts";
import type { PredictionFactorCode } from "../prediction-explanation/index.ts";
import type { CalibrationDataset, CalibrationRecord } from "./CalibrationDataset.ts";
import { calibrateQualityGrades, isQualityScaleMonotonic, type QualityGradeCalibration } from "./QualityCalibration.ts";
import { calibrateRiskIndicators, type RiskCodeCalibration } from "./RiskCalibration.ts";

export type FactorImportance = {
  code: PredictionFactorCode;
  /** Registros em que o fator estava `AVAILABLE`. */
  availableSampleSize: number;
  metricsWhenAvailable: EvaluationMetrics;
  metricsWhenUnavailable: EvaluationMetrics;
  /** `metricsWhenAvailable.accuracy - metricsWhenUnavailable.accuracy`.
   * Positivo sugere que ter esse dado disponível correlaciona com
   * previsões mais acertadas nos dados observados. */
  accuracyImpact: number;
};

const FACTOR_CODES: PredictionFactorCode[] = [
  "RECENT_FORM",
  "TEAM_STRENGTH",
  "GOALS_AVERAGE",
  "HOME_AWAY_PERFORMANCE",
  "HEAD_TO_HEAD",
  "SAMPLE_CONSISTENCY",
  "DATA_CONFIDENCE",
];

function calibrateFactorImportance(records: CalibrationRecord[]): FactorImportance[] {
  return FACTOR_CODES.map((code) => {
    const available = records.filter((record) => record.explanation.factors.find((factor) => factor.code === code)?.availability === "AVAILABLE");
    const unavailable = records.filter((record) => record.explanation.factors.find((factor) => factor.code === code)?.availability !== "AVAILABLE");
    const metricsWhenAvailable = computeEvaluationMetrics(available.map((record) => toOutcomeProbabilityPair(record.historical)));
    const metricsWhenUnavailable = computeEvaluationMetrics(unavailable.map((record) => toOutcomeProbabilityPair(record.historical)));
    return {
      code,
      availableSampleSize: available.length,
      metricsWhenAvailable,
      metricsWhenUnavailable,
      accuracyImpact: metricsWhenAvailable.accuracy - metricsWhenUnavailable.accuracy,
    };
  });
}

export type CalibrationAnalysis = {
  /** Segmentos `CONFIDENCE_BUCKET`, reaproveitados sem alteração da
   * Sprint 4.5 — a curva de calibração de Confidence pedida pela missão. */
  confidenceCalibration: SegmentEvaluation[];
  qualityCalibration: QualityGradeCalibration[];
  qualityScaleMonotonic: boolean;
  riskCalibration: RiskCodeCalibration[];
  factorImportance: FactorImportance[];
};

/**
 * Executa a análise completa (Etapa 4) sobre um `CalibrationDataset` já
 * construído (Etapa 3). `config` controla apenas os buckets de
 * confiança e o tamanho mínimo de amostra por segmento — os mesmos
 * parâmetros já validados pela Sprint 4.5.
 */
export function analyzeCalibration(dataset: CalibrationDataset, config: PredictionEvaluationConfig = DEFAULT_PREDICTION_EVALUATION_CONFIG): CalibrationAnalysis {
  const historicalRecords = dataset.records.map((record) => record.historical);
  const allSegments = computeSegmentEvaluations(historicalRecords, { ...config, enabledSegments: ["CONFIDENCE_BUCKET"] });

  const qualityCalibration = calibrateQualityGrades(dataset.records);

  return {
    confidenceCalibration: allSegments,
    qualityCalibration,
    qualityScaleMonotonic: isQualityScaleMonotonic(qualityCalibration, config.minRecordsPerSegment, 0.05),
    riskCalibration: calibrateRiskIndicators(dataset.records),
    factorImportance: calibrateFactorImportance(dataset.records),
  };
}
