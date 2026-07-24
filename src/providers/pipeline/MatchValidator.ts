// Fase 2 — Data Ingestion Pipeline.
// MatchValidator: valida um InternalMatchDTO já normalizado. Reaproveita as
// regras de domínio puras da Fase 1 (src/services/esoccerDomainService.ts)
// para jogadores e placares, em vez de duplicá-las. Nunca lança exceção:
// devolve sempre um ValidationResult estruturado, para que a Pipeline
// decida o que fazer (emitir MatchRejected) sem precisar de try/catch.

import { ESoccerDomainValidationError, validateFinishedScore, validateMatchParticipants } from "../../services/esoccerDomainService.ts";
import type { InternalMatchDTO } from "../types/dto.ts";

export type ValidationIssue = { field: string; message: string };

export type ValidationResult = { valid: true } | { valid: false; errors: ValidationIssue[] };

const VALID_STATUSES = ["SCHEDULED", "LIVE", "FINISHED", "CANCELLED", "POSTPONED", "UNKNOWN"];
const VALID_PROVIDERS = ["FIXTURE", "BETSAPI", "CSV", "MANUAL"];

export function validateInternalMatch(match: InternalMatchDTO): ValidationResult {
  const errors: ValidationIssue[] = [];

  try {
    validateMatchParticipants(match.home.player.normalizedNickname, match.away.player.normalizedNickname);
  } catch (error) {
    errors.push({ field: "players", message: (error as ESoccerDomainValidationError).message });
  }

  if (!match.league || !match.league.name || match.league.name.trim().length === 0) {
    errors.push({ field: "league", message: "Liga ausente ou vazia." });
  }

  if (!match.scheduledAt || Number.isNaN(new Date(match.scheduledAt).getTime())) {
    errors.push({ field: "scheduledAt", message: `Data agendada inválida: "${match.scheduledAt}".` });
  }

  try {
    validateFinishedScore(match.status, match.homeScore, match.awayScore);
  } catch (error) {
    errors.push({ field: "score", message: (error as ESoccerDomainValidationError).message });
  }

  if (!VALID_STATUSES.includes(match.status)) {
    errors.push({ field: "status", message: `Status desconhecido: "${match.status}".` });
  }

  if (!VALID_PROVIDERS.includes(match.provider)) {
    errors.push({ field: "provider", message: `Provider desconhecido: "${match.provider}".` });
  }

  if (!match.sourcePayload || match.sourcePayload.trim().length === 0) {
    errors.push({ field: "payload", message: "Payload de origem (sourcePayload) ausente." });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
