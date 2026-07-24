// Fase 2 — Data Ingestion Pipeline.
// Erro estruturado comum a todos os providers/adapters desta camada.

export class ProviderError extends Error {
  readonly provider: string;
  readonly cause?: unknown;

  constructor(provider: string, message: string, cause?: unknown) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.cause = cause;
  }
}
