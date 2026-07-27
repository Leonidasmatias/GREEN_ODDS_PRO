// Fase 4 — Sprint 4.4 — Prediction Calibration & Quality Framework.
// Confidence Calibration: responde se um `confidence` (Prediction
// Orchestrator, Sprint 4.3) ou `greenScore.category` mais alto realmente
// corresponde a uma taxa de acerto mais alta — nunca inventa essa
// correlação, apenas mede se ela existe nos registros fornecidos.
// Funções puras: nenhum acesso a Prisma, rede, relógio do sistema ou
// número aleatório.

import type {
  ConfidenceReliabilityBucket,
  ConfidenceReliabilityResult,
  GreenScoreCalibrationBucket,
  GreenScoreCalibrationResult,
  GreenScoreCategory,
  PredictionQualityRecord,
} from "./types.ts";

function isCorrect(record: PredictionQualityRecord): boolean {
  return record.result.prediction.predictedOutcome === record.actualOutcome;
}

/**
 * Agrupa os registros em `bucketCount` faixas igualmente espaçadas de
 * `confidence` (0..100, Sprint 4.3) e compara a taxa de acerto observada
 * entre faixas. `isMonotonic` verifica se a taxa de acerto nunca cai ao
 * passar de uma faixa para a próxima com amostra suficiente
 * (`minSampleSizeForMonotonicityCheck`) — faixas com amostra pequena são
 * reportadas mas ignoradas na comparação, para que ruído estatístico não
 * invalide a avaliação inteira.
 */
export function computeConfidenceReliability(
  records: PredictionQualityRecord[],
  bucketCount: number,
  minSampleSizeForMonotonicityCheck: number,
): ConfidenceReliabilityResult {
  const buckets: ConfidenceReliabilityBucket[] = [];

  for (let i = 0; i < bucketCount; i += 1) {
    const bucketStart = (i / bucketCount) * 100;
    const bucketEnd = ((i + 1) / bucketCount) * 100;
    const isLastBucket = i === bucketCount - 1;

    const inBucket = records.filter((record) => {
      const confidence = record.result.confidence;
      return confidence >= bucketStart && (isLastBucket ? confidence <= bucketEnd : confidence < bucketEnd);
    });

    const sampleSize = inBucket.length;
    const averageConfidence =
      sampleSize > 0 ? inBucket.reduce((sum, record) => sum + record.result.confidence, 0) / sampleSize : 0;
    const observedAccuracy = sampleSize > 0 ? inBucket.filter(isCorrect).length / sampleSize : 0;

    buckets.push({ bucketStart, bucketEnd, sampleSize, averageConfidence, observedAccuracy });
  }

  const comparable = buckets.filter((bucket) => bucket.sampleSize >= minSampleSizeForMonotonicityCheck);
  let isMonotonic = true;
  for (let i = 1; i < comparable.length; i += 1) {
    if (comparable[i].observedAccuracy < comparable[i - 1].observedAccuracy) {
      isMonotonic = false;
      break;
    }
  }

  return { buckets, isMonotonic };
}

const GREEN_SCORE_CATEGORY_ORDER: GreenScoreCategory[] = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"];

/**
 * Agrupa os registros pelas quatro categorias fixas de Green Score
 * (Sprint 4.3) e compara a taxa de acerto observada entre elas, na ordem
 * natural `LOW < MEDIUM < HIGH < VERY_HIGH`. Mesma regra de
 * monotonicidade tolerante a amostra pequena do `computeConfidenceReliability`.
 */
export function computeGreenScoreCalibration(
  records: PredictionQualityRecord[],
  minSampleSizeForMonotonicityCheck: number,
): GreenScoreCalibrationResult {
  const buckets: GreenScoreCalibrationBucket[] = GREEN_SCORE_CATEGORY_ORDER.map((category) => {
    const inCategory = records.filter((record) => record.result.greenScore.category === category);
    const sampleSize = inCategory.length;
    const observedAccuracy = sampleSize > 0 ? inCategory.filter(isCorrect).length / sampleSize : 0;
    return { category, sampleSize, observedAccuracy };
  });

  const comparable = buckets.filter((bucket) => bucket.sampleSize >= minSampleSizeForMonotonicityCheck);
  let isMonotonic = true;
  for (let i = 1; i < comparable.length; i += 1) {
    if (comparable[i].observedAccuracy < comparable[i - 1].observedAccuracy) {
      isMonotonic = false;
      break;
    }
  }

  return { buckets, isMonotonic };
}
