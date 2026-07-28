// Sprint 7.3 — Prediction Repository (refinado na Sprint 7.3.1).
// Contrato de persistência do Prediction Center (Sprint 6.5+7.x).
// Mesmo padrão de porta já usado por `ObservabilityRepository` (Fase
// 3.5): interface única, implementada por `InMemoryPredictionRepository`
// (obrigatória) e `PrismaPredictionRepository` (usa o schema real da
// Sprint 7.2). Nenhum método aqui chama `predictMatch`, calcula Green
// Score/probabilidade, seleciona mercado, classifica risco ou monta
// ViewModel — apenas persiste, recupera, filtra e pagina o que já foi
// calculado pelo Prediction Orchestrator.

// Import relativo (não `@/`) — este contrato precisa ser executável
// também por `node --test` (sem bundler), mesma justificativa já
// documentada em `predictionCenterFormatters.ts`. `PredictionSnapshot`
// é reaproveitado de `prediction-evaluation` (Sprint 4.5) — nunca
// redefinido.
import { createHash } from "node:crypto";
import type { PredictionSnapshot } from "../../services/prediction-evaluation/index.ts";
import { PredictionRepositoryValidationError } from "./predictionRepositoryErrors.ts";
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT, MIN_SEARCH_LIMIT, MIN_SEARCH_OFFSET } from "./predictionRepositoryConstants.ts";

export type PredictionRepositoryHealth = {
  status: "available" | "unavailable";
  backend: "memory" | "prisma";
  detail: string | null;
};

/**
 * Origem de UMA previsão persistida. Tipo próprio do Repository — não
 * importado de `predictionCenterTypes.ts` — para manter esta camada de
 * persistência isolada do Prediction Center (a persistência é a camada
 * mais baixa; o Prediction Center é quem eventualmente dependerá dela,
 * nunca o contrário). Mesmos dois valores de `PredictionCenterSourceKind`.
 */
export type PredictionRecordSource = "fixture" | "real";

/**
 * O que o chamador fornece para persistir uma previsão. Não inclui
 * `id`/`createdAt` — ambos são atribuídos pela camada de persistência
 * (cuid do banco / timestamp de gravação), nunca pelo chamador.
 * `snapshotHash` deve ser calculado previamente (ver
 * `computePredictionSnapshotHash`) — o Repository nunca o recalcula
 * silenciosamente, apenas o usa para a busca idempotente.
 */
export type PredictionRecordDraft = {
  snapshotHash: string;
  schemaVersion: string;
  modelVersion: string;
  configurationHash: string;
  source: PredictionRecordSource;
  snapshot: PredictionSnapshot;
};

/** Registro persistido — `PredictionRecordDraft` mais os campos
 * atribuídos pela persistência. */
export type PredictionRecord = PredictionRecordDraft & {
  id: string;
  createdAt: string;
};

/** Somente filtros de domínio — paginação/ordenação vivem em
 * `PredictionSearchOptions` (Sprint 7.3.1: os dois contratos eram
 * misturados na Sprint 7.3, agora separados). */
export type PredictionSearchFilter = {
  matchId?: string;
  /** Casa OU visitante — nunca os dois simultaneamente. */
  playerId?: string;
  league?: string;
  period?: string;
};

export type PredictionSearchOrderBy = "generatedAt" | "createdAt";
export type PredictionSearchOrderDirection = "asc" | "desc";

export type PredictionSearchOptions = {
  limit?: number;
  offset?: number;
  orderBy?: PredictionSearchOrderBy;
  orderDirection?: PredictionSearchOrderDirection;
};

export type PredictionSearchResult = {
  items: PredictionRecord[];
  /** Total de registros que correspondem ao filtro, ANTES da paginação. */
  total: number;
};

export interface PredictionRepository {
  health(): Promise<PredictionRepositoryHealth>;

  /** Idempotente por `draft.snapshotHash`: salvar o mesmo hash duas
   * vezes nunca cria duplicata nem troca o `id` já atribuído. */
  save(draft: PredictionRecordDraft): Promise<PredictionRecord>;

  getById(id: string): Promise<PredictionRecord | null>;

  /** Único método de consulta com filtro — nunca calcula relevância,
   * apenas filtra/ordena/pagina o que já foi salvo. `filter`/`options`
   * são ambos opcionais — `search()` sem argumentos continua válido. */
  search(filter?: PredictionSearchFilter, options?: PredictionSearchOptions): Promise<PredictionSearchResult>;
}

/** Clampa `limit`/`offset` de `PredictionSearchOptions` aos limites
 * seguros de `predictionRepositoryConstants.ts` — nunca lança exceção
 * por um valor fora da faixa, apenas o corrige (mesmo espírito de
 * `clamp()` já usado em todo o Prediction Orchestrator). */
export function normalizeSearchPagination(options: Pick<PredictionSearchOptions, "limit" | "offset"> = {}): { limit: number; offset: number } {
  const rawLimit = options.limit ?? DEFAULT_SEARCH_LIMIT;
  const limit = Math.min(MAX_SEARCH_LIMIT, Math.max(MIN_SEARCH_LIMIT, Math.trunc(rawLimit)));
  const rawOffset = options.offset ?? MIN_SEARCH_OFFSET;
  const offset = Math.max(MIN_SEARCH_OFFSET, Math.trunc(rawOffset));
  return { limit, offset };
}

/** Resolve `orderBy`/`orderDirection` com os defaults obrigatórios
 * (`"generatedAt"`/`"desc"`) — mesma semântica padrão já aprovada na
 * Sprint 7.3, agora explícita e configurável. */
export function resolveSearchOrder(options: Pick<PredictionSearchOptions, "orderBy" | "orderDirection"> = {}): {
  orderBy: PredictionSearchOrderBy;
  orderDirection: PredictionSearchOrderDirection;
} {
  return {
    orderBy: options.orderBy ?? "generatedAt",
    orderDirection: options.orderDirection ?? "desc",
  };
}

/**
 * Cadeia de critérios de desempate para UM `orderBy`, na ordem em que
 * devem ser aplicados — única fonte de verdade reutilizada por
 * `InMemoryPredictionRepository` (comparador manual) e
 * `PrismaPredictionRepository` (`orderBy` composto), garantindo
 * ordenação semanticamente equivalente nas duas implementações:
 *
 * - `"generatedAt"`: generatedAt -> createdAt -> id (todos na mesma direção).
 * - `"createdAt"`: createdAt -> id (mesma direção).
 */
export function resolveSearchOrderChain(orderBy: PredictionSearchOrderBy): ("generatedAt" | "createdAt" | "id")[] {
  return orderBy === "generatedAt" ? ["generatedAt", "createdAt", "id"] : ["createdAt", "id"];
}

/**
 * Hash determinístico de idempotência — utilitário técnico puro,
 * reaproveitando a mesma técnica já usada por `computeConfigurationHash`
 * (`PredictionOrchestrator.ts`: `node:crypto`, SHA-256). Não é invocado
 * automaticamente por `save()` — o chamador (Query Service, Sprint 7.4)
 * decide quando calcular, mantendo o Repository livre de qualquer lógica
 * de composição de identidade.
 *
 * `sha256(matchId + "::" + configurationHash + "::" + generatedAt)` —
 * regra aprovada na Sprint 7.1/7.3, não alterada.
 */
export function computePredictionSnapshotHash(snapshot: PredictionSnapshot): string {
  const generatedAt = snapshot.result.metadata.generatedAt;
  const configurationHash = snapshot.result.metadata.configurationHash;
  return createHash("sha256").update(`${snapshot.matchId}::${configurationHash}::${generatedAt}`).digest("hex");
}

/**
 * Validação estrutural mínima — nunca revalida probabilidade, Green
 * Score ou qualquer regra do motor. Compartilhada por
 * `InMemoryPredictionRepository` e `PrismaPredictionRepository` para
 * nunca duplicar a mesma checagem nas duas implementações.
 */
export function validatePredictionRecordDraft(draft: PredictionRecordDraft): void {
  const invalidFields: string[] = [];

  if (!draft.snapshotHash) invalidFields.push("snapshotHash");
  if (!draft.schemaVersion) invalidFields.push("schemaVersion");
  if (!draft.modelVersion) invalidFields.push("modelVersion");
  if (!draft.configurationHash) invalidFields.push("configurationHash");
  if (!draft.snapshot?.matchId) invalidFields.push("snapshot.matchId");

  const generatedAt = draft.snapshot?.result?.metadata?.generatedAt;
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) invalidFields.push("snapshot.result.metadata.generatedAt");

  if (draft.source !== "fixture" && draft.source !== "real") invalidFields.push("source");

  if (invalidFields.length > 0) throw new PredictionRepositoryValidationError(invalidFields);
}
