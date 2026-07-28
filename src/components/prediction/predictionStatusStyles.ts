// Sprint 6.5 — Prediction Center.
// Mapeamento centralizado de tom visual (cor) por status técnico —
// única fonte de verdade para todos os badges do Prediction Center,
// nunca duplicado por componente. Cor nunca é a única forma de
// transmitir a informação: todo badge que consome este mapa também
// exibe o rótulo textual correspondente. Mesmo padrão de
// `intelligenceStatusStyles.ts` (Sprint 6.0).

import type { GreenScoreCategory, PredictionCenterItemStatus, PredictionRiskLevel } from "@/lib/predictionCenterTypes";

export const predictionItemStatusStyles: Record<PredictionCenterItemStatus, string> = {
  success: "border-neon/25 bg-neon/10 text-neon",
  partial: "border-amber-300/25 bg-amber-300/10 text-amber-300",
};

export const predictionRiskLevelStyles: Record<PredictionRiskLevel, string> = {
  LOW: "border-neon/25 bg-neon/10 text-neon",
  MEDIUM: "border-amber-300/25 bg-amber-300/10 text-amber-300",
  HIGH: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  ELEVATED: "border-red-500/25 bg-red-500/10 text-red-400",
};

export const greenScoreCategoryStyles: Record<GreenScoreCategory, string> = {
  LOW: "border-red-500/25 bg-red-500/10 text-red-400",
  MEDIUM: "border-amber-300/25 bg-amber-300/10 text-amber-300",
  HIGH: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  VERY_HIGH: "border-neon/25 bg-neon/10 text-neon",
};
