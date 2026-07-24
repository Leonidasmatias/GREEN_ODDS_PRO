// Fase 1 — Fundação do domínio eSoccer.
// Parser do formato "<equipe virtual> (<nickname do jogador>)" usado pelas
// fontes de eSoccer (ex.: Bet365) para identificar os dois lados de uma
// partida. A identidade permanente é sempre o nickname; a equipe virtual é
// apenas o contexto daquela partida específica (ver docs/ESOCER_DOMAIN_V1.md).

import { normalizeESoccerNickname, normalizeVirtualTeamName } from "./normalization.ts";

export type ParsedESoccerParticipant = {
  raw: string;
  virtualTeam: string;
  playerNickname: string;
  normalizedVirtualTeam: string;
  normalizedPlayerNickname: string;
};

export class ESoccerParticipantParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ESoccerParticipantParseError";
  }
}

// Ancorada do início ao fim da string já aparada nas bordas: "<equipe> (<nickname>)".
// Espaços ao redor do nome da equipe, dos parênteses e do nickname são tolerados;
// qualquer texto após o parêntese de fechamento invalida o formato.
const PARTICIPANT_PATTERN = /^(.+?)\s*\(\s*(.+?)\s*\)$/;

/**
 * Interpreta uma string de participante de eSoccer no formato
 * "Bologna (Nightxx)" em { virtualTeam: "Bologna", playerNickname: "Nightxx" }.
 * Usa uma regex restritiva e ancorada — não aceita silenciosamente formato
 * quebrado. Rejeita em runtime valores que não sejam string (null, undefined,
 * número, objeto), mesmo que o tipo declarado da entrada seja `string`.
 */
export function parseESoccerParticipant(input: string): ParsedESoccerParticipant {
  if (typeof input !== "string") {
    throw new ESoccerParticipantParseError("Entrada de participante deve ser uma string.");
  }

  const raw = input;
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new ESoccerParticipantParseError("Entrada de participante não pode ser vazia.");
  }

  const openCount = (trimmed.match(/\(/g) ?? []).length;
  const closeCount = (trimmed.match(/\)/g) ?? []).length;
  if (openCount !== 1 || closeCount !== 1 || !trimmed.endsWith(")")) {
    throw new ESoccerParticipantParseError(`Formato inválido de participante: "${raw}".`);
  }

  const match = PARTICIPANT_PATTERN.exec(trimmed);
  if (!match) {
    throw new ESoccerParticipantParseError(`Formato inválido de participante: "${raw}".`);
  }

  const virtualTeam = match[1].trim();
  const playerNickname = match[2].trim();
  if (virtualTeam.length === 0 || playerNickname.length === 0) {
    throw new ESoccerParticipantParseError(`Formato inválido de participante: "${raw}".`);
  }

  return {
    raw,
    virtualTeam,
    playerNickname,
    normalizedVirtualTeam: normalizeVirtualTeamName(virtualTeam),
    normalizedPlayerNickname: normalizeESoccerNickname(playerNickname),
  };
}
