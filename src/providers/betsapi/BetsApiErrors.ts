// Fase 3 — BetsAPI Real Integration.
// Erros estruturados para a integração real com a BetsAPI. Cada erro
// carrega apenas: code, status, endpoint (sem token), retryable,
// safeMessage e uma cause opcional já sanitizada — NUNCA o token, mesmo
// que o erro original (cause) o contivesse. Todo texto que entra em
// safeMessage/endpoint/cause passa por BetsApiRedaction antes de ser
// armazenado.

import { redactErrorMessage, redactUrl } from "./BetsApiRedaction.ts";

export type BetsApiErrorCode =
  | "CONFIGURATION_ERROR"
  | "AUTHORIZE_FAILED"
  | "PERMISSION_DENIED"
  | "TOO_MANY_REQUESTS"
  | "PARAM_REQUIRED"
  | "PARAM_INVALID"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "UNDER_MAINTENANCE"
  | "INTERNAL_SERVER_ERROR"
  | "UNAVAILABLE";

export type BetsApiErrorOptions = {
  code: BetsApiErrorCode;
  status?: number | null;
  endpoint?: string | null;
  retryable: boolean;
  cause?: unknown;
  secret?: string | null;
};

export class BetsApiError extends Error {
  readonly code: BetsApiErrorCode;
  readonly status: number | null;
  readonly endpoint: string | null;
  readonly retryable: boolean;
  readonly safeMessage: string;
  readonly cause?: string;

  constructor(safeMessage: string, options: BetsApiErrorOptions) {
    const sanitizedMessage = redactErrorMessage(safeMessage, options.secret);
    super(sanitizedMessage);
    this.name = new.target.name;
    this.code = options.code;
    this.status = options.status ?? null;
    this.endpoint = options.endpoint ? redactUrl(options.endpoint, options.secret) : null;
    this.retryable = options.retryable;
    this.safeMessage = sanitizedMessage;
    if (options.cause !== undefined) {
      const causeText = options.cause instanceof Error ? options.cause.message : String(options.cause);
      this.cause = redactErrorMessage(causeText, options.secret);
    }
  }
}

export class BetsApiConfigurationError extends BetsApiError {
  constructor(safeMessage: string, options: Omit<BetsApiErrorOptions, "code" | "retryable"> = {}) {
    super(safeMessage, { ...options, code: "CONFIGURATION_ERROR", retryable: false });
  }
}

export class BetsApiAuthenticationError extends BetsApiError {
  constructor(safeMessage: string, options: Omit<BetsApiErrorOptions, "code" | "retryable"> = {}) {
    super(safeMessage, { ...options, code: "AUTHORIZE_FAILED", retryable: false });
  }
}

export class BetsApiPermissionError extends BetsApiError {
  constructor(safeMessage: string, options: Omit<BetsApiErrorOptions, "code" | "retryable"> = {}) {
    super(safeMessage, { ...options, code: "PERMISSION_DENIED", retryable: false });
  }
}

export class BetsApiRateLimitError extends BetsApiError {
  constructor(safeMessage: string, options: Omit<BetsApiErrorOptions, "code" | "retryable"> = {}) {
    super(safeMessage, { ...options, code: "TOO_MANY_REQUESTS", retryable: true });
  }
}

export class BetsApiValidationError extends BetsApiError {
  constructor(safeMessage: string, options: Omit<BetsApiErrorOptions, "code" | "retryable"> = {}) {
    super(safeMessage, { ...options, code: "PARAM_INVALID", retryable: false });
  }
}

export class BetsApiTimeoutError extends BetsApiError {
  constructor(safeMessage: string, options: Omit<BetsApiErrorOptions, "code" | "retryable"> = {}) {
    super(safeMessage, { ...options, code: "TIMEOUT", retryable: true });
  }
}

export class BetsApiNetworkError extends BetsApiError {
  constructor(safeMessage: string, options: Omit<BetsApiErrorOptions, "code" | "retryable"> = {}) {
    super(safeMessage, { ...options, code: "NETWORK_ERROR", retryable: true });
  }
}

export class BetsApiResponseError extends BetsApiError {
  constructor(safeMessage: string, options: Omit<BetsApiErrorOptions, "code" | "retryable"> & { code?: BetsApiErrorCode; retryable?: boolean } = {}) {
    super(safeMessage, { code: "INVALID_RESPONSE", retryable: false, ...options });
  }
}

export class BetsApiUnavailableError extends BetsApiError {
  constructor(safeMessage: string, options: Omit<BetsApiErrorOptions, "code" | "retryable"> = {}) {
    super(safeMessage, { ...options, code: "UNDER_MAINTENANCE", retryable: true });
  }
}

/** Codigos de resposta (success=false) que devem ser tratados como retryable. */
export const RETRYABLE_BETSAPI_RESPONSE_CODES: ReadonlySet<string> = new Set([
  "TOO_MANY_REQUESTS",
  "UNDER_MAINTENANCE",
  "INTERNAL_SERVER_ERROR",
]);

/** Status HTTP que devem ser tratados como retryable (rede/timeout tratados separadamente pelo cliente). */
export const RETRYABLE_HTTP_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);
