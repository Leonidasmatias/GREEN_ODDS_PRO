// Sprint 9.2.1 — Provider Go Live & Live Data Pipeline, Fase 3.
// LeagueSelectionService: escolhe automaticamente qual liga de futebol
// consultar, substituindo o antigo `soccer_fifa_world_cup` fixo no
// codigo. Testa candidatos em ordem de prioridade ate encontrar um com
// eventos futuros; se nenhum tiver, retorna o ultimo testado com
// `eventsFound: 0` (nunca lanca, nunca trava a sincronizacao). Generico
// sobre o tipo de evento (`T`) para que o chamador (`TheOddsApiProvider`)
// possa reaproveitar a resposta da sondagem vencedora como o proprio
// resultado de `getMatches()`, sem uma segunda chamada HTTP redundante.

import type { DiscoveredSport } from "./LiveSportsTypes.ts";

export type EventsProbeResult<T> = { data: T[]; remainingLimit?: number };
export type EventsSource<T> = { probeEvents(sportKey: string): Promise<EventsProbeResult<T>> };

/** Ligas de futebol de alto volume, testadas primeiro — nunca a unica
 * fonte de verdade (a lista real vem sempre de /v4/sports); apenas define
 * a ORDEM de tentativa para minimizar chamadas quando uma liga popular
 * ja tem eventos. */
const PRIORITY_SOCCER_LEAGUES = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
  "soccer_brazil_campeonato",
  "soccer_usa_mls",
  "soccer_fifa_world_cup",
];

/** Ultimo fallback quando a descoberta nao retorna nenhuma liga (ex.:
 * falha de rede) e nenhum override foi configurado. */
export const DEFAULT_SPORT_KEY = "soccer_fifa_world_cup";

/** Limite de sondagens por selecao — evita varrer centenas de ligas
 * (e consumir credito de API) caso a maioria esteja vazia. */
const MAX_LEAGUE_PROBE_ATTEMPTS = 15;

export type LeagueSelectionResult<T> = {
  sportKey: string;
  title: string | null;
  eventsFound: number;
  attemptedKeys: string[];
  response: EventsProbeResult<T>;
};

function titleFor(leagues: DiscoveredSport[], key: string): string | null {
  return leagues.find((league) => league.key === key)?.title ?? null;
}

export class LeagueSelectionService<T> {
  private readonly eventsSource: EventsSource<T>;

  constructor(eventsSource: EventsSource<T>) {
    this.eventsSource = eventsSource;
  }

  /**
   * Ordem de tentativa: (1) override explicito (`ODDS_SPORT_KEY`), se
   * presente entre as ligas descobertas; (2) ligas de prioridade
   * conhecida, na ordem acima, se descobertas e ativas; (3) as demais
   * ligas descobertas, na ordem retornada pela API; (4) o override
   * novamente, mesmo que a descoberta nao o tenha listado (permite um
   * operador forcar uma liga especifica mesmo se o discovery estiver
   * desatualizado).
   */
  buildCandidateOrder(leagues: DiscoveredSport[], override: string | null): string[] {
    const availableKeys = new Set(leagues.map((league) => league.key));
    const ordered: string[] = [];
    if (override && availableKeys.has(override)) ordered.push(override);
    for (const key of PRIORITY_SOCCER_LEAGUES) {
      if (availableKeys.has(key) && !ordered.includes(key)) ordered.push(key);
    }
    for (const league of leagues) {
      if (!ordered.includes(league.key)) ordered.push(league.key);
    }
    if (override && !ordered.includes(override)) ordered.push(override);
    return ordered;
  }

  async selectActiveLeague(leagues: DiscoveredSport[], override: string | null): Promise<LeagueSelectionResult<T>> {
    const candidates = this.buildCandidateOrder(leagues, override).slice(0, MAX_LEAGUE_PROBE_ATTEMPTS);
    const attemptedKeys: string[] = [];
    let lastKey = candidates[0] ?? override ?? DEFAULT_SPORT_KEY;
    let lastResponse: EventsProbeResult<T> = { data: [] };

    for (const key of candidates) {
      attemptedKeys.push(key);
      const response = await this.eventsSource.probeEvents(key);
      lastKey = key;
      lastResponse = response;
      if (response.data.length > 0) {
        return { sportKey: key, title: titleFor(leagues, key), eventsFound: response.data.length, attemptedKeys, response };
      }
    }

    return { sportKey: lastKey, title: titleFor(leagues, lastKey), eventsFound: 0, attemptedKeys, response: lastResponse };
  }
}
