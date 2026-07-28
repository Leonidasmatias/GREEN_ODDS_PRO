// Sprint 7.4 — Prediction Query Service.
// Erro de validação de PARÂMETROS DE CONSULTA — nunca de conteúdo do
// PredictionSnapshot (isso é responsabilidade exclusiva do Prediction
// Orchestrator). Mesmo padrão de `PredictionRepositoryValidationError`
// (Sprint 7.3): `readonly code`, `invalidFields: string[]`.

export class PredictionQueryValidationError extends Error {
  readonly code = "PREDICTION_QUERY_VALIDATION_ERROR";
  readonly invalidFields: string[];
  constructor(invalidFields: string[]) {
    super(`Parâmetros de consulta inválidos: ${invalidFields.join(", ")}.`);
    this.name = "PredictionQueryValidationError";
    this.invalidFields = invalidFields;
  }
}
