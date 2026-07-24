// Fase 2 — Data Ingestion Pipeline.
// Adapter simulado para o formato de payload da BetsAPI. Restrição
// absoluta desta fase: NENHUMA chamada HTTP real é feita — todos os
// payloads são injetados pelo chamador via `options.payloads` (útil para
// testes e para uma futura ligação real, quando permitida). O que este
// módulo efetivamente implementa, conforme a missão:
//   mapeamento   -> ver ProviderNormalizer, que consome BetsApiRawMatch
//   tipagem      -> BetsApiRawMatch abaixo
//   parser       -> reaproveita parseESoccerParticipant da Fase 1 para o
//                   formato "Equipe (nickname)" usado nos nomes de casa/fora
//   tratamento de erros   -> ProviderError estruturado
//   health check simulado -> checkHealth()
//   retry policy          -> runWithRetry (src/providers/base/RetryPolicy.ts)
//   rate limiter abstrato -> AbstractRateLimiter (src/providers/base/RateLimiter.ts)

import { parseESoccerParticipant } from "../../lib/esoccer/participantParser.ts";
import { InMemoryMatchProviderBase } from "../base/InMemoryMatchProvider.ts";
import { AbstractRateLimiter, type RateLimiterConfig } from "../base/RateLimiter.ts";
import { ProviderError } from "../base/ProviderError.ts";
import { DEFAULT_RETRY_POLICY, runWithRetry, type RetryPolicyConfig } from "../base/RetryPolicy.ts";
import type { HealthProvider, MatchProvider, ProviderHealthStatus } from "../contracts/index.ts";
import type { ProviderName } from "../types/dto.ts";

/** time_status segue a convenção real da BetsAPI: 0=agendada, 1=ao vivo, 3=finalizada. */
export type BetsApiTimeStatus = "0" | "1" | "3";

export type BetsApiRawMatch = {
  id: string;
  league: { id: string; name: string };
  /** Timestamp Unix em segundos, como string — convenção da BetsAPI real. */
  time: string;
  time_status: BetsApiTimeStatus;
  home: { name: string };
  away: { name: string };
  /** Placar no formato "2-1", ou null quando a partida ainda não começou. */
  ss: string | null;
};

export function betsApiTimeToISO(unixSecondsAsString: string): string {
  const seconds = Number(unixSecondsAsString);
  if (!Number.isFinite(seconds)) {
    throw new ProviderError("BETSAPI", `Campo "time" inválido: "${unixSecondsAsString}".`);
  }
  return new Date(seconds * 1000).toISOString();
}

function extractNickname(rawName: string): string {
  try {
    return parseESoccerParticipant(rawName).playerNickname;
  } catch {
    return rawName;
  }
}

export type BetsApiAdapterOptions = {
  payloads: BetsApiRawMatch[];
  rateLimiterConfig?: RateLimiterConfig;
  retryPolicy?: RetryPolicyConfig;
  /** Apenas para testes: as `simulatedFailureCount` primeiras chamadas a listMatches() falham antes de suceder. */
  simulatedFailureCount?: number;
  /** Apenas para testes: simula o provedor inteiramente indisponível. */
  forceUnavailable?: boolean;
};

const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = { maxRequests: 30, windowMs: 60_000 };

export class BetsApiAdapter
  extends InMemoryMatchProviderBase<BetsApiRawMatch>
  implements MatchProvider<BetsApiRawMatch>, HealthProvider
{
  readonly name: ProviderName = "BETSAPI";
  private readonly rateLimiter: AbstractRateLimiter;
  private readonly retryPolicy: RetryPolicyConfig;
  private readonly simulatedFailureCount: number;
  private readonly forceUnavailable: boolean;
  private attemptCount = 0;
  private lastError: string | null = null;
  private lastSyncAt: string | null = null;

  constructor(options: BetsApiAdapterOptions) {
    super(options.payloads, {
      getExternalId: (record) => record.id,
      getScheduledAt: (record) => betsApiTimeToISO(record.time),
      getPlayerNicknames: (record) => [extractNickname(record.home.name), extractNickname(record.away.name)],
      getLeagueName: (record) => record.league.name,
    });
    this.rateLimiter = new AbstractRateLimiter(options.rateLimiterConfig ?? DEFAULT_RATE_LIMITER_CONFIG);
    this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
    this.simulatedFailureCount = options.simulatedFailureCount ?? 0;
    this.forceUnavailable = options.forceUnavailable ?? false;
  }

  /**
   * Simula uma busca ao provedor: nunca faz uma chamada HTTP real. Existe
   * apenas para dar ao retry policy e ao rate limiter algo realista para
   * envolver, exercitando o mesmo caminho que uma implementação real (com
   * rede) percorreria.
   */
  private async simulatedFetch(): Promise<BetsApiRawMatch[]> {
    if (this.forceUnavailable) {
      this.lastError = "Provedor BetsAPI indisponível (simulado).";
      throw new ProviderError("BETSAPI", this.lastError);
    }
    if (!this.rateLimiter.tryAcquire()) {
      this.lastError = "Limite de requisições excedido (simulado).";
      throw new ProviderError("BETSAPI", this.lastError);
    }
    this.attemptCount += 1;
    if (this.attemptCount <= this.simulatedFailureCount) {
      this.lastError = `Falha simulada na tentativa ${this.attemptCount}.`;
      throw new ProviderError("BETSAPI", this.lastError);
    }
    this.lastSyncAt = new Date().toISOString();
    return this.records;
  }

  async listMatches(): Promise<BetsApiRawMatch[]> {
    return runWithRetry(() => this.simulatedFetch(), this.retryPolicy);
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    return {
      provider: this.name,
      healthy: !this.forceUnavailable,
      lastSyncAt: this.lastSyncAt,
      averageResponseTimeMs: this.forceUnavailable ? null : 40,
      lastError: this.lastError,
    };
  }
}
