// Sprint 9.0 — Prediction Intelligence Framework, Etapa 4.
// Risk Indicators: classifica riscos operacionais a partir de campos já
// calculados (`quality`, `confidence`, `probabilityMargin`,
// `dataSufficiency`, `metadata.generatedAt`) — nunca recalcula
// probabilidade/Green Score/Confidence. Função pura: `now` é sempre
// injetado pelo chamador, nunca lido de `Date.now()` internamente (mesma
// convenção já usada em todo o Prediction Orchestrator para
// determinismo/testabilidade).

import type { PredictionResult } from "../prediction-orchestrator/index.ts";
import {
  HIGH_VOLATILITY_MARGIN_THRESHOLD,
  INSUFFICIENT_CONFIDENCE_HIGH_THRESHOLD,
  INSUFFICIENT_CONFIDENCE_MEDIUM_THRESHOLD,
  STALE_DATA_HOURS,
} from "./predictionExplanationConstants.ts";
import type { PredictionRiskIndicator } from "./predictionExplanationTypes.ts";

function lowSampleSizeRisk(result: PredictionResult): PredictionRiskIndicator | null {
  const status = result.quality.combinedStatus;
  if (status === "INSUFFICIENT") return { code: "LOW_SAMPLE_SIZE", severity: "HIGH", description: "Amostra de dados insuficiente para uma previsão confiável." };
  if (status === "LIMITED") return { code: "LOW_SAMPLE_SIZE", severity: "MEDIUM", description: "Amostra de dados limitada — previsão baseada em poucos jogos." };
  return null;
}

function staleDataRisk(result: PredictionResult, now: string): PredictionRiskIndicator | null {
  const generatedAtMs = Date.parse(result.metadata.generatedAt);
  const nowMs = Date.parse(now);
  if (Number.isNaN(generatedAtMs) || Number.isNaN(nowMs)) return null;
  const hoursElapsed = (nowMs - generatedAtMs) / (1000 * 60 * 60);
  if (hoursElapsed <= STALE_DATA_HOURS) return null;
  const severity = hoursElapsed > STALE_DATA_HOURS * 3 ? "HIGH" : "MEDIUM";
  return { code: "STALE_DATA", severity, description: "Previsão gerada há mais de 24 horas — dados de base podem estar desatualizados." };
}

function indicatorConflictRisk(result: PredictionResult): PredictionRiskIndicator | null {
  const level = result.quality.consistency.level;
  if (level === "MAJOR_DIVERGENCE") return { code: "INDICATOR_CONFLICT", severity: "HIGH", description: "Divergência relevante entre o motor de resultado e o de distribuição de gols." };
  if (level === "MINOR_DIVERGENCE") return { code: "INDICATOR_CONFLICT", severity: "LOW", description: "Leve divergência entre o motor de resultado e o de distribuição de gols." };
  return null;
}

function insufficientConfidenceRisk(result: PredictionResult): PredictionRiskIndicator | null {
  if (result.confidence < INSUFFICIENT_CONFIDENCE_HIGH_THRESHOLD) {
    return { code: "INSUFFICIENT_CONFIDENCE", severity: "HIGH", description: "Confiança do modelo abaixo do nível mínimo recomendado." };
  }
  if (result.confidence < INSUFFICIENT_CONFIDENCE_MEDIUM_THRESHOLD) {
    return { code: "INSUFFICIENT_CONFIDENCE", severity: "MEDIUM", description: "Confiança do modelo moderada — avaliar com cautela." };
  }
  return null;
}

function highVolatilityRisk(result: PredictionResult): PredictionRiskIndicator | null {
  if (result.prediction.probabilityMargin >= HIGH_VOLATILITY_MARGIN_THRESHOLD) return null;
  return { code: "HIGH_VOLATILITY", severity: "MEDIUM", description: "Margem estreita entre o resultado mais provável e o segundo colocado — previsão pouco decisiva." };
}

function noHeadToHeadHistoryRisk(result: PredictionResult): PredictionRiskIndicator | null {
  if (result.prediction.dataSufficiency.headToHeadSampleSize > 0) return null;
  return { code: "NO_HEAD_TO_HEAD_HISTORY", severity: "LOW", description: "Nenhum confronto direto (H2H) encontrado entre os dois jogadores." };
}

/** Constrói a lista de riscos aplicáveis (Etapa 4) — só inclui um código
 * quando a condição real for verdadeira; nunca uma lista fixa de 6
 * itens. `now` (ISO 8601) deve ser fornecido pelo chamador. */
export function buildRiskIndicators(result: PredictionResult, now: string): PredictionRiskIndicator[] {
  const risks = [
    lowSampleSizeRisk(result),
    staleDataRisk(result, now),
    indicatorConflictRisk(result),
    insufficientConfidenceRisk(result),
    highVolatilityRisk(result),
    noHeadToHeadHistoryRisk(result),
  ];
  return risks.filter((risk): risk is PredictionRiskIndicator => risk !== null);
}
