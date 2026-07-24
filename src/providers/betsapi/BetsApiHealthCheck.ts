// Fase 3 - BetsAPI Real Integration.
// BetsApiHealthCheck: evolui a observabilidade da integracao real SEM
// alterar o ProviderHealthService da Fase 2 - implementa o mesmo contrato
// HealthProvider (inalterado) para que possa ser registrado dentro de um
// ProviderHealthService existente por composicao, e adiciona um metodo
// mais rico (checkDetailed) com os campos exigidos pela missao. Realiza,
// no maximo, UMA chamada real minima e controlada (nunca varios
// endpoints) para apurar o status.

import type { HealthProvider, ProviderHealthStatus } from "../contracts/index.ts";
import type { ProviderName } from "../types/dto.ts";
import type { BetsApiConfig } from "./BetsApiConfig.ts";
import { BetsApiClient } from "./BetsApiClient.ts";
import { BetsApiAuthenticationError, BetsApiError, BetsApiPermissionError } from "./BetsApiErrors.ts";

export type BetsApiHealthStatus = {
  configured: boolean;
  enabled: boolean;
  mode: BetsApiConfig["mode"];
  reachable: boolean;
  authenticated: boolean;
  permissionGranted: boolean;
  latencyMs: number | null;
  primaryHostHealthy: boolean;
  fallbackHostHealthy: boolean | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  rateLimitRemaining: number | null;
  safeError: string | null;
};

export class BetsApiHealthCheck implements HealthProvider {
  readonly name: ProviderName = "BETSAPI";
  private readonly config: BetsApiConfig;
  private readonly client: BetsApiClient | null;
  private lastSuccessAt: string | null = null;
  private lastFailureAt: string | null = null;

  constructor(config: BetsApiConfig, client: BetsApiClient | null = null) {
    this.config = config;
    // Em modo fixture nunca construimos (nem aceitamos) um cliente real.
    this.client = config.mode === "fixture" ? null : client;
  }

  /** Status detalhado, especifico da BetsAPI. Faz no maximo UMA chamada real (getUpcomingEvents, pagina 1). */
  async checkDetailed(): Promise<BetsApiHealthStatus> {
    const configured = Boolean(this.config.token) && Boolean(this.config.baseUrl);

    if (this.config.mode === "fixture" || !this.client) {
      return {
        configured,
        enabled: this.config.enabled,
        mode: this.config.mode,
        reachable: false,
        authenticated: false,
        permissionGranted: false,
        latencyMs: null,
        primaryHostHealthy: false,
        fallbackHostHealthy: null,
        lastSuccessAt: this.lastSuccessAt,
        lastFailureAt: this.lastFailureAt,
        rateLimitRemaining: null,
        safeError: "BetsAPI em modo fixture: nenhuma chamada real e feita para health check.",
      };
    }

    const startedAt = Date.now();
    try {
      await this.client.getUpcomingEvents({ sport_id: this.config.sportId, page: 1 });
      const latencyMs = Date.now() - startedAt;
      this.lastSuccessAt = new Date().toISOString();
      const primaryMetrics = this.client.getHostMetrics(this.config.baseUrl);
      const fallbackMetrics = this.client.getHostMetrics(this.config.fallbackBaseUrl);
      return {
        configured,
        enabled: this.config.enabled,
        mode: this.config.mode,
        reachable: true,
        authenticated: true,
        permissionGranted: true,
        latencyMs,
        primaryHostHealthy: primaryMetrics ? primaryMetrics.lastError === null : true,
        fallbackHostHealthy: fallbackMetrics ? fallbackMetrics.lastError === null : null,
        lastSuccessAt: this.lastSuccessAt,
        lastFailureAt: this.lastFailureAt,
        rateLimitRemaining: this.client.getRateLimitState()?.remaining ?? null,
        safeError: null,
      };
    } catch (error) {
      this.lastFailureAt = new Date().toISOString();
      const safeError = error instanceof BetsApiError ? error.safeMessage : "Falha desconhecida ao consultar a BetsAPI.";
      const authenticated = !(error instanceof BetsApiAuthenticationError);
      const permissionGranted = !(error instanceof BetsApiPermissionError);
      const primaryMetrics = this.client.getHostMetrics(this.config.baseUrl);
      const fallbackMetrics = this.client.getHostMetrics(this.config.fallbackBaseUrl);
      return {
        configured,
        enabled: this.config.enabled,
        mode: this.config.mode,
        reachable: false,
        authenticated,
        permissionGranted,
        latencyMs: null,
        primaryHostHealthy: primaryMetrics ? primaryMetrics.lastError === null : false,
        fallbackHostHealthy: fallbackMetrics ? fallbackMetrics.lastError === null : null,
        lastSuccessAt: this.lastSuccessAt,
        lastFailureAt: this.lastFailureAt,
        rateLimitRemaining: this.client.getRateLimitState()?.remaining ?? null,
        safeError,
      };
    }
  }

  /** Satisfaz o contrato HealthProvider (Fase 2, inalterado) para composicao dentro de um ProviderHealthService existente. */
  async checkHealth(): Promise<ProviderHealthStatus> {
    const detailed = await this.checkDetailed();
    return {
      provider: this.name,
      healthy: detailed.reachable && detailed.authenticated && detailed.permissionGranted,
      lastSyncAt: detailed.lastSuccessAt,
      averageResponseTimeMs: detailed.latencyMs,
      lastError: detailed.safeError,
    };
  }
}
