// Sprint 8.2 — Prediction Dashboard and Timeline.
// Mapeamento de tom visual (cor) para o badge de `combinedStatus` — não
// existe em `predictionStatusStyles.ts` (Sprint 6.5), que só cobre
// `greenScoreCategory`/`PredictionRiskLevel`. Mesma regra: cor nunca é a
// única forma de transmitir a informação — todo badge que consome este
// mapa também exibe o rótulo textual (`formatPredictionCombinedStatus`).
// `default` cobre um valor não reconhecido vindo da fronteira `string`
// bruta da API (nunca quebra o layout por um dado inesperado).
import type { DataSufficiencyStatus } from "@/lib/predictionCenterTypes";

export const dataSufficiencyStatusStyles: Record<DataSufficiencyStatus, string> = {
  INSUFFICIENT: "border-red-500/25 bg-red-500/10 text-red-400",
  LIMITED: "border-amber-300/25 bg-amber-300/10 text-amber-300",
  SUFFICIENT: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  STRONG: "border-neon/25 bg-neon/10 text-neon",
};

export const defaultBadgeStyle = "border-line bg-white/[.03] text-zinc-400";

export function resolveDataSufficiencyStyle(status: string): string {
  return status in dataSufficiencyStatusStyles ? dataSufficiencyStatusStyles[status as DataSufficiencyStatus] : defaultBadgeStyle;
}

export function resolveGreenScoreStyle(category: string, styles: Record<string, string>): string {
  return category in styles ? styles[category] : defaultBadgeStyle;
}
