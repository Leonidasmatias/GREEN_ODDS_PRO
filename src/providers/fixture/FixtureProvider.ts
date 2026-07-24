// Fase 2 — Data Ingestion Pipeline.
// Provider simulado: fornece as 300 partidas eSoccer simuladas (mesmas
// da Fase 1.5) através do contrato MatchProvider/ResultProvider/
// HealthProvider. Nenhuma chamada de rede — os dados estão inteiramente
// em memória (ver esoccerFixtureCatalog.ts).

import { InMemoryMatchProviderBase } from "../base/InMemoryMatchProvider.ts";
import type { HealthProvider, MatchProvider, ProviderHealthStatus, ResultProvider } from "../contracts/index.ts";
import type { ProviderName } from "../types/dto.ts";
import { esoccerFixtureCatalog, type RawFixtureMatch } from "./esoccerFixtureCatalog.ts";

export class FixtureProvider
  extends InMemoryMatchProviderBase<RawFixtureMatch>
  implements MatchProvider<RawFixtureMatch>, ResultProvider<RawFixtureMatch>, HealthProvider
{
  readonly name: ProviderName = "FIXTURE";
  private lastCheckedAt: string | null = null;

  constructor(records: RawFixtureMatch[] = esoccerFixtureCatalog) {
    super(records, {
      getExternalId: (record) => record.id,
      getScheduledAt: (record) => record.scheduledAt,
      getPlayerNicknames: (record) => [record.homePlayerId, record.awayPlayerId],
      getLeagueName: (record) => record.league,
    });
  }

  /** Partidas simuladas já nascem finalizadas com placar completo — o resultado é a própria partida. */
  async getResult(externalId: string): Promise<RawFixtureMatch | null> {
    return this.getMatch(externalId);
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    this.lastCheckedAt = new Date().toISOString();
    return {
      provider: this.name,
      healthy: true,
      lastSyncAt: this.lastCheckedAt,
      averageResponseTimeMs: 5,
      lastError: null,
    };
  }
}
