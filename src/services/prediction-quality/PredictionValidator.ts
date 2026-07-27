// Fase 4 — Sprint 4.4 — Prediction Calibration & Quality Framework.
// Prediction Validator: verifica que cada registro é utilizável antes de
// alimentar qualquer métrica — nunca deixa um número inválido (NaN,
// Infinity, probabilidade fora de [0,1] ou fora de soma 1) corromper
// silenciosamente uma estatística agregada. Registros inválidos são
// excluídos e reportados com o motivo, nunca "corrigidos" às cegas.
// Função pura: nenhum acesso a Prisma, rede, relógio do sistema ou número
// aleatório.

import { isFiniteNumber, type MatchOutcome, type PredictionQualityRecord, type ValidatedRecords } from "./types.ts";

const VALID_OUTCOMES: MatchOutcome[] = ["HOME_WIN", "DRAW", "AWAY_WIN"];
const VALID_GREEN_SCORE_CATEGORIES = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"];
const PROBABILITY_SUM_TOLERANCE = 1e-6;

function findInvalidReason(record: PredictionQualityRecord): string | null {
  if (typeof record.matchId !== "string" || record.matchId.trim().length === 0) {
    return "missing_or_empty_matchId";
  }
  if (typeof record.homePlayerId !== "string" || record.homePlayerId.trim().length === 0) {
    return "missing_or_empty_homePlayerId";
  }
  if (typeof record.awayPlayerId !== "string" || record.awayPlayerId.trim().length === 0) {
    return "missing_or_empty_awayPlayerId";
  }
  if (!VALID_OUTCOMES.includes(record.actualOutcome)) {
    return "invalid_actualOutcome";
  }

  const { homeWin, draw, awayWin } = record.result.prediction.probabilities;
  for (const [name, value] of Object.entries({ homeWin, draw, awayWin })) {
    if (!isFiniteNumber(value) || value < 0 || value > 1) {
      return `invalid_probability_${name}`;
    }
  }
  if (Math.abs(homeWin + draw + awayWin - 1) > PROBABILITY_SUM_TOLERANCE) {
    return "probabilities_do_not_sum_to_one";
  }

  if (!VALID_OUTCOMES.includes(record.result.prediction.predictedOutcome)) {
    return "invalid_predictedOutcome";
  }
  if (!isFiniteNumber(record.result.prediction.topProbability) || record.result.prediction.topProbability < 0 || record.result.prediction.topProbability > 1) {
    return "invalid_topProbability";
  }

  if (!isFiniteNumber(record.result.confidence) || record.result.confidence < 0 || record.result.confidence > 100) {
    return "invalid_confidence";
  }

  if (!isFiniteNumber(record.result.greenScore.score) || record.result.greenScore.score < 0 || record.result.greenScore.score > 100) {
    return "invalid_greenScore_score";
  }
  if (!VALID_GREEN_SCORE_CATEGORIES.includes(record.result.greenScore.category)) {
    return "invalid_greenScore_category";
  }

  return null;
}

/**
 * Separa os registros válidos dos inválidos, com o motivo estruturado de
 * cada exclusão. Nunca lança erro — um registro malformado é um dado de
 * qualidade a ser reportado, não uma falha de execução.
 */
export function validatePredictionQualityRecords(records: PredictionQualityRecord[]): ValidatedRecords {
  const valid: PredictionQualityRecord[] = [];
  const invalid: ValidatedRecords["invalid"] = [];

  for (const record of records) {
    const reason = findInvalidReason(record);
    if (reason) invalid.push({ matchId: record.matchId ?? "unknown", reason });
    else valid.push(record);
  }

  return { valid, invalid };
}
