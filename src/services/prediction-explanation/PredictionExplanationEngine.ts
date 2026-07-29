// Sprint 9.0 — Prediction Intelligence Framework.
// Composição pública: combina os 5 motores desta sprint (Etapas 1-5) em
// uma única saída estruturada (`PredictionExplanationView`). Recebe o
// `PredictionSnapshot` já persistido (Sprint 4.5/7.x) — nunca chama
// `predictMatch`, nunca acessa Prisma/Repository. Função pura; `now`
// (ISO 8601) é sempre fornecido pelo chamador.

import type { PredictionSnapshot } from "../prediction-evaluation/index.ts";
import { buildPredictionFactors } from "./PredictionFactorsEngine.ts";
import { buildConfidenceBreakdown } from "./ConfidenceBreakdownEngine.ts";
import { buildPredictionReasons } from "./PredictionReasonsEngine.ts";
import { buildRiskIndicators } from "./RiskIndicatorEngine.ts";
import { buildPredictionQualityScore } from "./QualityScoreEngine.ts";
import type { PredictionExplanationView } from "./predictionExplanationTypes.ts";

export function buildPredictionExplanation(snapshot: PredictionSnapshot, now: string): PredictionExplanationView {
  const { result } = snapshot;
  return {
    factors: buildPredictionFactors(result),
    confidenceBreakdown: buildConfidenceBreakdown(result),
    reasons: buildPredictionReasons(result),
    risks: buildRiskIndicators(result, now),
    quality: buildPredictionQualityScore(result),
  };
}
