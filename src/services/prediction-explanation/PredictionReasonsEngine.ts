// Sprint 9.0 — Prediction Intelligence Framework, Etapa 3.
// Prediction Reasons: converte `result.explanation.topSignals` (Sprint
// 4.3 — já ranqueado por magnitude decrescente) em frases determinísticas
// em português, por um template fixo (`type` + `favors`), nunca geração
// de texto livre. Nunca reordena os sinais — a ordem de saída é
// exatamente a de `topSignals`. Função pura.

import type { PredictionResult } from "../prediction-orchestrator/index.ts";
import type { PredictionReason, PredictionSignalFavors, PredictionSignalType } from "./predictionExplanationTypes.ts";

const SIDE_LABEL: Record<Exclude<PredictionSignalFavors, "NEUTRAL">, string> = {
  HOME: "mandante",
  AWAY: "visitante",
};

/** Um template por `PredictionSignalType`. Sinais com `favors` HOME/AWAY
 * recebem o lado interpolado; sinais `NEUTRAL` (tendências de placar) têm
 * frase fixa, sem lado. */
const REASON_TEMPLATES: Record<PredictionSignalType, (favors: PredictionSignalFavors) => string> = {
  RATING_ADVANTAGE: (favors) => templateWithSide("Rating consideravelmente superior do", favors),
  FORM_ADVANTAGE: (favors) => templateWithSide("Equipe", favors, "em melhor fase recente"),
  STRENGTH_ADVANTAGE: (favors) => templateWithSide("Força geral superior do", favors),
  MOMENTUM_ADVANTAGE: (favors) => templateWithSide("Momentum recente favorece o", favors),
  HOME_FIELD_ADVANTAGE: (favors) => templateWithSide("Vantagem de mando de campo para o", favors),
  HEAD_TO_HEAD_ADVANTAGE: (favors) => templateWithSide("Histórico direto (H2H) favorece o", favors),
  GREEN_SCORE_ADVANTAGE: (favors) => templateWithSide("Green Score individual superior do", favors),
  GOAL_EXPECTATION_ADVANTAGE: (favors) => templateWithSide("Expectativa de gols superior para o", favors),
  HIGH_SCORING_TREND: () => "Tendência de partida com muitos gols",
  LOW_SCORING_TREND: () => "Tendência de partida com poucos gols",
};

function templateWithSide(prefix: string, favors: PredictionSignalFavors, suffix?: string): string {
  if (favors === "NEUTRAL") return suffix ? `${prefix} ${suffix}` : prefix;
  const side = SIDE_LABEL[favors];
  return suffix ? `${prefix} ${side} ${suffix}` : `${prefix} ${side}`;
}

/** Constrói as razões ordenadas por importância (Etapa 3) — mesma ordem
 * e mesmo conjunto de `topSignals` já computado pelo motor, nunca
 * reordenado ou filtrado novamente aqui. */
export function buildPredictionReasons(result: PredictionResult): PredictionReason[] {
  return result.explanation.topSignals.map((signal, index) => ({
    rank: index + 1,
    signalType: signal.type,
    favors: signal.favors,
    magnitude: signal.magnitude,
    text: REASON_TEMPLATES[signal.type](signal.favors),
  }));
}
