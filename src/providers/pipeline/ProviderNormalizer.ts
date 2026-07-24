// Fase 2 — Data Ingestion Pipeline.
// ProviderNormalizer: converte qualquer payload bruto de provider
// (RawFixtureMatch, BetsApiRawMatch, ou uma linha de CSV já parseada) no
// modelo interno único (InternalMatchDTO). Fluxo:
//   payload do provider -> ProviderNormalizer -> InternalMatchDTO -> Pipeline -> ESoccerMatch
// Reaproveita o parser e a normalização de participantes da Fase 1
// (src/lib/esoccer/participantParser.ts, normalization.ts) para os nomes
// no formato "<equipe virtual> (<nickname>)".

import { parseESoccerParticipant } from "../../lib/esoccer/participantParser.ts";
import { normalizeVirtualTeamName } from "../../lib/esoccer/normalization.ts";
import { betsApiTimeToISO, type BetsApiRawMatch } from "../betsapi/BetsApiAdapter.ts";
import type { RawFixtureMatch } from "../fixture/esoccerFixtureCatalog.ts";
import type { InternalMatchDTO, InternalMatchStatus, ProviderName } from "../types/dto.ts";

export class ProviderNormalizerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderNormalizerError";
  }
}

/** Payload cru já no shape usado pela ManualProvider/CsvProvider: mesmo shape de RawFixtureMatch, com provider próprio. */
export type CsvOrManualRawMatch = Omit<RawFixtureMatch, "provider"> & { provider: "CSV" | "MANUAL" };

export type NormalizerInput =
  | { provider: "FIXTURE"; raw: RawFixtureMatch }
  | { provider: "BETSAPI"; raw: BetsApiRawMatch }
  | { provider: "CSV" | "MANUAL"; raw: CsvOrManualRawMatch };

function parseSide(rawName: string, sideLabel: string) {
  try {
    const parsed = parseESoccerParticipant(rawName);
    return {
      virtualTeam: { name: parsed.virtualTeam, normalizedName: parsed.normalizedVirtualTeam },
      player: { nickname: parsed.playerNickname, normalizedNickname: parsed.normalizedPlayerNickname },
    };
  } catch (error) {
    throw new ProviderNormalizerError(
      `Não foi possível interpretar o participante ${sideLabel} ("${rawName}"): ${(error as Error).message}`,
    );
  }
}

// Reaproveita normalizeVirtualTeamName (Fase 1) para o nome da liga: a
// regra de normalização (NFKC/trim/lowercase/colapso de espaços) é
// idêntica à usada para equipes virtuais, apenas aplicada a outro domínio
// de texto — não há necessidade de uma segunda função com a mesma lógica.
function betsApiStatus(timeStatus: BetsApiRawMatch["time_status"]): InternalMatchStatus {
  if (timeStatus === "0") return "SCHEDULED";
  if (timeStatus === "1") return "LIVE";
  if (timeStatus === "3") return "FINISHED";
  return "UNKNOWN";
}

function parseBetsApiScore(ss: string | null): { homeScore: number | null; awayScore: number | null } {
  if (ss === null || ss.trim().length === 0) {
    return { homeScore: null, awayScore: null };
  }
  const parts = ss.split("-");
  if (parts.length !== 2) {
    throw new ProviderNormalizerError(`Placar BetsAPI em formato inesperado: "${ss}".`);
  }
  const homeScore = Number(parts[0]);
  const awayScore = Number(parts[1]);
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    throw new ProviderNormalizerError(`Placar BetsAPI em formato inesperado: "${ss}".`);
  }
  return { homeScore, awayScore };
}

function fromFixtureLike(provider: ProviderName, raw: RawFixtureMatch | CsvOrManualRawMatch): InternalMatchDTO {
  const home = parseSide(raw.rawHomeName, "da casa");
  const away = parseSide(raw.rawAwayName, "visitante");
  return {
    externalId: raw.id,
    provider,
    league: {
      externalId: null,
      name: raw.league,
      normalizedName: normalizeVirtualTeamName(raw.league),
      provider,
    },
    scheduledAt: raw.scheduledAt,
    status: raw.status,
    home,
    away,
    homeScore: raw.homeScore,
    awayScore: raw.awayScore,
    rawHomeName: raw.rawHomeName,
    rawAwayName: raw.rawAwayName,
    sourcePayload: JSON.stringify(raw),
  };
}

function fromBetsApi(raw: BetsApiRawMatch): InternalMatchDTO {
  const home = parseSide(raw.home.name, "da casa");
  const away = parseSide(raw.away.name, "visitante");
  const { homeScore, awayScore } = parseBetsApiScore(raw.ss);
  return {
    externalId: raw.id,
    provider: "BETSAPI",
    league: {
      externalId: raw.league.id,
      name: raw.league.name,
      normalizedName: normalizeVirtualTeamName(raw.league.name),
      provider: "BETSAPI",
    },
    scheduledAt: betsApiTimeToISO(raw.time),
    status: betsApiStatus(raw.time_status),
    home,
    away,
    homeScore,
    awayScore,
    rawHomeName: raw.home.name,
    rawAwayName: raw.away.name,
    sourcePayload: JSON.stringify(raw),
  };
}

/** Converte o payload bruto de qualquer provider suportado nesta fase para o InternalMatchDTO único. */
export function normalizeProviderMatch(input: NormalizerInput): InternalMatchDTO {
  switch (input.provider) {
    case "FIXTURE":
      return fromFixtureLike("FIXTURE", input.raw);
    case "CSV":
    case "MANUAL":
      return fromFixtureLike(input.provider, input.raw);
    case "BETSAPI":
      return fromBetsApi(input.raw);
    default: {
      const exhaustiveCheck: never = input;
      throw new ProviderNormalizerError(`Provider desconhecido: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
