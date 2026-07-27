// Fase 4 — Sprint 4.4 — Prediction Calibration & Quality Framework.
// Módulo principal: orquestra o Prediction Validator + Accuracy Metrics +
// Calibration Engine + Confidence Calibration em um único
// `PredictionQualityReport`. Não gera nenhuma nova previsão — mede a
// qualidade estatística de previsões já produzidas pelo Prediction
// Orchestrator (Sprint 4.3), fornecidas pelo chamador junto do resultado
// real de cada partida. Nunca acessa Prisma, rede ou número aleatório.
//
// Determinismo: para os mesmos `records`/`config`, o resultado numérico é
// sempre idêntico. `now` é injetável e usado apenas para preencher
// `generatedAt` — nunca para influenciar nenhuma métrica.

import { computeAccuracyMetrics } from "./AccuracyMetrics.ts";
import { computeBrierScoreReport, computeCalibrationCurve, computeLogLoss } from "./CalibrationEngine.ts";
import { computeConfidenceReliability, computeGreenScoreCalibration } from "./ConfidenceCalibration.ts";
import { validatePredictionQualityRecords } from "./PredictionValidator.ts";
import {
  DEFAULT_PREDICTION_QUALITY_CONFIG,
  validatePredictionQualityConfig,
  type PredictionQualityConfig,
} from "./PredictionQualityConfig.ts";
import type { PredictionQualityRecord, PredictionQualityReport } from "./types.ts";

export function buildPredictionQualityReport(
  records: PredictionQualityRecord[],
  config: PredictionQualityConfig = DEFAULT_PREDICTION_QUALITY_CONFIG,
  now: () => Date = () => new Date(),
): PredictionQualityReport {
  validatePredictionQualityConfig(config);

  const { valid, invalid } = validatePredictionQualityRecords(records);

  const accuracy = computeAccuracyMetrics(valid);
  const brierScore = computeBrierScoreReport(valid);
  const logLoss = computeLogLoss(valid);
  const calibrationCurve = computeCalibrationCurve(valid, config.calibrationBucketCount);
  const confidenceReliability = computeConfidenceReliability(valid, config.confidenceBucketCount, config.minSampleSizeForMonotonicityCheck);
  const greenScoreCalibration = computeGreenScoreCalibration(valid, config.minSampleSizeForMonotonicityCheck);

  const warnings: string[] = [];
  if (valid.length < config.minSampleSizeForReport) warnings.push("insufficient_sample_size");
  if (invalid.length > 0) warnings.push("invalid_records_excluded");
  if (!confidenceReliability.isMonotonic) warnings.push("non_monotonic_confidence_reliability");
  if (!greenScoreCalibration.isMonotonic) warnings.push("non_monotonic_green_score_calibration");

  return {
    modelVersion: config.modelVersion,
    generatedAt: now().toISOString(),
    sampleSize: records.length,
    validRecordCount: valid.length,
    invalidRecordCount: invalid.length,
    validationIssues: invalid,
    accuracy,
    brierScore,
    logLoss,
    calibrationCurve,
    confidenceReliability,
    greenScoreCalibration,
    warnings,
  };
}
