// Sprint 9.1 — Explainability Calibration & Backtest, Etapa 2/3.
// Dataset de calibração: casa (via `prediction-evaluation`, Sprint 4.5 —
// NUNCA reimplementado aqui) previsões reais já persistidas com
// resultados reais, e anexa a explicação estruturada (Sprint 9.0) de
// cada uma. Nunca recalcula a previsão nem o join — apenas lê o que os
// dois módulos anteriores já produzem. Função pura: sem acesso a
// Prisma/banco/rede/Railway (a leitura real do banco é responsabilidade
// exclusiva do script `scripts/calibration.mjs`, fora deste módulo).

import type { PredictionEvaluationConfig } from "../prediction-evaluation/index.ts";
import { DEFAULT_PREDICTION_EVALUATION_CONFIG, evaluateHistoricalDataset } from "../prediction-evaluation/index.ts";
import type {
  ActualMatchOutcome,
  EvaluationDataset,
  EvaluationDatasetSummary,
  EvaluationWarning,
  EvaluationRejection,
  EvaluationStatus,
  HistoricalPredictionRecord,
  PredictionSnapshot,
} from "../prediction-evaluation/index.ts";
import { buildPredictionExplanation } from "../prediction-explanation/index.ts";
import type { PredictionExplanationView } from "../prediction-explanation/index.ts";
import { computeDatasetProvenance, type DatasetProvenance, type RecordProvenanceTag } from "./DatasetProvenance.ts";

export type { ActualMatchOutcome, EvaluationDataset, HistoricalPredictionRecord, PredictionSnapshot };
export type { RecordProvenanceTag } from "./DatasetProvenance.ts";

/**
 * Um registro histórico (previsão real + resultado real, já casados pela
 * Sprint 4.5) mais a explicação estruturada (Sprint 9.0) derivada do
 * mesmo snapshot — nunca uma previsão nova, nunca um cálculo novo.
 */
export type CalibrationRecord = {
  historical: HistoricalPredictionRecord;
  explanation: PredictionExplanationView;
};

export type CalibrationDataset = {
  datasetId: string;
  records: CalibrationRecord[];
  /** Repassado sem alteração — origem da avaliação (join, deduplicação,
   * amostra) que produziu `records`. */
  datasetSummary: EvaluationDatasetSummary;
  warnings: EvaluationWarning[];
  rejectedRecords: EvaluationRejection[];
  status: EvaluationStatus;
  /** Proveniência (Sprint 9.1.1): de onde vieram as previsões deste
   * dataset — nunca inferida, sempre computada a partir das tags
   * fornecidas pelo chamador. */
  provenance: DatasetProvenance;
};

/**
 * Constrói o dataset de calibração a partir de previsões e resultados
 * reais brutos (mesmo formato de entrada de `EvaluationDataset`, Sprint
 * 4.5). `now` é usado apenas para a avaliação de risco `STALE_DATA`
 * dentro de cada explicação — nunca lido de `Date.now()` internamente.
 * `provenanceTags` (Sprint 9.1.1) identifica, previsão a previsão, se
 * cada uma veio de dado REAL ou SYNTHETIC — responsabilidade exclusiva
 * do chamador, nunca inferida aqui. `realDataAttempted` indica se uma
 * consulta a dado real chegou a ser tentada (mesmo que sem resultado).
 */
export function buildCalibrationDataset(
  dataset: EvaluationDataset,
  now: string,
  provenanceTags: RecordProvenanceTag[],
  realDataAttempted: boolean,
  config: PredictionEvaluationConfig = DEFAULT_PREDICTION_EVALUATION_CONFIG,
): CalibrationDataset {
  const evaluation = evaluateHistoricalDataset(dataset, config);

  return {
    datasetId: dataset.datasetId,
    records: evaluation.validRecords.map((historical) => ({
      historical,
      explanation: buildPredictionExplanation(historical.snapshot, now),
    })),
    datasetSummary: evaluation.datasetSummary,
    warnings: evaluation.warnings,
    rejectedRecords: evaluation.rejectedRecords,
    status: evaluation.status,
    provenance: computeDatasetProvenance(dataset.predictions.length, provenanceTags, evaluation.validRecords, evaluation.datasetSummary, evaluation.warnings, realDataAttempted),
  };
}
