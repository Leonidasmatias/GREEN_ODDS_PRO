// Sprint 7.5 — Prediction Persistence Application Service.
// Contratos públicos de entrada/saída do caso de uso de escrita — nunca
// expõem `snapshotPayload`, enum Prisma ou qualquer tipo de
// infraestrutura. Reaproveita apenas `PredictionRecordSource` (já
// pública no Repository), nunca a redefine.

// Import relativo (não `@/`) — mesma justificativa já documentada em
// `PredictionRepository.ts`/`predictionQueryTypes.ts`.
import type { PredictionRecordSource } from "../../repositories/prediction/PredictionRepository.ts";
import type { PredictionSnapshot } from "../prediction-evaluation/index.ts";

/**
 * Entrada do caso de uso de persistência. `snapshotHash` é opcional —
 * quando ausente, o serviço o calcula; quando presente, o serviço o
 * valida contra o conteúdo real do `snapshot` (nunca confia cegamente
 * num hash externo).
 */
export type PredictionPersistenceInput = {
  snapshot: PredictionSnapshot;
  schemaVersion: string;
  modelVersion: string;
  configurationHash: string;
  source: PredictionRecordSource;
  snapshotHash?: string;
};

/**
 * Resultado do caso de uso — o `PredictionRecord` já persistido,
 * mapeado para um contrato próprio da camada de aplicação. A operação é
 * sempre idempotente (mesmo conteúdo -> mesmo `snapshotHash` -> mesmo
 * registro), mas este contrato **não distingue** criação de reutilização
 * — o Repository não informa isso, e nenhuma consulta extra é feita só
 * para inferir.
 */
export type PredictionPersistenceResult = {
  id: string;
  snapshotHash: string;
  createdAt: string;
  schemaVersion: string;
  modelVersion: string;
  configurationHash: string;
  source: PredictionRecordSource;
  snapshot: PredictionSnapshot;
};

export type PredictionPersistenceHealth = {
  status: "available" | "unavailable";
  backend: "memory" | "prisma";
  detail: string | null;
};
