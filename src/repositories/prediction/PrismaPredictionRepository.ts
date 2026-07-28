// Sprint 7.3 — Prediction Repository (refinado na Sprint 7.3.1).
// Implementação Prisma real de `PredictionRepository`, usando o modelo
// `PredictionSnapshotRecord` (Sprint 7.2). Diferente de
// `PrismaObservabilityRepository` (Fase 3.5, que nunca importa
// `@prisma/client` porque nunca teve schema real), esta implementação
// importa o Prisma Client real — o schema já existe — mas nunca cria
// uma instância nova (`new PrismaClient()`): o client é injetável via
// construtor, com default para o singleton real de `src/lib/prisma.ts`,
// exatamente para permitir teste com um client falso sem depender de
// banco real, sem duplicar a instância de produção.
//
// Regras desta camada: apenas validar, chamar o mapper, acessar o
// Prisma Client, tratar erros técnicos e devolver o resultado. Nunca
// chama `predictMatch`, nunca calcula Green Score/probabilidade, nunca
// seleciona mercado, nunca classifica risco, nunca monta ViewModel. Toda
// serialização/mapping detalhado vive em `PredictionSnapshotMapper.ts`
// (Sprint 7.3.1) — este arquivo nunca contém `JSON.stringify`/
// `JSON.parse`/switch de `source` diretamente.

// Import relativo (não `@/`) — mesma justificativa de
// `PredictionRepository.ts`; confirmado empiricamente que `@prisma/client`
// resolve sob `node --test` puro (diferente de `next/headers`/`next/server`).
import type { PredictionSnapshotRecord as PredictionSnapshotRecordRow } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma.ts";
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
import { mapDraftToPrismaCreateInput, mapRowToPredictionRecord } from "./PredictionSnapshotMapper.ts";
import { PredictionRepositoryUnavailableError, PredictionSerializationError } from "./predictionRepositoryErrors.ts";

/**
 * Forma mínima que um client precisa expor para esta classe funcionar —
 * permite injetar, em teste, um objeto simples (sem `@prisma/client`
 * real, sem banco) que implemente apenas estes 4 métodos.
 */
export type PredictionSnapshotRecordDelegate = {
  findUnique(args: { where: { id?: string; snapshotHash?: string } }): Promise<PredictionSnapshotRecordRow | null>;
  findMany(args?: Record<string, unknown>): Promise<PredictionSnapshotRecordRow[]>;
  count(args?: Record<string, unknown>): Promise<number>;
  create(args: { data: Record<string, unknown> }): Promise<PredictionSnapshotRecordRow>;
};

export type PredictionPrismaClientLike = {
  predictionSnapshotRecord: PredictionSnapshotRecordDelegate;
};

/** Código de erro do Prisma para violação de constraint única (P2002) —
 * usado apenas para detectar a corrida de duas gravações simultâneas do
 * mesmo `snapshotHash`, nunca para inspecionar detalhes de banco. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

export class PrismaPredictionRepository implements PredictionRepository {
  private readonly client: PredictionPrismaClientLike;

  constructor(client: PredictionPrismaClientLike = defaultPrisma as unknown as PredictionPrismaClientLike) {
    this.client = client;
  }

  async health(): Promise<PredictionRepositoryHealth> {
    try {
      await this.client.predictionSnapshotRecord.count();
      return { status: "available", backend: "prisma", detail: null };
    } catch {
      return { status: "unavailable", backend: "prisma", detail: "Não foi possível acessar a tabela de previsões persistidas." };
    }
  }

  async save(draft: PredictionRecordDraft): Promise<PredictionRecord> {
    validatePredictionRecordDraft(draft);

    try {
      const existing = await this.client.predictionSnapshotRecord.findUnique({ where: { snapshotHash: draft.snapshotHash } });
      if (existing) return mapRowToPredictionRecord(existing);

      try {
        const created = await this.client.predictionSnapshotRecord.create({ data: mapDraftToPrismaCreateInput(draft) });
        return mapRowToPredictionRecord(created);
      } catch (error) {
        // Corrida entre duas gravações simultâneas do mesmo snapshotHash:
        // a segunda perde a constraint única, mas o resultado ainda deve
        // ser idempotente — nunca um erro para o chamador.
        if (isUniqueConstraintViolation(error)) {
          const raceWinner = await this.client.predictionSnapshotRecord.findUnique({ where: { snapshotHash: draft.snapshotHash } });
          if (raceWinner) return mapRowToPredictionRecord(raceWinner);
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof PredictionSerializationError) throw error;
      throw new PredictionRepositoryUnavailableError("save", error);
    }
  }

  async getById(id: string): Promise<PredictionRecord | null> {
    try {
      const row = await this.client.predictionSnapshotRecord.findUnique({ where: { id } });
      return row ? mapRowToPredictionRecord(row) : null;
    } catch (error) {
      if (error instanceof PredictionSerializationError) throw error;
      throw new PredictionRepositoryUnavailableError("getById", error);
    }
  }

  async search(filter: PredictionSearchFilter = {}, options: PredictionSearchOptions = {}): Promise<PredictionSearchResult> {
    const where: Record<string, unknown> = {};
    if (filter.matchId !== undefined) where.matchId = filter.matchId;
    if (filter.playerId !== undefined) where.OR = [{ homePlayerId: filter.playerId }, { awayPlayerId: filter.playerId }];
    if (filter.league !== undefined) where.league = filter.league;
    if (filter.period !== undefined) where.period = filter.period;

    const { limit, offset } = normalizeSearchPagination(options);
    const { orderBy, orderDirection } = resolveSearchOrder(options);
    // Mesma cadeia de critérios de `resolveSearchOrderChain` (compartilhada
    // com o InMemory Repository) — os nomes da cadeia já são os próprios
    // nomes de coluna do Prisma, então o mapeamento é uma passagem direta.
    const orderByClauses = resolveSearchOrderChain(orderBy).map((key) => ({ [key]: orderDirection }));

    try {
      const [rows, total] = await Promise.all([
        this.client.predictionSnapshotRecord.findMany({
          where,
          orderBy: orderByClauses,
          skip: offset,
          take: limit,
        }),
        this.client.predictionSnapshotRecord.count({ where }),
      ]);

      return { items: rows.map(mapRowToPredictionRecord), total };
    } catch (error) {
      if (error instanceof PredictionSerializationError) throw error;
      throw new PredictionRepositoryUnavailableError("search", error);
    }
  }
}
