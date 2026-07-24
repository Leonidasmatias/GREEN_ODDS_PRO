// Fase 3 - BetsAPI Real Integration.
// Parse seguro do envelope de resposta da BetsAPI (campo `success` +
// codigos de erro conhecidos) e leitura dos headers de rate limit.
// Nao codifica um limite fixo como verdade absoluta - os headers
// retornados pela API sao sempre a fonte operacional (o limite padrao
// varia conforme o pacote contratado).

import {
  BetsApiAuthenticationError,
  BetsApiPermissionError,
  BetsApiRateLimitError,
  BetsApiResponseError,
  BetsApiUnavailableError,
  BetsApiValidationError,
  type BetsApiErrorCode,
} from "./BetsApiErrors.ts";

export type BetsApiRateLimitState = {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
  observedAt: string;
  blocked: boolean;
  reserveReached: boolean;
};

/**
 * Le os headers X-RateLimit-Limit/Remaining/Reset de uma resposta HTTP.
 * `now` e injetavel para tornar o calculo 100% determinístico em testes.
 * `reserve` define a partir de quantas requisicoes restantes o estado
 * passa a ser considerado "reserva atingida" (ver Secao 9 da missao).
 */
export function parseRateLimitHeaders(
  headers: { get(name: string): string | null },
  reserve: number,
  now: () => Date = () => new Date(),
): BetsApiRateLimitState {
  const limitHeader = headers.get("X-RateLimit-Limit");
  const remainingHeader = headers.get("X-RateLimit-Remaining");
  const resetHeader = headers.get("X-RateLimit-Reset");

  const limit = limitHeader !== null && limitHeader !== "" ? Number(limitHeader) : null;
  const remaining = remainingHeader !== null && remainingHeader !== "" ? Number(remainingHeader) : null;
  const resetAt = resetHeader !== null && resetHeader !== "" && Number.isFinite(Number(resetHeader))
    ? new Date(Number(resetHeader) * 1000).toISOString()
    : null;

  const reserveReached = remaining !== null && Number.isFinite(remaining) && remaining <= reserve;

  return {
    limit: Number.isFinite(limit as number) ? limit : null,
    remaining: Number.isFinite(remaining as number) ? remaining : null,
    resetAt,
    observedAt: now().toISOString(),
    blocked: reserveReached,
    reserveReached,
  };
}

const ERROR_CODE_TO_CLASS: Partial<
  Record<string, new (message: string, options?: { status?: number | null; endpoint?: string | null; secret?: string | null }) => Error>
> = {
  AUTHORIZE_FAILED: BetsApiAuthenticationError,
  PERMISSION_DENIED: BetsApiPermissionError,
  TOO_MANY_REQUESTS: BetsApiRateLimitError,
  PARAM_REQUIRED: BetsApiValidationError,
  PARAM_INVALID: BetsApiValidationError,
  UNDER_MAINTENANCE: BetsApiUnavailableError,
};

export type ParsedBetsApiEnvelope<T> = { success: true; data: T } | { success: false; code: BetsApiErrorCode; message: string };

/**
 * Faz o parse seguro do corpo bruto (string) de uma resposta da BetsAPI:
 * JSON invalido ou envelope sem o campo `success` geram
 * BetsApiResponseError; `success` falso mapeia o codigo de erro
 * documentado (quando reconhecido) para a excecao estruturada
 * correspondente, ou BetsApiResponseError generico caso contrario.
 */
export function parseBetsApiEnvelope<T>(rawBody: string, endpoint: string, secret?: string | null): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch (error) {
    throw new BetsApiResponseError("Resposta da BetsAPI nao e um JSON valido.", { endpoint, secret, cause: error });
  }

  if (typeof parsed !== "object" || parsed === null || !("success" in parsed)) {
    throw new BetsApiResponseError('Resposta da BetsAPI sem o campo "success" esperado.', { endpoint, secret });
  }

  const envelope = parsed as { success: unknown; error?: { code?: string; message?: string } };
  const successValue = envelope.success;
  const isSuccess = successValue === 1 || successValue === true;

  if (!isSuccess) {
    const errorCode = envelope.error?.code ?? "INTERNAL_SERVER_ERROR";
    const message = envelope.error?.message ?? `A BetsAPI reportou success=false (codigo: ${errorCode}).`;
    const ErrorClass = ERROR_CODE_TO_CLASS[errorCode] ?? BetsApiResponseError;
    throw new ErrorClass(message, { endpoint, secret });
  }

  return parsed as T;
}
