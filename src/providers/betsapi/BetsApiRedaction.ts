// Fase 3 — BetsAPI Real Integration.
// BetsApiRedaction: utilitário central de sanitização. Nenhum log, erro,
// métrica, relatório ou objeto serializado deste módulo pode expor o
// token da BetsAPI. Duas camadas de proteção são aplicadas sempre que
// possível:
//   1) substituição exata do valor do token (quando conhecido em tempo de
//      execução, via `createRedactor(token)`);
//   2) uma regra genérica por regex para o padrão de query string
//      `token=...`, que funciona mesmo sem conhecer o valor exato (defesa
//      em profundidade, por exemplo para strings vindas de terceiros).

const REDACTED = "[REDACTED]";
const TOKEN_QUERY_PATTERN = /([?&]token=)([^&\s"']*)/gi;
const SENSITIVE_HEADER_NAMES = new Set(["authorization", "x-api-key", "x-auth-token"]);

/** Remove qualquer ocorrência do padrão `token=...` em uma URL ou texto livre, mesmo sem conhecer o valor exato. */
export function redactTokenPattern(value: string): string {
  if (typeof value !== "string") return value;
  return value.replace(TOKEN_QUERY_PATTERN, `$1${REDACTED}`);
}

/** Substitui todas as ocorrências do valor exato do token por [REDACTED]. Não faz nada se o token for vazio/nulo. */
export function redactExactValue(value: string, secret: string | null | undefined): string {
  if (typeof value !== "string") return value;
  if (!secret || secret.length === 0) return value;
  return value.split(secret).join(REDACTED);
}

export function redactUrl(url: string, secret?: string | null): string {
  let result = redactTokenPattern(url);
  if (secret) result = redactExactValue(result, secret);
  return result;
}

export function redactHeaders(headers: Record<string, string>, secret?: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) {
      result[key] = REDACTED;
    } else {
      result[key] = secret ? redactExactValue(value, secret) : value;
    }
  }
  return result;
}

/** Sanitiza uma mensagem de erro arbitrária (nunca deve conter o token). */
export function redactErrorMessage(message: string, secret?: string | null): string {
  return redactUrl(message, secret);
}

/** Sanitiza um objeto de configuração para logging/serialização: nunca inclui o valor real do token. */
export function redactConfigObject<T extends { token?: string | null }>(config: T): Omit<T, "token"> & { token: string } {
  const { token: _token, ...rest } = config;
  return { ...rest, token: config.token ? REDACTED : "" } as Omit<T, "token"> & { token: string };
}

/**
 * Sanitização profunda e recursiva de qualquer objeto serializável (para
 * snapshots/relatórios/métricas): qualquer chave chamada "token" ou
 * "authorization" (case-insensitive) tem seu valor substituído, e toda
 * string restante ainda passa pelo filtro de padrão de query string.
 */
export function redactDeep(value: unknown, secret?: string | null): unknown {
  if (typeof value === "string") {
    return redactUrl(value, secret);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, secret));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (/^(token|authorization|x-api-key|x-auth-token)$/i.test(key)) {
        result[key] = val ? REDACTED : val;
      } else {
        result[key] = redactDeep(val, secret);
      }
    }
    return result;
  }
  return value;
}

/** Cria um conjunto de funções de redaction "presas" a um token específico conhecido em tempo de execução. */
export function createRedactor(secret: string | null | undefined) {
  return {
    url: (url: string) => redactUrl(url, secret),
    headers: (headers: Record<string, string>) => redactHeaders(headers, secret),
    errorMessage: (message: string) => redactErrorMessage(message, secret),
    deep: (value: unknown) => redactDeep(value, secret),
  };
}
