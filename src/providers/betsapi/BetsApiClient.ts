// Fase 3 - BetsAPI Real Integration.
// Cliente HTTP para a BetsAPI real, usando apenas `fetch`/`AbortController`
// nativos do runtime Node (nenhuma dependencia nova instalada). Toda a
// logica estatistica fica fora deste arquivo - o cliente so constroi
// requisicoes, aplica timeout/retry/fallback/rate-limit e devolve o
// payload ja validado pelo envelope da BetsAPI. O token so e inserido na
// URL no momento do envio (query param `token`, conforme a API real) e
// nunca aparece em nenhum log, metrica ou erro.

import { DEFAULT_RETRY_POLICY, delayForAttempt } from "../base/RetryPolicy.ts";
import type { BetsApiConfig } from "./BetsApiConfig.ts";
import {
  BetsApiError,
  BetsApiNetworkError,
  BetsApiRateLimitError,
  BetsApiTimeoutError,
  BetsApiUnavailableError,
  BetsApiValidationError,
  RETRYABLE_HTTP_STATUSES,
} from "./BetsApiErrors.ts";
import { redactUrl } from "./BetsApiRedaction.ts";
import { parseBetsApiEnvelope, parseRateLimitHeaders, type BetsApiRateLimitState } from "./BetsApiResponse.ts";
import type {
  BetsApiEventViewPayload,
  BetsApiLeague,
  BetsApiLeagueCatalogParams,
  BetsApiLeagueCatalogPayload,
  BetsApiOddsSummaryPayload,
  BetsApiTeam,
  BetsApiTeamCatalogParams,
  BetsApiTeamCatalogPayload,
  BetsApiUpcomingEventsParams,
  BetsApiUpcomingEventsPayload,
} from "./BetsApiPayloads.ts";

export type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export type BetsApiClientOptions = {
  fetchImpl?: FetchLike;
  now?: () => Date;
  jitter?: (attempt: number) => number;
  sleep?: (ms: number) => Promise<void>;
};

export type BetsApiHostMetrics = {
  host: string;
  lastLatencyMs: number | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
};

const DEFAULT_JITTER = (attempt: number): number => (attempt * 37) % 100;
const DEFAULT_SLEEP = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Cliente HTTP real para a BetsAPI. Requer mode "sandbox" ou "live" - nunca deve ser construido em modo "fixture". */
export class BetsApiClient {
  private readonly config: BetsApiConfig;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private readonly jitter: (attempt: number) => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private rateLimitState: BetsApiRateLimitState | null = null;
  private readonly hostMetrics = new Map<string, BetsApiHostMetrics>();

  constructor(config: BetsApiConfig, options: BetsApiClientOptions = {}) {
    if (config.mode === "fixture") {
      throw new BetsApiValidationError('BetsApiClient nao pode ser construido em mode "fixture" - use FixtureProvider.');
    }
    if (!config.token) {
      throw new BetsApiValidationError(`BetsApiClient requer BETSAPI_TOKEN configurado em mode "${config.mode}".`);
    }
    this.config = config;
    this.fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
    this.now = options.now ?? (() => new Date());
    this.jitter = options.jitter ?? DEFAULT_JITTER;
    this.sleep = options.sleep ?? DEFAULT_SLEEP;
  }

  getRateLimitState(): BetsApiRateLimitState | null {
    return this.rateLimitState;
  }

  getHostMetrics(host: string): BetsApiHostMetrics | null {
    return this.hostMetrics.get(host) ?? null;
  }

  private recordSuccess(host: string, latencyMs: number): void {
    this.hostMetrics.set(host, {
      host,
      lastLatencyMs: latencyMs,
      lastSuccessAt: this.now().toISOString(),
      lastFailureAt: this.hostMetrics.get(host)?.lastFailureAt ?? null,
      lastError: null,
    });
  }

  private recordFailure(host: string, error: unknown): void {
    const safeMessage = error instanceof BetsApiError ? error.safeMessage : redactUrl(String(error), this.config.token);
    this.hostMetrics.set(host, {
      host,
      lastLatencyMs: this.hostMetrics.get(host)?.lastLatencyMs ?? null,
      lastSuccessAt: this.hostMetrics.get(host)?.lastSuccessAt ?? null,
      lastFailureAt: this.now().toISOString(),
      lastError: safeMessage,
    });
  }

  private assertRateLimitAllows(endpoint: string): void {
    if (this.rateLimitState && this.rateLimitState.reserveReached) {
      throw new BetsApiRateLimitError(
        `Reserva de rate limit atingida (remaining=${this.rateLimitState.remaining}); nova chamada bloqueada antes do envio.`,
        { endpoint },
      );
    }
  }

  private buildUrl(host: string, path: string, query: Record<string, string>): string {
    const url = new URL(path, host);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("token", this.config.token as string);
    return url.toString();
  }

  private async performRequest(
    host: string,
    path: string,
    query: Record<string, string>,
    endpoint: string,
  ): Promise<{ status: number; headers: { get(name: string): string | null }; bodyText: string }> {
    const url = this.buildUrl(host, path, query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal });
      const bodyText = await response.text();
      return { status: response.status, headers: response.headers, bodyText };
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") {
        throw new BetsApiTimeoutError(`Tempo limite (${this.config.timeoutMs}ms) excedido ao chamar ${endpoint}.`, {
          endpoint,
          secret: this.config.token,
          cause: error,
        });
      }
      throw new BetsApiNetworkError(`Falha de rede ao chamar ${endpoint}.`, {
        endpoint,
        secret: this.config.token,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private isFallbackEligible(error: unknown): boolean {
    if (!(error instanceof BetsApiError)) return false;
    return error.code === "NETWORK_ERROR" || error.code === "TIMEOUT" || error.code === "UNDER_MAINTENANCE";
  }

  private statusToError(status: number, endpoint: string): BetsApiError {
    if (status === 429) {
      return new BetsApiRateLimitError(`A BetsAPI respondeu HTTP 429 (rate limit) em ${endpoint}.`, { status, endpoint });
    }
    return new BetsApiUnavailableError(`A BetsAPI respondeu HTTP ${status} em ${endpoint}.`, { status, endpoint });
  }

  /** Executa uma requisicao GET contra a BetsAPI com retry, fallback de host e parse seguro do envelope. */
  private async requestJson<T>(path: string, query: Record<string, string>, endpoint: string): Promise<T> {
    this.assertRateLimitAllows(endpoint);

    const hosts = [this.config.baseUrl, this.config.fallbackBaseUrl];
    let lastError: unknown = new BetsApiNetworkError(`Nenhuma tentativa realizada para ${endpoint}.`, { endpoint });

    for (let hostIndex = 0; hostIndex < hosts.length; hostIndex += 1) {
      const host = hosts[hostIndex];
      const isPrimary = hostIndex === 0;
      let attempt = 0;

      while (attempt < this.config.maxRetries) {
        attempt += 1;
        const startedAt = this.now().getTime();
        try {
          const { status, headers, bodyText } = await this.performRequest(host, path, query, endpoint);
          const latencyMs = this.now().getTime() - startedAt;
          this.rateLimitState = parseRateLimitHeaders(headers, this.config.rateLimitReserve, this.now);

          if (RETRYABLE_HTTP_STATUSES.has(status)) {
            lastError = this.statusToError(status, endpoint);
            this.recordFailure(host, lastError);
            if (attempt < this.config.maxRetries) {
              await this.sleep(delayForAttempt(attempt, { ...DEFAULT_RETRY_POLICY, baseDelayMs: this.config.retryBaseDelayMs }) + this.jitter(attempt));
              continue;
            }
            break;
          }

          const data = parseBetsApiEnvelope<T>(bodyText, endpoint, this.config.token);
          this.recordSuccess(host, latencyMs);
          return data;
        } catch (error) {
          lastError = error;
          this.recordFailure(host, error);
          const retryable = error instanceof BetsApiError ? error.retryable : false;
          if (!retryable) throw error;
          if (attempt < this.config.maxRetries) {
            await this.sleep(delayForAttempt(attempt, { ...DEFAULT_RETRY_POLICY, baseDelayMs: this.config.retryBaseDelayMs }) + this.jitter(attempt));
            continue;
          }
          break;
        }
      }

      if (isPrimary && hosts.length > 1 && this.isFallbackEligible(lastError)) {
        continue;
      }
      break;
    }

    throw lastError;
  }

  async getUpcomingEvents(params: BetsApiUpcomingEventsParams): Promise<BetsApiUpcomingEventsPayload> {
    const query: Record<string, string> = { sport_id: params.sport_id };
    if (params.league_id) query.league_id = params.league_id;
    if (params.team_id) query.team_id = params.team_id;
    if (params.day) query.day = params.day;
    if (params.page) query.page = String(params.page);
    if (params.skip_esports !== undefined) query.skip_esports = params.skip_esports ? "1" : "0";
    return this.requestJson<BetsApiUpcomingEventsPayload>("/v3/events/upcoming", query, "/v3/events/upcoming");
  }

  async getEventView(eventIds: string[]): Promise<BetsApiEventViewPayload> {
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      throw new BetsApiValidationError("getEventView requer ao menos 1 event_id.");
    }
    if (eventIds.length > 10) {
      throw new BetsApiValidationError("getEventView aceita no maximo 10 event_ids por requisicao.");
    }
    if (eventIds.some((id) => typeof id !== "string" || id.trim().length === 0)) {
      throw new BetsApiValidationError("event_id invalido (vazio ou nao-string) em getEventView.");
    }
    return this.requestJson<BetsApiEventViewPayload>("/v1/event/view", { event_id: eventIds.join(",") }, "/v1/event/view");
  }

  async getLeagues(params: BetsApiLeagueCatalogParams): Promise<BetsApiLeagueCatalogPayload> {
    const query: Record<string, string> = { sport_id: params.sport_id };
    if (params.cc) query.cc = params.cc;
    if (params.max_id) query.max_id = params.max_id;
    return this.requestJson<BetsApiLeagueCatalogPayload>("/v3/league", query, "/v3/league");
  }

  /** Percorre o catalogo de ligas via max_id decrescente, com protecao contra loop infinito (sem progresso -> para). */
  async iterateLeagues(params: BetsApiLeagueCatalogParams, maxPages = 20): Promise<BetsApiLeague[]> {
    const collected: BetsApiLeague[] = [];
    let maxId = params.max_id;
    for (let page = 0; page < maxPages; page += 1) {
      const payload = await this.getLeagues({ ...params, max_id: maxId });
      if (payload.results.length === 0) break;
      collected.push(...payload.results);
      const lastId = payload.results[payload.results.length - 1].id;
      const lastIdNum = Number(lastId);
      const nextMaxId = Number.isFinite(lastIdNum) ? String(lastIdNum - 1) : lastId;
      if (nextMaxId === maxId) break;
      maxId = nextMaxId;
    }
    return collected;
  }

  async getTeams(params: BetsApiTeamCatalogParams): Promise<BetsApiTeamCatalogPayload> {
    const query: Record<string, string> = { sport_id: params.sport_id };
    if (params.cc) query.cc = params.cc;
    if (params.max_id) query.max_id = params.max_id;
    return this.requestJson<BetsApiTeamCatalogPayload>("/v3/team", query, "/v3/team");
  }

  /** Percorre o catalogo de times via max_id decrescente, com protecao contra loop infinito. */
  async iterateTeams(params: BetsApiTeamCatalogParams, maxPages = 20): Promise<BetsApiTeam[]> {
    const collected: BetsApiTeam[] = [];
    let maxId = params.max_id;
    for (let page = 0; page < maxPages; page += 1) {
      const payload = await this.getTeams({ ...params, max_id: maxId });
      if (payload.results.length === 0) break;
      collected.push(...payload.results);
      const lastId = payload.results[payload.results.length - 1].id;
      const lastIdNum = Number(lastId);
      const nextMaxId = Number.isFinite(lastIdNum) ? String(lastIdNum - 1) : lastId;
      if (nextMaxId === maxId) break;
      maxId = nextMaxId;
    }
    return collected;
  }

  async getEventOddsSummary(eventId: string): Promise<BetsApiOddsSummaryPayload> {
    if (!eventId || eventId.trim().length === 0) {
      throw new BetsApiValidationError("getEventOddsSummary requer um event_id valido.");
    }
    return this.requestJson<BetsApiOddsSummaryPayload>("/v2/event/odds/summary", { event_id: eventId }, "/v2/event/odds/summary");
  }
}
