// Fase 2 — Data Ingestion Pipeline.
// Contratos que todo provedor de dados eSoccer deve implementar. Um
// provider nunca acessa os engines do Intelligence Engine (Fase 1.5)
// diretamente — ele apenas expõe payloads no seu próprio formato bruto
// (tipo genérico TRaw); a conversão para o modelo interno é feita pelo
// ProviderNormalizer, e o consumo pelos engines acontece somente depois
// da Pipeline (Normalizer -> Validator -> Deduplicator -> Persistence ->
// Aggregation -> Intelligence Engine).

import type { InternalOddsDTO, ProviderName } from "../types/dto.ts";

export interface Provider {
  readonly name: ProviderName;
}

/** Provedor de partidas. TRaw é o formato bruto e específico do provedor (nunca um DTO interno). */
export interface MatchProvider<TRaw = unknown> extends Provider {
  listMatches(): Promise<TRaw[]>;
  getMatch(externalId: string): Promise<TRaw | null>;
  listMatchesByPeriod(fromISO: string, toISO: string): Promise<TRaw[]>;
  listMatchesByPlayer(playerNickname: string): Promise<TRaw[]>;
  listMatchesByLeague(leagueName: string): Promise<TRaw[]>;
}

/** Provedor de odds. Não implementado por nenhum adapter concreto nesta fase — apenas o contrato. */
export interface OddsProvider extends Provider {
  getOdds(matchExternalId: string): Promise<InternalOddsDTO[]>;
}

/** Provedor de resultados finais de uma partida (placar definitivo). */
export interface ResultProvider<TRaw = unknown> extends Provider {
  getResult(matchExternalId: string): Promise<TRaw | null>;
}

export type ProviderHealthStatus = {
  provider: ProviderName;
  healthy: boolean;
  lastSyncAt: string | null;
  averageResponseTimeMs: number | null;
  lastError: string | null;
};

export interface HealthProvider extends Provider {
  checkHealth(): Promise<ProviderHealthStatus>;
}
