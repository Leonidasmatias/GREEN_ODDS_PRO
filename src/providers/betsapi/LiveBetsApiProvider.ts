// Fase 3 - BetsAPI Real Integration.
// LiveBetsApiProvider: implementa os contratos MatchProvider/HealthProvider
// da Fase 2 (inalterados) usando dados reais buscados via BetsApiClient.
// Fluxo: BetsApiClient -> (BetsApiPayloads.betsApiEventToRawMatch) ->
// BetsApiRawMatch (mesmo shape ja consumido pelo ProviderNormalizer da
// Fase 2, tambem inalterado) -> InternalMatchDTO.
//
// Nunca acessa o Prisma nem o Intelligence Engine diretamente - apenas
// devolve o payload bruto (no shape ja suportado pelo Normalizer); o
// consumo pelos engines so acontece depois da Pipeline (fora deste
// arquivo), exatamente como o FixtureProvider e o BetsApiAdapter
// simulado da Fase 2.

import type { HealthProvider, MatchProvider, ProviderHealthStatus } from "../contracts/index.ts";
import type { ProviderName } from "../types/dto.ts";
import type { BetsApiRawMatch } from "./BetsApiAdapter.ts";
import { BetsApiClient } from "./BetsApiClient.ts";
import { betsApiEventToRawMatch, type BetsApiRawEvent } from "./BetsApiPayloads.ts";
import { parseESoccerParticipant } from "../../lib/esoccer/participantParser.ts";
import { BetsApiError } from "./BetsApiErrors.ts";

export type LiveBetsApiProviderOptions = {
  sportId: string;
  day?: string;
};

function extractNickname(rawName: string): string {
  try {
    return parseESoccerParticipant(rawName).playerNickname;
  } catch {
    return rawName;
  }
}

export class LiveBetsApiProvider implements MatchProvider<BetsApiRawMatch>, HealthProvider {
  readonly name: ProviderName = "BETSAPI";
  private readonly client: BetsApiClient;
  private readonly options: LiveBetsApiProviderOptions;

  constructor(client: BetsApiClient, options: LiveBetsApiProviderOptions) {
    this.client = client;
    this.options = options;
  }

  private async fetchRawEvents(): Promise<BetsApiRawEvent[]> {
    const payload = await this.client.getUpcomingEvents({ sport_id: this.options.sportId, day: this.options.day });
    return payload.results;
  }

  async listMatches(): Promise<BetsApiRawMatch[]> {
    const events = await this.fetchRawEvents();
    return events.map(betsApiEventToRawMatch);
  }

  async getMatch(externalId: string): Promise<BetsApiRawMatch | null> {
    const payload = await this.client.getEventView([externalId]);
    const found = payload.results[0];
    return found ? betsApiEventToRawMatch(found) : null;
  }

  async listMatchesByPeriod(fromISO: string, toISO: string): Promise<BetsApiRawMatch[]> {
    const matches = await this.listMatches();
    const from = new Date(fromISO).getTime();
    const to = new Date(toISO).getTime();
    return matches.filter((match) => {
      const scheduledAt = Number(match.time) * 1000;
      return scheduledAt >= from && scheduledAt <= to;
    });
  }

  async listMatchesByPlayer(playerNickname: string): Promise<BetsApiRawMatch[]> {
    const matches = await this.listMatches();
    const target = playerNickname.trim().toLowerCase();
    return matches.filter((match) => {
      const home = extractNickname(match.home.name).trim().toLowerCase();
      const away = extractNickname(match.away.name).trim().toLowerCase();
      return home === target || away === target;
    });
  }

  async listMatchesByLeague(leagueName: string): Promise<BetsApiRawMatch[]> {
    const matches = await this.listMatches();
    const target = leagueName.trim().toLowerCase();
    return matches.filter((match) => match.league.name.trim().toLowerCase() === target);
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    const startedAt = Date.now();
    try {
      await this.client.getUpcomingEvents({ sport_id: this.options.sportId, page: 1 });
      return {
        provider: this.name,
        healthy: true,
        lastSyncAt: new Date().toISOString(),
        averageResponseTimeMs: Date.now() - startedAt,
        lastError: null,
      };
    } catch (error) {
      return {
        provider: this.name,
        healthy: false,
        lastSyncAt: null,
        averageResponseTimeMs: null,
        lastError: error instanceof BetsApiError ? error.safeMessage : "Falha desconhecida ao consultar a BetsAPI.",
      };
    }
  }
}
