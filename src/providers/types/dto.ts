// Fase 2 — Data Ingestion Pipeline.
// DTOs internos e únicos usados por toda a camada de ingestão. Nenhum tipo
// aqui depende do formato de nenhum provedor específico (BetsAPI, CSV,
// etc.) — a conversão de um payload externo para estes DTOs é
// responsabilidade exclusiva do ProviderNormalizer
// (src/providers/pipeline/ProviderNormalizer.ts). Nenhum tipo aqui importa
// nada do Prisma Client nem dos módulos do Intelligence Engine.

/** Provedores suportados nesta fase, selecionáveis via ProviderConfig. */
export type ProviderName = "FIXTURE" | "BETSAPI" | "CSV" | "MANUAL";

export type InternalMatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED"
  | "CANCELLED"
  | "POSTPONED"
  | "UNKNOWN";

export type InternalLeagueDTO = {
  externalId: string | null;
  name: string;
  normalizedName: string;
  provider: ProviderName;
};

export type InternalPlayerDTO = {
  nickname: string;
  normalizedNickname: string;
};

export type InternalVirtualTeamDTO = {
  name: string;
  normalizedName: string;
};

export type InternalMatchSideDTO = {
  virtualTeam: InternalVirtualTeamDTO;
  player: InternalPlayerDTO;
};

/**
 * Representação interna e única de uma partida, independente do provedor
 * de origem. Corresponde ao passo "InternalMatchDTO" do fluxo:
 *   payload do provedor -> ProviderNormalizer -> InternalMatchDTO -> Pipeline -> ESoccerMatch
 */
export type InternalMatchDTO = {
  externalId: string | null;
  provider: ProviderName;
  league: InternalLeagueDTO;
  scheduledAt: string; // ISO 8601
  status: InternalMatchStatus;
  home: InternalMatchSideDTO;
  away: InternalMatchSideDTO;
  homeScore: number | null;
  awayScore: number | null;
  rawHomeName: string;
  rawAwayName: string;
  /** Serializado como string para espelhar a convenção `sourcePayload String?` do schema Prisma da Fase 1. */
  sourcePayload: string;
};

export type InternalOddsDTO = {
  matchExternalId: string | null;
  provider: ProviderName;
  market: string;
  selection: string;
  odd: number;
  capturedAt: string;
};

export type InternalPredictionDTO = {
  matchExternalId: string | null;
  modelVersion: string;
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
  confidenceScore: number;
};

export type InternalRecommendationStatus = "APPROVED" | "OBSERVATION" | "NO_BET";

export type InternalRecommendationDTO = {
  matchExternalId: string | null;
  market: string;
  selection: string | null;
  status: InternalRecommendationStatus;
  confidenceScore: number;
  reason: string;
};
