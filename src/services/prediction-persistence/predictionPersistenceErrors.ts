// Sprint 7.5 — Prediction Persistence Application Service.
// Erros próprios do caso de uso — mesmo padrão de
// `PredictionQueryValidationError`/`PredictionRepositoryValidationError`:
// `readonly code`, mensagem sempre genérica/segura.

export class PredictionPersistenceValidationError extends Error {
  readonly code = "PREDICTION_PERSISTENCE_VALIDATION_ERROR";
  readonly invalidFields: string[];
  constructor(invalidFields: string[]) {
    super(`Dados de persistência inválidos: ${invalidFields.join(", ")}.`);
    this.name = "PredictionPersistenceValidationError";
    this.invalidFields = invalidFields;
  }
}

/**
 * `snapshotHash` informado não corresponde ao hash calculado a partir
 * do `snapshot` real recebido — impede que um chamador persista um hash
 * incompatível com o conteúdo. Mensagem deliberadamente genérica: hashes
 * não são segredo, mas não há necessidade de expô-los para o chamador
 * corrigir o problema (ele já tem os dois valores em mãos).
 */
export class PredictionSnapshotHashMismatchError extends Error {
  readonly code = "PREDICTION_SNAPSHOT_HASH_MISMATCH";
  constructor() {
    super("O snapshotHash informado não corresponde ao conteúdo do snapshot recebido.");
    this.name = "PredictionSnapshotHashMismatchError";
  }
}
