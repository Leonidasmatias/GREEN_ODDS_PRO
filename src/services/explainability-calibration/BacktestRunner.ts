// Sprint 9.1 — Explainability Calibration & Backtest.
// Sprint 9.1.1 — Calibration Data Integrity & Report Hardening.
// Orquestrador público: Backtest (Etapa 3, `CalibrationDataset.ts`) →
// Calibração (Etapa 4, `CalibrationAnalyzer.ts`) → Recomendações de
// threshold (Etapas 5-6, `ThresholdOptimizer.ts`) → proveniência,
// elegibilidade e status geral (Sprint 9.1.1). Os valores "atuais" de
// cada parâmetro são sempre informados pelo chamador
// (`CalibratableThresholds`) — este módulo nunca importa
// `predictionExplanationConstants.ts` para não acoplar silenciosamente
// a produção viva a este processo de análise. Função pura: nenhum
// threshold de produção é alterado em nenhuma hipótese.

import type { EvaluationDataset, EvaluationDatasetSummary, EvaluationWarning, EvaluationRejection, EvaluationStatus, PredictionEvaluationConfig } from "../prediction-evaluation/index.ts";
import { DEFAULT_PREDICTION_EVALUATION_CONFIG } from "../prediction-evaluation/index.ts";
import { buildCalibrationDataset, type CalibrationRecord, type RecordProvenanceTag } from "./CalibrationDataset.ts";
import { analyzeCalibration, type CalibrationAnalysis } from "./CalibrationAnalyzer.ts";
import { optimizeThreshold, type ThresholdRecommendation, type ThresholdSample } from "./ThresholdOptimizer.ts";
import type { DatasetProvenance } from "./DatasetProvenance.ts";
import { determineRecommendationEligibility, type RecommendationEligibility } from "./RecommendationEligibility.ts";
import { determineReportStatus, type ReportStatus } from "./ReportStatus.ts";

/** Valores atualmente vigentes em `predictionExplanationConstants.ts`
 * (Sprint 9.0) — fornecidos explicitamente pelo chamador (nunca lidos
 * automaticamente deste módulo) exatamente para que o processo de
 * calibração nunca dependa implicitamente do código de produção. */
export type CalibratableThresholds = {
  highVolatilityMarginThreshold: number;
  insufficientConfidenceHighThreshold: number;
  insufficientConfidenceMediumThreshold: number;
  qualityGradeAPlusMinScore: number;
};

/** Uma sugestão de threshold já classificada quanto à elegibilidade —
 * nunca decidida pelo `ThresholdOptimizer.ts` (que é estatística pura,
 * sem noção de proveniência) nem pelo relatório (que só formata). */
export type EligibleThresholdRecommendation = ThresholdRecommendation & { eligibility: RecommendationEligibility };

export type BacktestResult = {
  datasetId: string;
  datasetSummary: EvaluationDatasetSummary;
  warnings: EvaluationWarning[];
  rejectedRecords: EvaluationRejection[];
  status: EvaluationStatus;
  analysis: CalibrationAnalysis;
  recommendations: EligibleThresholdRecommendation[];
  provenance: DatasetProvenance;
  reportStatus: ReportStatus;
};

function isCorrect(record: CalibrationRecord): boolean {
  return record.historical.snapshot.result.prediction.predictedOutcome === record.historical.actual.outcome;
}

function marginSamples(records: CalibrationRecord[]): ThresholdSample[] {
  return records.map((record) => ({ value: record.historical.snapshot.result.prediction.probabilityMargin, correct: isCorrect(record) }));
}

function confidenceSamples(records: CalibrationRecord[]): ThresholdSample[] {
  return records.map((record) => ({ value: record.historical.snapshot.result.confidence, correct: isCorrect(record) }));
}

function qualityScoreSamples(records: CalibrationRecord[]): ThresholdSample[] {
  return records.map((record) => ({ value: record.explanation.quality.score, correct: isCorrect(record) }));
}

/**
 * Executa o backtest completo. `now` (ISO 8601) é repassado ao motor de
 * explicação (Sprint 9.0) para a avaliação de `STALE_DATA` — sempre
 * fornecido pelo chamador, nunca lido de `Date.now()` internamente.
 * `provenanceTags`/`realDataAttempted` (Sprint 9.1.1) vêm sempre do
 * chamador (o CLI é o único ponto que sabe a origem real de cada
 * previsão) e determinam a proveniência, a elegibilidade de cada
 * recomendação e o status geral do relatório.
 */
export function runBacktest(
  dataset: EvaluationDataset,
  now: string,
  currentThresholds: CalibratableThresholds,
  provenanceTags: RecordProvenanceTag[],
  realDataAttempted: boolean,
  config: PredictionEvaluationConfig = DEFAULT_PREDICTION_EVALUATION_CONFIG,
): BacktestResult {
  const calibrationDataset = buildCalibrationDataset(dataset, now, provenanceTags, realDataAttempted, config);
  const analysis = analyzeCalibration(calibrationDataset, config);

  const records = calibrationDataset.records;
  const provenance = calibrationDataset.provenance;

  const withEligibility = (recommendation: ThresholdRecommendation): EligibleThresholdRecommendation => ({
    ...recommendation,
    eligibility: determineRecommendationEligibility(provenance.origin, recommendation.sampleSize),
  });

  const recommendations: EligibleThresholdRecommendation[] = [
    withEligibility(optimizeThreshold("HIGH_VOLATILITY_MARGIN_THRESHOLD", marginSamples(records), currentThresholds.highVolatilityMarginThreshold)),
    withEligibility(optimizeThreshold("INSUFFICIENT_CONFIDENCE_HIGH_THRESHOLD", confidenceSamples(records), currentThresholds.insufficientConfidenceHighThreshold)),
    withEligibility(optimizeThreshold("INSUFFICIENT_CONFIDENCE_MEDIUM_THRESHOLD", confidenceSamples(records), currentThresholds.insufficientConfidenceMediumThreshold)),
    withEligibility(optimizeThreshold("QUALITY_GRADE_A_PLUS_MIN_SCORE", qualityScoreSamples(records), currentThresholds.qualityGradeAPlusMinScore)),
  ];

  return {
    datasetId: calibrationDataset.datasetId,
    datasetSummary: calibrationDataset.datasetSummary,
    warnings: calibrationDataset.warnings,
    rejectedRecords: calibrationDataset.rejectedRecords,
    status: calibrationDataset.status,
    analysis,
    recommendations,
    provenance,
    reportStatus: determineReportStatus(provenance),
  };
}
