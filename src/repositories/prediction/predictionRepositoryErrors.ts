// Sprint 7.3 — Prediction Repository.
// Erros técnicos do Repository, mesmo padrão de
// `ObservabilityStorageUnavailableError` (Fase 3.5): classe própria,
// `readonly code`, `this.name` setado, mensagem sempre genérica/segura
// (nunca URL de banco, credencial, SQL bruto ou stack trace). A causa
// original é preservada via `Error.cause` (nunca exposta na mensagem
// pública), quando disponível.

export class PredictionRepositoryUnavailableError extends Error {
  readonly code = "PREDICTION_REPOSITORY_UNAVAILABLE";
  constructor(operation: string, cause?: unknown) {
    super(`PredictionRepository indisponível para "${operation}": falha ao acessar a camada de persistência.`);
    this.name = "PredictionRepositoryUnavailableError";
    if (cause !== undefined) this.cause = cause;
  }
}

export class PredictionSerializationError extends Error {
  readonly code = "PREDICTION_SERIALIZATION_ERROR";
  constructor(operation: string, cause?: unknown) {
    super(`Falha ao (de)serializar snapshotPayload durante "${operation}": payload inválido ou corrompido.`);
    this.name = "PredictionSerializationError";
    if (cause !== undefined) this.cause = cause;
  }
}

export class PredictionRepositoryValidationError extends Error {
  readonly code = "PREDICTION_REPOSITORY_VALIDATION_ERROR";
  readonly invalidFields: string[];
  constructor(invalidFields: string[]) {
    super(`PredictionRecordDraft estruturalmente inválido: campo(s) ausente(s)/inválido(s): ${invalidFields.join(", ")}.`);
    this.name = "PredictionRepositoryValidationError";
    this.invalidFields = invalidFields;
  }
}
