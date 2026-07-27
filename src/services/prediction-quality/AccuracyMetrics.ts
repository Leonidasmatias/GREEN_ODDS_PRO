// Fase 4 — Sprint 4.4 — Prediction Calibration & Quality Framework.
// Accuracy Metrics: acurácia, matriz de confusão e precisão/recall por
// classe (mandante/empate/visitante), com macro-médias. Função pura:
// nenhum acesso a Prisma, rede, relógio do sistema ou número aleatório.

import type { AccuracyMetricsResult, MatchOutcome, MatchOutcomeConfusionMatrix, PerClassMetric, PredictionQualityRecord } from "./types.ts";

const OUTCOMES: MatchOutcome[] = ["HOME_WIN", "DRAW", "AWAY_WIN"];

function emptyConfusionMatrix(): MatchOutcomeConfusionMatrix {
  const matrix = {} as MatchOutcomeConfusionMatrix;
  for (const actual of OUTCOMES) {
    matrix[actual] = { HOME_WIN: 0, DRAW: 0, AWAY_WIN: 0 };
  }
  return matrix;
}

/**
 * Calcula precisão/recall para uma classe (`outcome`) a partir da matriz
 * de confusão. Quando não houve previsões para a classe
 * (`truePositives+falsePositives===0`) ou a classe nunca ocorreu de fato
 * (`truePositives+falseNegatives===0`), a métrica correspondente é `0` —
 * um valor conservador explícito, nunca `NaN` — e o campo `support`
 * permite ao chamador distinguir esse caso de uma classe genuinamente
 * malcalibrada.
 */
function computePerClassMetric(outcome: MatchOutcome, confusionMatrix: MatchOutcomeConfusionMatrix): PerClassMetric {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const actual of OUTCOMES) {
    for (const predicted of OUTCOMES) {
      const count = confusionMatrix[actual][predicted];
      if (actual === outcome && predicted === outcome) truePositives += count;
      else if (actual !== outcome && predicted === outcome) falsePositives += count;
      else if (actual === outcome && predicted !== outcome) falseNegatives += count;
    }
  }

  const support = truePositives + falseNegatives;
  const predictedCount = truePositives + falsePositives;

  return {
    outcome,
    truePositives,
    falsePositives,
    falseNegatives,
    support,
    precision: predictedCount > 0 ? truePositives / predictedCount : 0,
    recall: support > 0 ? truePositives / support : 0,
  };
}

/**
 * Calcula acurácia, matriz de confusão e precisão/recall por classe (com
 * macro-médias simples sobre as três classes) a partir dos registros já
 * validados. Devolve um resultado zerado (sem lançar erro) para uma lista
 * vazia — o sinalizador de amostra insuficiente é responsabilidade do
 * relatório final, não desta função.
 */
export function computeAccuracyMetrics(records: PredictionQualityRecord[]): AccuracyMetricsResult {
  const confusionMatrix = emptyConfusionMatrix();
  let correct = 0;

  for (const record of records) {
    const predicted = record.result.prediction.predictedOutcome;
    confusionMatrix[record.actualOutcome][predicted] += 1;
    if (predicted === record.actualOutcome) correct += 1;
  }

  const sampleSize = records.length;
  const perClass = OUTCOMES.map((outcome) => computePerClassMetric(outcome, confusionMatrix));
  const macroPrecision = perClass.reduce((sum, metric) => sum + metric.precision, 0) / perClass.length;
  const macroRecall = perClass.reduce((sum, metric) => sum + metric.recall, 0) / perClass.length;

  return {
    sampleSize,
    accuracy: sampleSize > 0 ? correct / sampleSize : 0,
    confusionMatrix,
    perClass,
    macroPrecision,
    macroRecall,
  };
}
