// Sprint 7.5 — Prediction Persistence Application Service.
// Caso de uso oficial de escrita: recebe um `PredictionSnapshot` já
// pronto (nunca calcula previsão), calcula/valida o `snapshotHash`
// determinístico, constrói um `PredictionRecordDraft` e delega
// integralmente ao `PredictionRepository.save()`. Nunca acessa Prisma,
// nunca serializa `snapshotPayload`, nunca conhece
// `PredictionSnapshotRecord`, nunca escolhe a implementação concreta do
// Repository.
//
// Injeção de dependência via construtor — campo declarado e atribuído
// no corpo (nunca "parameter properties" do TypeScript: o type-stripping
// nativo do Node, usado para rodar `.ts` diretamente nos testes, não
// suporta essa sintaxe — constraint já confirmada na Sprint 7.4).

// Import relativo (não `@/`) — mesma justificativa já documentada em
// `PredictionRepository.ts`.
import type { PredictionRecordDraft, PredictionRepository } from "../../repositories/prediction/PredictionRepository.ts";
import { computePredictionSnapshotHash } from "../../repositories/prediction/PredictionRepository.ts";
import type { PredictionPersistenceHealth, PredictionPersistenceInput, PredictionPersistenceResult } from "./predictionPersistenceTypes.ts";
import { PredictionPersistenceValidationError, PredictionSnapshotHashMismatchError } from "./predictionPersistenceErrors.ts";

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

/** Valida apenas os metadados do caso de uso — nunca o conteúdo
 * matemático do `PredictionSnapshot`, nunca duplica
 * `validatePredictionRecordDraft` (o Repository continua sendo a
 * segunda linha de defesa estrutural). */
function validatePersistenceInput(input: PredictionPersistenceInput): void {
  const invalidFields: string[] = [];

  if (!input.snapshot || typeof input.snapshot !== "object") invalidFields.push("snapshot");
  if (typeof input.schemaVersion !== "string" || input.schemaVersion.trim().length === 0) invalidFields.push("schemaVersion");
  if (typeof input.modelVersion !== "string" || input.modelVersion.trim().length === 0) invalidFields.push("modelVersion");
  if (typeof input.configurationHash !== "string" || input.configurationHash.trim().length === 0) invalidFields.push("configurationHash");
  if (input.source !== "fixture" && input.source !== "real") invalidFields.push("source");
  if (input.snapshotHash !== undefined && !SHA256_HEX_PATTERN.test(input.snapshotHash)) invalidFields.push("snapshotHash");

  if (invalidFields.length > 0) throw new PredictionPersistenceValidationError(invalidFields);
}

/** `PredictionRecord` -> `PredictionPersistenceResult` — nunca
 * recalcula nada, apenas copia campos e devolve uma cópia defensiva do
 * snapshot. */
function toPersistenceResult(record: {
  id: string;
  snapshotHash: string;
  createdAt: string;
  schemaVersion: string;
  modelVersion: string;
  configurationHash: string;
  source: PredictionPersistenceInput["source"];
  snapshot: PredictionPersistenceInput["snapshot"];
}): PredictionPersistenceResult {
  return {
    id: record.id,
    snapshotHash: record.snapshotHash,
    createdAt: record.createdAt,
    schemaVersion: record.schemaVersion,
    modelVersion: record.modelVersion,
    configurationHash: record.configurationHash,
    source: record.source,
    snapshot: structuredClone(record.snapshot),
  };
}

export class PredictionPersistenceService {
  private readonly repository: PredictionRepository;

  constructor(repository: PredictionRepository) {
    this.repository = repository;
  }

  /** Delega inteiramente ao Repository — nunca executa consulta extra,
   * nunca escreve. */
  async health(): Promise<PredictionPersistenceHealth> {
    return this.repository.health();
  }

  /**
   * Persiste uma previsão já calculada. Fluxo: validar -> calcular o
   * hash esperado -> comparar com `snapshotHash` informado (quando
   * existir) -> montar o draft (com cópia defensiva do snapshot, feita
   * ANTES do `await`, protegendo contra mutação externa durante a
   * chamada assíncrona) -> `repository.save()` exatamente uma vez ->
   * mapear o resultado.
   */
  async persist(input: PredictionPersistenceInput): Promise<PredictionPersistenceResult> {
    validatePersistenceInput(input);

    const schemaVersion = input.schemaVersion.trim();
    const modelVersion = input.modelVersion.trim();
    const configurationHash = input.configurationHash.trim();

    const expectedHash = computePredictionSnapshotHash(input.snapshot);
    if (input.snapshotHash !== undefined && input.snapshotHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new PredictionSnapshotHashMismatchError();
    }

    const draft: PredictionRecordDraft = {
      snapshotHash: expectedHash,
      schemaVersion,
      modelVersion,
      configurationHash,
      source: input.source,
      snapshot: structuredClone(input.snapshot),
    };

    const record = await this.repository.save(draft);
    return toPersistenceResult(record);
  }
}
