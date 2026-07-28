// Sprint 7.4 — Prediction Query Service.
// Camada de leitura acima do `PredictionRepository` — consome
// exclusivamente o contrato de Repository (Sprint 7.3/7.3.1), nunca o
// Prisma Client, `PredictionSnapshotRecord`, `snapshotPayload` ou
// `PredictionSnapshotMapper` diretamente. Nunca chama `predictMatch`,
// nunca calcula Green Score/probabilidade, nunca seleciona mercado,
// nunca classifica risco, nunca monta `PredictionCenterViewModel`. Nunca
// persiste — `save()` do Repository nunca é invocado por este serviço.
//
// Injeção de dependência via construtor (mesmo padrão já usado pelos
// próprios Repositories) — este serviço nunca instancia
// `InMemoryPredictionRepository`/`PrismaPredictionRepository`/
// `PrismaClient` internamente; a escolha da implementação concreta é
// responsabilidade de uma sprint futura de composição.

// Import relativo (não `@/`) — mesma justificativa já documentada em
// `PredictionRepository.ts`.
import type {
  PredictionRecord,
  PredictionRepository,
  PredictionSearchFilter,
  PredictionSearchOptions,
} from "../../repositories/prediction/PredictionRepository.ts";
import { normalizeSearchPagination } from "../../repositories/prediction/PredictionRepository.ts";
import type { PredictionDetail, PredictionQueryHealth, PredictionQueryInput, PredictionQueryPage, PredictionSummary } from "./predictionQueryTypes.ts";
import { PredictionQueryValidationError } from "./predictionQueryErrors.ts";

const KNOWN_ORDER_BY = ["generatedAt", "createdAt"];
const KNOWN_ORDER_DIRECTION = ["asc", "desc"];

/** Extrai os campos escalares de `PredictionRecord.snapshot` — nunca
 * recalcula nada, apenas lê valores já produzidos pelo motor. */
function toSummary(record: PredictionRecord): PredictionSummary {
  const { snapshot, ...scalarFields } = record;
  return {
    ...scalarFields,
    matchId: snapshot.matchId,
    homePlayerId: snapshot.homePlayerId,
    awayPlayerId: snapshot.awayPlayerId,
    virtualTeamHome: snapshot.virtualTeamHome,
    virtualTeamAway: snapshot.virtualTeamAway,
    league: snapshot.league,
    period: snapshot.period,
    sequenceKey: snapshot.sequenceKey,
    generatedAt: snapshot.result.metadata.generatedAt,
    greenScoreCategory: snapshot.result.greenScore.category,
    combinedStatus: snapshot.result.quality.combinedStatus,
  };
}

/** `toSummary` mais o snapshot completo, em cópia defensiva própria do
 * serviço — mesmo que o Repository já devolva cópias isoladas (Sprint
 * 7.3), esta fronteira nunca depende disso: mutar o `snapshot` de um
 * `PredictionDetail` retornado nunca afeta o Repository nem qualquer
 * consulta futura. */
function toDetail(record: PredictionRecord): PredictionDetail {
  return { ...toSummary(record), snapshot: structuredClone(record.snapshot) };
}

/** Valida apenas os parâmetros de consulta (presença/formato) — nunca
 * revalida conteúdo matemático do `PredictionSnapshot`, nunca duplica
 * `validatePredictionRecordDraft` (Sprint 7.3). */
function validateQueryInput(query: PredictionQueryInput): void {
  const invalidFields: string[] = [];

  if (query.matchId !== undefined && query.matchId === "") invalidFields.push("matchId");
  if (query.playerId !== undefined && query.playerId === "") invalidFields.push("playerId");
  if (query.league !== undefined && query.league === "") invalidFields.push("league");
  if (query.period !== undefined && query.period === "") invalidFields.push("period");
  if (query.orderBy !== undefined && !KNOWN_ORDER_BY.includes(query.orderBy)) invalidFields.push("orderBy");
  if (query.orderDirection !== undefined && !KNOWN_ORDER_DIRECTION.includes(query.orderDirection)) invalidFields.push("orderDirection");

  if (invalidFields.length > 0) throw new PredictionQueryValidationError(invalidFields);
}

/** Separa `PredictionQueryInput` (contrato público deste serviço) em
 * `PredictionSearchFilter`/`PredictionSearchOptions` (contrato do
 * Repository) — a única tradução entre os dois, nunca espalhada. */
function splitQueryInput(query: PredictionQueryInput): { filter: PredictionSearchFilter; options: PredictionSearchOptions } {
  validateQueryInput(query);
  return {
    filter: { matchId: query.matchId, playerId: query.playerId, league: query.league, period: query.period },
    options: { limit: query.limit, offset: query.offset, orderBy: query.orderBy, orderDirection: query.orderDirection },
  };
}

export class PredictionQueryService {
  private readonly repository: PredictionRepository;

  constructor(repository: PredictionRepository) {
    this.repository = repository;
  }

  /** Delega inteiramente ao Repository — nunca executa consulta extra,
   * nunca modifica dados. */
  async health(): Promise<PredictionQueryHealth> {
    return this.repository.health();
  }

  /** Nunca lança erro apenas porque o ID não existe — retorna `null`.
   * Lança `PredictionQueryValidationError` para ID vazio/ausente. */
  async getById(id: string): Promise<PredictionDetail | null> {
    if (!id) throw new PredictionQueryValidationError(["id"]);
    const record = await this.repository.getById(id);
    return record ? toDetail(record) : null;
  }

  async search(query: PredictionQueryInput = {}): Promise<PredictionQueryPage> {
    const { filter, options } = splitQueryInput(query);
    const { limit, offset } = normalizeSearchPagination(options);
    const result = await this.repository.search(filter, options);

    return {
      items: result.items.map(toSummary),
      total: result.total,
      limit,
      offset,
      hasNextPage: offset + result.items.length < result.total,
      hasPreviousPage: offset > 0,
    };
  }

  /** Reutiliza `search()` — nunca duplica lógica de paginação. */
  async getByMatch(matchId: string, options: Omit<PredictionQueryInput, "matchId" | "playerId"> = {}): Promise<PredictionQueryPage> {
    if (!matchId) throw new PredictionQueryValidationError(["matchId"]);
    return this.search({ ...options, matchId });
  }

  /** Jogador como mandante OU visitante — mesmo comportamento já
   * implementado no Repository (`playerId`), nunca duplicado aqui. */
  async getByPlayer(playerId: string, options: Omit<PredictionQueryInput, "matchId" | "playerId"> = {}): Promise<PredictionQueryPage> {
    if (!playerId) throw new PredictionQueryValidationError(["playerId"]);
    return this.search({ ...options, playerId });
  }

  /** Busca diretamente no Repository (não via `search()`, para um único
   * round-trip) com `orderBy: "generatedAt"`/`orderDirection: "desc"`
   * fixos — nunca assume que o registro mais recente é o de maior `id`. */
  async getLatestByMatch(matchId: string): Promise<PredictionDetail | null> {
    if (!matchId) throw new PredictionQueryValidationError(["matchId"]);
    const result = await this.repository.search({ matchId }, { orderBy: "generatedAt", orderDirection: "desc", limit: 1, offset: 0 });
    const [latest] = result.items;
    return latest ? toDetail(latest) : null;
  }
}
