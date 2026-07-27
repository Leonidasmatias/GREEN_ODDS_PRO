// Fase 4 — Sprint 4.1 — Prediction Engine Foundation.
// Tipos compartilhados pelo Prediction Engine. Nenhum tipo aqui depende do
// Prisma Client — o motor inteiro opera sobre os resultados já produzidos
// pelo Intelligence Engine (Fase 1.5), recebidos como entrada pelo chamador.
// Esta fase cobre exclusivamente o mercado 1X2 (HOME_WIN/DRAW/AWAY_WIN);
// mercados de gols pertencem à Sprint 4.2 (Goal Distribution Engine).

import type { PlayerRatingResult } from "../intelligence/RatingEngine.ts";
import type { FormSnapshot } from "../intelligence/FormEngine.ts";
import type { HomeAwaySnapshot } from "../intelligence/HomeAwayEngine.ts";
import type { MomentumResult } from "../intelligence/MomentumEngine.ts";
import type { StrengthResult } from "../intelligence/StrengthEngine.ts";
import type { ConfidenceResult } from "../intelligence/ConfidenceEngine.ts";
import type { GreenScoreResult } from "../intelligence/GreenScoreEngine.ts";
import type { HeadToHeadResult } from "../intelligence/HeadToHeadEngine.ts";

/** Clampa um valor numérico entre min e max (min=-1, max=1 por padrão neste módulo). */
export function clamp(value: number, min = -1, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

/** true somente para números finitos (rejeita NaN, +Infinity, -Infinity e não-números). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export type MatchOutcome = "HOME_WIN" | "DRAW" | "AWAY_WIN";

/**
 * Perfil estatístico de UM jogador para uma previsão específica, montado
 * inteiramente a partir dos resultados já calculados pelos módulos 1-9 do
 * Intelligence Engine (Fase 1.5). Qualquer campo pode ser `null` quando o
 * indicador correspondente não pôde ser calculado (ex.: jogador estreante
 * sem histórico) — o Prediction Engine nunca fabrica esses valores.
 *
 * `matchesCount` é a amostra total de partidas finalizadas do jogador e é a
 * autoridade para a avaliação de suficiência de dados (Módulo de Data
 * Sufficiency), independente de quais dos campos abaixo estão disponíveis.
 */
export type PlayerPredictionInputs = {
  playerId: string;
  matchesCount: number;
  rating: PlayerRatingResult | null;
  form: FormSnapshot | null;
  homeAway: HomeAwaySnapshot | null;
  momentum: MomentumResult | null;
  strength: StrengthResult | null;
  confidence: ConfidenceResult | null;
  greenScore: GreenScoreResult | null;
};

/**
 * Requisição completa de previsão de resultado 1X2. `headToHead` é o
 * resultado já calculado pelo Módulo 5 (HeadToHeadEngine) para o par
 * (homePlayer, awayPlayer), em qualquer orientação canônica — o Prediction
 * Engine reorienta internamente para a perspectiva mandante/visitante real
 * desta partida.
 */
export type MatchOutcomePredictionRequest = {
  homePlayer: PlayerPredictionInputs;
  awayPlayer: PlayerPredictionInputs;
  headToHead: HeadToHeadResult | null;
};

export type FeatureAvailability = "AVAILABLE" | "MISSING" | "NOT_APPLICABLE";
export type FeatureDirection = "FAVORS_HOME" | "FAVORS_DRAW" | "FAVORS_AWAY" | "NEUTRAL";

/**
 * Rastro de UMA feature usada no modelo: valor bruto (unidade original do
 * domínio, quando aplicável), valor normalizado (-1..1 para as features de
 * tilt casa/fora, 0..1 para o componente de empate), peso configurado,
 * contribuição final (peso * valor normalizado) e disponibilidade/direção
 * para explicabilidade. `rawValue`/`normalizedValue` são `null` quando
 * `availability !== "AVAILABLE"`, e também para features compostas (ex.:
 * `drawBalance`) que não têm um único valor bruto de domínio.
 */
export type PredictionFeatureTrace = {
  name: string;
  rawValue: number | null;
  normalizedValue: number | null;
  weight: number;
  contribution: number;
  availability: FeatureAvailability;
  direction: FeatureDirection;
};

export type DataSufficiencyStatus = "INSUFFICIENT" | "LIMITED" | "SUFFICIENT" | "STRONG";

export type DataSufficiencyResult = {
  status: DataSufficiencyStatus;
  sampleSize: number;
  homeSampleSize: number;
  awaySampleSize: number;
  headToHeadSampleSize: number;
  warnings: string[];
};

/**
 * Saída pública do Prediction Engine. `generatedAt` é informativo apenas —
 * nunca influencia o cálculo das probabilidades (injetado via parâmetro
 * `now`, nunca lido de `Date.now()` dentro da lógica matemática).
 */
export type MatchOutcomePrediction = {
  modelVersion: string;
  generatedAt: string;
  probabilities: {
    homeWin: number;
    draw: number;
    awayWin: number;
  };
  predictedOutcome: MatchOutcome;
  topProbability: number;
  probabilityMargin: number;
  dataSufficiency: DataSufficiencyResult;
  featureTrace: PredictionFeatureTrace[];
};
