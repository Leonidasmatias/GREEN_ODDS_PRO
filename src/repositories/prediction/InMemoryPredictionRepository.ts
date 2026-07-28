// Sprint 7.3 — Prediction Repository.
// Implementação padrão (obrigatória) do `PredictionRepository`, guardando
// tudo em memória do processo — mesmo espírito de
// `InMemoryObservabilityRepository` (Fase 3.5). Nenhum dado sobrevive ao
// reinício do processo; usada por padrão em testes e enquanto o
// `PrismaPredictionRepository` não estiver em uso.

// Import relativo (não `@/`) — mesma justificativa de `PredictionRepository.ts`.
import type {
  PredictionRecord,
  PredictionRecordDraft,
  PredictionRepository,
  PredictionRepositoryHealth,
  PredictionSearchFilter,
  PredictionSearchOptions,
  PredictionSearchResult,
} from "./PredictionRepository.ts";
import { normalizeSearchPagination, resolveSearchOrder, resolveSearchOrderChain, validatePredictionRecordDraft } from "./PredictionRepository.ts";

/** Cópia profunda defensiva — nunca expõe (nem aceita) a mesma
 * referência de objeto entre o Repository e o chamador, em nenhuma
 * direção. Todo dado aqui é serializável (já comprovado desde a Sprint
 * 6.5 — `PredictionSnapshot` é JSON-safe), então `structuredClone` é
 * suficiente e nunca lança para os dados deste domínio. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Extrai o valor comparável (string, sempre ISO/lexicograficamente
 * ordenável) para uma chave da cadeia de `resolveSearchOrderChain`. */
function sortKeyValue(record: PredictionRecord, key: "generatedAt" | "createdAt" | "id"): string {
  if (key === "generatedAt") return record.snapshot.result.metadata.generatedAt;
  if (key === "createdAt") return record.createdAt;
  return record.id;
}

export class InMemoryPredictionRepository implements PredictionRepository {
  // Duas estruturas, sem estado compartilhado entre instâncias (cada
  // `new InMemoryPredictionRepository()` tem seu próprio armazenamento
  // isolado) — nunca uma variável de módulo/global.
  private readonly byId = new Map<string, PredictionRecord>();
  private readonly byHash = new Map<string, PredictionRecord>();

  async health(): Promise<PredictionRepositoryHealth> {
    return { status: "available", backend: "memory", detail: null };
  }

  async save(draft: PredictionRecordDraft): Promise<PredictionRecord> {
    validatePredictionRecordDraft(draft);

    const existing = this.byHash.get(draft.snapshotHash);
    if (existing) return clone(existing);

    // ID determinístico a partir do próprio hash de idempotência — nunca
    // `Math.random()`/`Date.now()` (proibido para IDs imprevisíveis nos
    // testes). Prefixo apenas para deixar claro, em inspeção/log, que o
    // registro veio do backend em memória, nunca do Prisma (que usa cuid()).
    const record: PredictionRecord = {
      ...clone(draft),
      id: `mem_${draft.snapshotHash}`,
      createdAt: new Date().toISOString(),
    };

    this.byId.set(record.id, record);
    this.byHash.set(record.snapshotHash, record);
    return clone(record);
  }

  async getById(id: string): Promise<PredictionRecord | null> {
    const found = this.byId.get(id);
    return found ? clone(found) : null;
  }

  async search(filter: PredictionSearchFilter = {}, options: PredictionSearchOptions = {}): Promise<PredictionSearchResult> {
    const matched = Array.from(this.byId.values()).filter((record) => {
      if (filter.matchId !== undefined && record.snapshot.matchId !== filter.matchId) return false;
      if (filter.playerId !== undefined && record.snapshot.homePlayerId !== filter.playerId && record.snapshot.awayPlayerId !== filter.playerId) return false;
      if (filter.league !== undefined && record.snapshot.league !== filter.league) return false;
      if (filter.period !== undefined && record.snapshot.period !== filter.period) return false;
      return true;
    });

    // Ordenação determinística: mesma cadeia de critérios de
    // `resolveSearchOrderChain` (compartilhada com o Prisma
    // Repository) — nunca depende da ordem de inserção do Map.
    const { orderBy, orderDirection } = resolveSearchOrder(options);
    const chain = resolveSearchOrderChain(orderBy);
    const factor = orderDirection === "asc" ? 1 : -1;

    const ordered = [...matched].sort((a, b) => {
      for (const key of chain) {
        const delta = sortKeyValue(a, key).localeCompare(sortKeyValue(b, key)) * factor;
        if (delta !== 0) return delta;
      }
      return 0;
    });

    const { limit, offset } = normalizeSearchPagination(options);
    const page = ordered.slice(offset, offset + limit);

    return { items: page.map(clone), total: ordered.length };
  }
}
