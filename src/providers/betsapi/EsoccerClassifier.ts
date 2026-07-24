// Fase 3 - BetsAPI Real Integration.
// EsoccerClassifier: nao assume que todo evento de sport_id=1 (Soccer) e
// eSoccer. Combina múltiplos sinais independentes disponíveis no payload
// bruto da BetsAPI para classificar cada evento, sem depender de um unico
// campo:
//   - is_esports (quando presente no payload);
//   - padrao de participante "Equipe (nickname)" (parser da Fase 1);
//   - allowlist/denylist de ligas, configuraveis por variavel de ambiente.
//
// REGRA DE CLASSIFICACAO (PROVISORIA, documentada para recalibracao apos
// operacao real):
//   1. Liga em denylist            -> not_esoccer (override, para tudo).
//   2. Conta-se quantos sinais fortes concordam entre:
//        is_esports === true, padrao de participante batendo nos dois
//        lados, liga em allowlist.
//      >= 2 sinais fortes concordando -> confirmed_esoccer.
//      exatamente 1 sinal forte       -> probable_esoccer.
//   3. Se nenhum sinal forte e is_esports === false -> not_esoccer.
//   4. Caso contrario (sem nenhum sinal disponivel) -> unknown.
// Apenas confirmed_esoccer pode seguir para persistencia automatica.

import { parseESoccerParticipant } from "../../lib/esoccer/participantParser.ts";
import { normalizeVirtualTeamName } from "../../lib/esoccer/normalization.ts";
import type { BetsApiRawEvent } from "./BetsApiPayloads.ts";

export type EsoccerClassification = "confirmed_esoccer" | "probable_esoccer" | "not_esoccer" | "unknown";

export type EsoccerClassificationResult = {
  classification: EsoccerClassification;
  evidence: string[];
};

export type EsoccerClassifierConfig = {
  allowlist: string[];
  denylist: string[];
};

function normalizeSafe(value: string): string {
  try {
    return normalizeVirtualTeamName(value);
  } catch {
    return value.trim().toLowerCase();
  }
}

function parseIsEsportsFlag(value: BetsApiRawEvent["is_esports"]): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true") return true;
    if (normalized === "0" || normalized === "false") return false;
  }
  return null;
}

function participantsMatchPattern(event: BetsApiRawEvent): boolean {
  try {
    parseESoccerParticipant(event.home.name);
    parseESoccerParticipant(event.away.name);
    return true;
  } catch {
    return false;
  }
}

export function classifyEsoccerEvent(event: BetsApiRawEvent, config: EsoccerClassifierConfig): EsoccerClassificationResult {
  const evidence: string[] = [];
  const normalizedLeague = normalizeSafe(event.league?.name ?? "");
  const normalizedAllowlist = config.allowlist.map(normalizeSafe);
  const normalizedDenylist = config.denylist.map(normalizeSafe);

  if (normalizedLeague.length > 0 && normalizedDenylist.includes(normalizedLeague)) {
    evidence.push(`league_in_denylist:${normalizedLeague}`);
    return { classification: "not_esoccer", evidence };
  }

  const isEsports = parseIsEsportsFlag(event.is_esports);
  const participantPatternMatches = participantsMatchPattern(event);
  const inAllowlist = normalizedLeague.length > 0 && normalizedAllowlist.includes(normalizedLeague);

  if (isEsports === true) evidence.push("is_esports=true");
  if (isEsports === false) evidence.push("is_esports=false");
  if (participantPatternMatches) evidence.push("participant_pattern_matched");
  if (inAllowlist) evidence.push(`league_in_allowlist:${normalizedLeague}`);

  const strongSignalCount = [isEsports === true, participantPatternMatches, inAllowlist].filter(Boolean).length;

  if (strongSignalCount >= 2) {
    return { classification: "confirmed_esoccer", evidence };
  }
  if (strongSignalCount === 1) {
    return { classification: "probable_esoccer", evidence };
  }
  if (isEsports === false) {
    return { classification: "not_esoccer", evidence };
  }
  return { classification: "unknown", evidence };
}
