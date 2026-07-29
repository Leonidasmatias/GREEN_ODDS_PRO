// Sprint 9.2.1 — Provider Go Live & Live Data Pipeline, Fase 2.
// LiveSportsDiscoveryService: descobre, a partir de GET /v4/sports, quais
// esportes existem, quais estao ativos, e filtra os de futebol (grupo
// "Soccer"). Nao faz nenhuma chamada HTTP diretamente — recebe uma
// `SportsSource` (satisfeita por `TheOddsApiProvider.getSports()`) para
// permanecer testavel sem rede/API key real. Nenhum cache aqui: o cache
// (configuravel via ODDS_SPORTS_CACHE_TTL_MS) ja acontece dentro da
// requisicao HTTP subjacente (`providerEconomyService`), reaproveitado
// sem duplicacao.

import type { ProviderResponse } from "../types.ts";
import type { DiscoveredSport, OddsApiSportEntry } from "./LiveSportsTypes.ts";

export type SportsSource = { getSports(): Promise<ProviderResponse<OddsApiSportEntry[]>> };

const SOCCER_GROUP = "Soccer";

function toDiscoveredSport(entry: OddsApiSportEntry): DiscoveredSport {
  return {
    key: entry.key,
    group: entry.group,
    title: entry.title,
    active: entry.active,
    hasOutrights: Boolean(entry.has_outrights),
  };
}

export class LiveSportsDiscoveryService {
  private readonly source: SportsSource;

  constructor(source: SportsSource) {
    this.source = source;
  }

  /** Todos os esportes retornados por /v4/sports, sem filtro. */
  async discoverSports(): Promise<DiscoveredSport[]> {
    const response = await this.source.getSports();
    return response.data.map(toDiscoveredSport);
  }

  /** Apenas esportes marcados `active: true` pela The Odds API. */
  async discoverActiveSports(): Promise<DiscoveredSport[]> {
    return (await this.discoverSports()).filter((sport) => sport.active);
  }

  /** Ligas de futebol (grupo "Soccer") atualmente ativas. */
  async discoverSoccerLeagues(): Promise<DiscoveredSport[]> {
    return (await this.discoverActiveSports()).filter((sport) => sport.group === SOCCER_GROUP);
  }
}
