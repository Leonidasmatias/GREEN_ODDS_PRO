// Sprint 7.4 — Prediction Query Service.
// Contratos públicos de leitura, próprios deste serviço — nunca expõem
// `snapshotPayload`, enum Prisma ou qualquer tipo de infraestrutura.
// Reaproveita apenas as uniões estáveis já públicas do Repository
// (`PredictionSearchOrderBy`/`PredictionSearchOrderDirection`/
// `PredictionRecordSource`), nunca os detalhes internos de persistência.

// Import relativo (não `@/`) — mesma justificativa já documentada em
// `predictionCenterFormatters.ts`/`PredictionRepository.ts`.
import type { PredictionRecordSource, PredictionSearchOrderBy, PredictionSearchOrderDirection } from "../../repositories/prediction/PredictionRepository.ts";
import type { PredictionSnapshot } from "../prediction-evaluation/index.ts";

/** Resumo de UMA previsão persistida — apenas campos escalares,
 * nunca o `snapshot` completo (usado em listas/paginação). */
export type PredictionSummary = {
  id: string;
  snapshotHash: string;
  createdAt: string;
  matchId: string;
  homePlayerId: string;
  awayPlayerId: string;
  virtualTeamHome: string | null;
  virtualTeamAway: string | null;
  league: string | null;
  period: string | null;
  sequenceKey: string | number | null;
  modelVersion: string;
  configurationHash: string;
  schemaVersion: string;
  source: PredictionRecordSource;
  generatedAt: string;
  greenScoreCategory: string;
  combinedStatus: string;
};

/** `PredictionSummary` mais o `PredictionSnapshot` completo — usado por
 * `getById`/`getLatestByMatch`, nunca em listas paginadas. */
export type PredictionDetail = PredictionSummary & {
  snapshot: PredictionSnapshot;
};

export type PredictionQueryInput = {
  matchId?: string;
  playerId?: string;
  league?: string;
  period?: string;
  limit?: number;
  offset?: number;
  orderBy?: PredictionSearchOrderBy;
  orderDirection?: PredictionSearchOrderDirection;
};

export type PredictionQueryPage = {
  items: PredictionSummary[];
  total: number;
  limit: number;
  offset: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PredictionQueryHealth = {
  status: "available" | "unavailable";
  backend: "memory" | "prisma";
  detail: string | null;
};
