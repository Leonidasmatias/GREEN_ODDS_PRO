// Fase 2 — Data Ingestion Pipeline.
// Retry policy abstrata e determinística. Não realiza nenhuma chamada de
// rede nem depende de temporizadores reais: `delayForAttempt` apenas
// calcula o atraso (backoff exponencial) que uma implementação real
// aplicaria entre tentativas, mantendo a política 100% testável de forma
// síncrona. Nenhum adapter desta fase efetivamente aguarda esse atraso —
// ver BetsApiAdapter (nenhuma chamada HTTP real é feita).

export type RetryPolicyConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  backoffFactor: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicyConfig = {
  maxAttempts: 3,
  baseDelayMs: 200,
  backoffFactor: 2,
};

export function shouldRetry(attempt: number, config: RetryPolicyConfig = DEFAULT_RETRY_POLICY): boolean {
  return attempt < config.maxAttempts;
}

/** Atraso (ms) que seria aplicado antes da tentativa `attempt` (1-indexado), backoff exponencial a partir de baseDelayMs. */
export function delayForAttempt(attempt: number, config: RetryPolicyConfig = DEFAULT_RETRY_POLICY): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.round(config.baseDelayMs * Math.pow(config.backoffFactor, exponent));
}

/**
 * Executa `operation` reaplicando-a até `config.maxAttempts` vezes enquanto
 * ela rejeitar. Não introduz nenhum atraso real entre tentativas (ver nota
 * acima) — em uma implementação de produção com rede real, o chamador
 * aguardaria `delayForAttempt(attempt, config)` entre uma tentativa e outra.
 */
export async function runWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  config: RetryPolicyConfig = DEFAULT_RETRY_POLICY,
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < config.maxAttempts) {
    attempt += 1;
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!shouldRetry(attempt, config)) break;
    }
  }
  throw lastError;
}
