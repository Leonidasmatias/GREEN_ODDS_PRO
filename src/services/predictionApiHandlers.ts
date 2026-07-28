// Sprint 8.1 — Prediction API and Server Actions.
// Núcleo puro e testável das rotas HTTP de `/api/predictions*`. Este
// arquivo NUNCA importa `next/server` (confirmado empiricamente que
// `next/server` não resolve sob `node --test` puro, mesma limitação já
// documentada para `next/headers`) — por isso toda a lógica de
// transporte/validação/erro-para-status vive aqui, testável diretamente,
// e os arquivos `route.ts` (Next.js-bound) são wrappers finos que apenas
// adaptam `NextRequest`/`NextResponse` para estas funções.
//
// Autenticação/autorização NUNCA vivem aqui (dependem de `next/headers`
// via `getApiAccess`) — permanecem exclusivamente nos `route.ts`.
//
// Nunca acessa Prisma, `PredictionRepository` ou implementações
// concretas diretamente — consome exclusivamente as funções já expostas
// por `predictionCenterService.ts` (que por sua vez só conhece o
// composition root).

// Imports relativos (não `@/`) — mesma justificativa documentada em
// `predictionCenterFormatters.ts`.
import {
  generateAndPersistPredictionCenterData,
  getLatestPredictionByMatch,
  getPersistedPredictionById,
  getPersistedPredictions,
  getPredictionHistoryByMatch,
} from "./predictionCenterService.ts";
import type { GeneratePredictionInput } from "./predictionCenterService.ts";
import { PredictionQueryValidationError } from "./prediction-query/predictionQueryErrors.ts";
import { PredictionPersistenceValidationError, PredictionSnapshotHashMismatchError } from "./prediction-persistence/predictionPersistenceErrors.ts";
import { PredictionRepositoryUnavailableError, PredictionRepositoryValidationError, PredictionSerializationError } from "../repositories/prediction/predictionRepositoryErrors.ts";
import type { PredictionQueryInput } from "./prediction-query/predictionQueryTypes.ts";

/** Forma de resposta agnóstica de framework — o `route.ts` a converte em
 * `NextResponse.json(body, { status })`. */
export type ApiResult = { status: number; body: unknown };

const ALLOWED_ORDER_BY = ["generatedAt", "createdAt"];
const ALLOWED_ORDER_DIRECTION = ["asc", "desc"];

/** Campos que o cliente NUNCA pode enviar para gerar uma previsão —
 * todos pertencem exclusivamente à camada de motor/persistência. */
const FORBIDDEN_GENERATE_FIELDS = ["snapshot", "snapshotHash", "snapshotPayload", "schemaVersion", "modelVersion", "configurationHash", "source"];

/**
 * Mapeia um erro técnico das camadas de aplicação/persistência para uma
 * resposta HTTP estável — nunca stack trace, connection string, causa
 * interna ou `snapshotPayload`. `PredictionRepositoryValidationError`
 * também mapeia para 400 (é uma segunda linha de defesa estrutural,
 * mesma natureza de "entrada inválida" das validações de aplicação).
 */
export function mapErrorToResult(error: unknown): ApiResult {
  if (error instanceof PredictionQueryValidationError) {
    return { status: 400, body: { error: error.message, fields: error.invalidFields } };
  }
  if (error instanceof PredictionPersistenceValidationError) {
    return { status: 400, body: { error: error.message, fields: error.invalidFields } };
  }
  if (error instanceof PredictionRepositoryValidationError) {
    return { status: 400, body: { error: error.message, fields: error.invalidFields } };
  }
  if (error instanceof PredictionSnapshotHashMismatchError) {
    return { status: 409, body: { error: error.message } };
  }
  if (error instanceof PredictionRepositoryUnavailableError) {
    return { status: 503, body: { error: "Serviço de previsões temporariamente indisponível." } };
  }
  if (error instanceof PredictionSerializationError) {
    return { status: 500, body: { error: "Falha interna ao processar os dados da previsão." } };
  }
  return { status: 500, body: { error: "Erro inesperado ao processar a requisição." } };
}

type ParsedQueryOrError = { query: PredictionQueryInput; invalidFields?: never } | { query?: never; invalidFields: string[] };

/**
 * Valida formato/transporte dos parâmetros de busca (a camada HTTP) —
 * nunca duplica a validação de caso de uso do `PredictionQueryService`
 * (ex.: `matchId`/`league` vazios continuam sendo responsabilidade do
 * Query Service, que já lança `PredictionQueryValidationError` mapeada
 * acima). Aqui só se valida o que é puramente sintático: `limit`/`offset`
 * parseáveis como número, `orderBy`/`orderDirection` reconhecidos.
 */
function parseSearchFilterAndOptions(params: URLSearchParams): ParsedQueryOrError {
  const invalidFields: string[] = [];
  const query: PredictionQueryInput = {};

  const matchId = params.get("matchId");
  if (matchId !== null) query.matchId = matchId;

  const playerId = params.get("playerId");
  if (playerId !== null) query.playerId = playerId;

  const league = params.get("league");
  if (league !== null) query.league = league;

  const period = params.get("period");
  if (period !== null) query.period = period;

  const limitRaw = params.get("limit");
  if (limitRaw !== null) {
    const limit = Number(limitRaw);
    if (!Number.isFinite(limit)) invalidFields.push("limit");
    else query.limit = limit;
  }

  const offsetRaw = params.get("offset");
  if (offsetRaw !== null) {
    const offset = Number(offsetRaw);
    if (!Number.isFinite(offset)) invalidFields.push("offset");
    else query.offset = offset;
  }

  const orderBy = params.get("orderBy");
  if (orderBy !== null) {
    if (!ALLOWED_ORDER_BY.includes(orderBy)) invalidFields.push("orderBy");
    else query.orderBy = orderBy as PredictionQueryInput["orderBy"];
  }

  const orderDirection = params.get("orderDirection");
  if (orderDirection !== null) {
    if (!ALLOWED_ORDER_DIRECTION.includes(orderDirection)) invalidFields.push("orderDirection");
    else query.orderDirection = orderDirection as PredictionQueryInput["orderDirection"];
  }

  if (invalidFields.length > 0) return { invalidFields };
  return { query };
}

/** GET /api/predictions — somente leitura. Nunca chama o Prediction
 * Engine, nunca chama o Persistence Service. */
export async function handleListPredictions(params: URLSearchParams): Promise<ApiResult> {
  const parsed = parseSearchFilterAndOptions(params);
  if (parsed.invalidFields) {
    return { status: 400, body: { error: "Parâmetros de consulta inválidos.", fields: parsed.invalidFields } };
  }

  try {
    const page = await getPersistedPredictions(parsed.query);
    return { status: 200, body: page };
  } catch (error) {
    return mapErrorToResult(error);
  }
}

/** GET /api/predictions/[id] — somente leitura. */
export async function handleGetPredictionById(id: string): Promise<ApiResult> {
  if (!id) return { status: 400, body: { error: "id não pode ser vazio." } };

  try {
    const detail = await getPersistedPredictionById(id);
    if (!detail) return { status: 404, body: { error: "Previsão não encontrada." } };
    return { status: 200, body: detail };
  } catch (error) {
    return mapErrorToResult(error);
  }
}

/** GET /api/predictions/match/[matchId] — somente leitura, histórico
 * paginado. Paginação/ordenação nunca recalculadas aqui — repassadas
 * integralmente ao Query Service. */
export async function handleGetPredictionHistoryByMatch(matchId: string, params: URLSearchParams): Promise<ApiResult> {
  if (!matchId) return { status: 400, body: { error: "matchId não pode ser vazio." } };

  const parsed = parseSearchFilterAndOptions(params);
  if (parsed.invalidFields) {
    return { status: 400, body: { error: "Parâmetros de consulta inválidos.", fields: parsed.invalidFields } };
  }

  try {
    // O `matchId` do caminho da URL sempre prevalece — mesmo que
    // `parsed.query` contenha `matchId`/`playerId` (parâmetros de busca
    // redundantes), `getByMatch` os sobrescreve internamente ao montar o
    // filtro (`{...options, matchId}`), nunca duplicando a lógica aqui.
    const page = await getPredictionHistoryByMatch(matchId, parsed.query);
    return { status: 200, body: page };
  } catch (error) {
    return mapErrorToResult(error);
  }
}

/** GET /api/predictions/match/[matchId]/latest — somente leitura. */
export async function handleGetLatestPredictionByMatch(matchId: string): Promise<ApiResult> {
  if (!matchId) return { status: 400, body: { error: "matchId não pode ser vazio." } };

  try {
    const detail = await getLatestPredictionByMatch(matchId);
    if (!detail) return { status: 404, body: { error: "Nenhuma previsão encontrada para esta partida." } };
    return { status: 200, body: detail };
  } catch (error) {
    return mapErrorToResult(error);
  }
}

/** Valida o corpo mínimo para `POST /api/predictions` — apenas formato
 * de transporte (presença/tipo), nunca matemática do Prediction Engine. */
function validateGenerateBody(body: Record<string, unknown>): string[] {
  const invalidFields: string[] = [];
  if (typeof body.matchId !== "string" || body.matchId.length === 0) invalidFields.push("matchId");
  if (typeof body.homePlayerId !== "string" || body.homePlayerId.length === 0) invalidFields.push("homePlayerId");
  if (typeof body.awayPlayerId !== "string" || body.awayPlayerId.length === 0) invalidFields.push("awayPlayerId");
  if (typeof body.homeRating !== "number" || !Number.isFinite(body.homeRating)) invalidFields.push("homeRating");
  if (typeof body.awayRating !== "number" || !Number.isFinite(body.awayRating)) invalidFields.push("awayRating");
  return invalidFields;
}

/**
 * POST /api/predictions — geração + persistência explícita. Fluxo:
 * rejeita campos internos proibidos -> valida formato -> executa o caso
 * de uso oficial (`generateAndPersistPredictionCenterData`, que chama o
 * Prediction Engine e persiste exatamente uma vez) -> devolve o
 * resultado. Falha de persistência (ou do motor) NUNCA é engolida —
 * propaga como erro HTTP (a persistência faz parte do sucesso desta
 * operação explícita, nunca a Política B usada na exibição).
 */
export async function handleGeneratePrediction(rawBody: unknown): Promise<ApiResult> {
  if (!rawBody || typeof rawBody !== "object") {
    return { status: 400, body: { error: "Corpo da requisição inválido." } };
  }
  const body = rawBody as Record<string, unknown>;

  const forbiddenPresent = FORBIDDEN_GENERATE_FIELDS.filter((field) => field in body);
  if (forbiddenPresent.length > 0) {
    return { status: 400, body: { error: "Campos não permitidos no corpo da requisição.", fields: forbiddenPresent } };
  }

  const invalidFields = validateGenerateBody(body);
  if (invalidFields.length > 0) {
    return { status: 400, body: { error: "Dados inválidos para gerar a previsão.", fields: invalidFields } };
  }

  const input: GeneratePredictionInput = {
    matchId: body.matchId as string,
    homePlayerId: body.homePlayerId as string,
    awayPlayerId: body.awayPlayerId as string,
    homeRating: body.homeRating as number,
    awayRating: body.awayRating as number,
    virtualTeamHome: typeof body.virtualTeamHome === "string" ? body.virtualTeamHome : null,
    virtualTeamAway: typeof body.virtualTeamAway === "string" ? body.virtualTeamAway : null,
    league: typeof body.league === "string" ? body.league : null,
    period: typeof body.period === "string" ? body.period : null,
    sequenceKey: typeof body.sequenceKey === "string" || typeof body.sequenceKey === "number" ? body.sequenceKey : null,
  };

  try {
    const result = await generateAndPersistPredictionCenterData(input);
    return { status: 200, body: result };
  } catch (error) {
    return mapErrorToResult(error);
  }
}
