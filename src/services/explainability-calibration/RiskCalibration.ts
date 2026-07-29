// Sprint 9.1 — Explainability Calibration & Backtest, Etapa 4.
// Risk Calibration: para cada `PredictionRiskCode` (Sprint 9.0), mede
// frequência real e impacto real na acurácia — comparando o grupo de
// registros em que o risco apareceu contra o grupo em que não apareceu.
// Reaproveita `computeEvaluationMetrics` (Sprint 4.5), nunca reimplementa
// acurácia/Brier/Log Loss. Função pura.

import { computeEvaluationMetrics, toOutcomeProbabilityPair } from "../prediction-evaluation/index.ts";
import type { EvaluationMetrics } from "../prediction-evaluation/index.ts";
import type { PredictionRiskCode } from "../prediction-explanation/index.ts";
import type { CalibrationRecord } from "./CalibrationDataset.ts";

export type RiskCodeCalibration = {
  code: PredictionRiskCode;
  /** Quantos registros do dataset tiveram este risco sinalizado. */
  frequency: number;
  /** `frequency / total` — 0 quando o dataset está vazio. */
  frequencyRate: number;
  metricsWithRisk: EvaluationMetrics;
  metricsWithoutRisk: EvaluationMetrics;
  /**
   * `metricsWithoutRisk.accuracy - metricsWithRisk.accuracy`. Positivo
   * significa que o risco de fato correlaciona com acurácia menor
   * (comportamento esperado de um risco genuíno); próximo de zero ou
   * negativo sugere que o risco, nos dados observados, não está
   * correlacionado com erro — nunca interpretado aqui como "o risco é
   * inútil", apenas reportado como está.
   */
  accuracyImpact: number;
};

const RISK_CODES: PredictionRiskCode[] = [
  "LOW_SAMPLE_SIZE",
  "STALE_DATA",
  "INDICATOR_CONFLICT",
  "INSUFFICIENT_CONFIDENCE",
  "HIGH_VOLATILITY",
  "NO_HEAD_TO_HEAD_HISTORY",
];

export function calibrateRiskIndicators(records: CalibrationRecord[]): RiskCodeCalibration[] {
  const total = records.length;

  return RISK_CODES.map((code) => {
    const withRisk = records.filter((record) => record.explanation.risks.some((risk) => risk.code === code));
    const withoutRisk = records.filter((record) => !record.explanation.risks.some((risk) => risk.code === code));
    const metricsWithRisk = computeEvaluationMetrics(withRisk.map((record) => toOutcomeProbabilityPair(record.historical)));
    const metricsWithoutRisk = computeEvaluationMetrics(withoutRisk.map((record) => toOutcomeProbabilityPair(record.historical)));

    return {
      code,
      frequency: withRisk.length,
      frequencyRate: total > 0 ? withRisk.length / total : 0,
      metricsWithRisk,
      metricsWithoutRisk,
      accuracyImpact: metricsWithoutRisk.accuracy - metricsWithRisk.accuracy,
    };
  });
}
