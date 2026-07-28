// Sprint 8.2 — Prediction Dashboard and Timeline.
// Fronteira HTTP exclusiva da UI de histórico de previsões. Consome
// somente os 4 endpoints públicos GET de `/api/predictions*` (Sprint
// 8.1) — nunca importa `PredictionQueryService`, `PredictionRepository`,
// `PredictionPersistenceService`, Prisma, `lib/prisma` ou o composition
// root do Prediction Center. Nunca chama `POST /api/predictions` (a
// geração é exclusiva de uma ação explícita, fora do escopo desta
// sprint de leitura/apresentação).
//
// Import relativo (não `@/`) — precisa ser testável via `node --test`
// puro (sem bundler, sem resolução do alias `@/`), mesma justificativa
// já documentada em `predictionCenterFormatters.ts`. Componentes client
// continuam importando via `@/lib/predictionApiClient` normalmente.
import type { PredictionDetail, PredictionQueryInput, PredictionQueryPage, PredictionSummary } from "../services/prediction-query/predictionQueryTypes.ts";
import type { PredictionRecordSource } from "../repositories/prediction/PredictionRepository.ts";

// Reexportados para que os componentes da UI importem contratos e
// funções de um único ponto (`@/lib/predictionApiClient`) — nunca
// alcançando `src/services/prediction-query/*`/`src/repositories/*`
// diretamente. Nenhum tipo é redefinido: apenas repassado.
export type { PredictionSummary, PredictionDetail, PredictionQueryInput, PredictionQueryPage, PredictionRecordSource };

/** Erro estável de transporte — `message`/`fields` já vêm da resposta
 * JSON de erro da API (nunca stack, causa ou detalhe de infraestrutura;
 * a própria API já garante isso, esta camada apenas repassa). */
export class PredictionApiError extends Error {
  readonly status: number;
  readonly fields?: string[];

  constructor(status: number, message: string, fields?: string[]) {
    super(message);
    this.name = "PredictionApiError";
    this.status = status;
    this.fields = fields;
  }
}

function buildSearchParams(query: PredictionQueryInput = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (query.matchId !== undefined) params.set("matchId", query.matchId);
  if (query.playerId !== undefined) params.set("playerId", query.playerId);
  if (query.league !== undefined) params.set("league", query.league);
  if (query.period !== undefined) params.set("period", query.period);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.orderBy !== undefined) params.set("orderBy", query.orderBy);
  if (query.orderDirection !== undefined) params.set("orderDirection", query.orderDirection);
  return params;
}

function withQuery(path: string, params: URLSearchParams): string {
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function requestJson(url: string, signal?: AbortSignal): Promise<{ status: number; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", signal, headers: { Accept: "application/json" } });
  } catch (error) {
    // Abort intencional (troca de filtro/desmontagem) nunca é um erro de
    // aplicação — propaga como está para o chamador ignorar.
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PredictionApiError(0, "Falha de rede ao consultar previsões.");
  }

  try {
    return { status: response.status, body: await response.json() };
  } catch {
    throw new PredictionApiError(response.status, "Resposta inválida do servidor.");
  }
}

function throwIfError(status: number, body: unknown): void {
  if (status >= 200 && status < 300) return;
  const payload = body as { error?: string; fields?: string[] } | null;
  const message = payload && typeof payload.error === "string" ? payload.error : "Erro inesperado ao consultar previsões.";
  const fields = payload && Array.isArray(payload.fields) ? payload.fields : undefined;
  throw new PredictionApiError(status, message, fields);
}

/** `GET /api/predictions` — listagem paginada. */
export async function listPredictions(query: PredictionQueryInput = {}, signal?: AbortSignal): Promise<PredictionQueryPage> {
  const url = withQuery("/api/predictions", buildSearchParams(query));
  const { status, body } = await requestJson(url, signal);
  throwIfError(status, body);
  return body as PredictionQueryPage;
}

/** `GET /api/predictions/[id]` — detalhe sob demanda. `null` para 404
 * (registro inexistente nunca é tratado como erro de transporte). */
export async function getPredictionById(id: string, signal?: AbortSignal): Promise<PredictionDetail | null> {
  const { status, body } = await requestJson(`/api/predictions/${encodeURIComponent(id)}`, signal);
  if (status === 404) return null;
  throwIfError(status, body);
  return body as PredictionDetail;
}

/** `GET /api/predictions/match/[matchId]` — histórico paginado de uma
 * partida. */
export async function getPredictionHistoryByMatch(
  matchId: string,
  query: Omit<PredictionQueryInput, "matchId" | "playerId"> = {},
  signal?: AbortSignal,
): Promise<PredictionQueryPage> {
  const url = withQuery(`/api/predictions/match/${encodeURIComponent(matchId)}`, buildSearchParams(query));
  const { status, body } = await requestJson(url, signal);
  throwIfError(status, body);
  return body as PredictionQueryPage;
}

/** `GET /api/predictions/match/[matchId]/latest` — usada somente quando
 * a Timeline completa ainda não foi carregada (a UI prefere o primeiro
 * item da Timeline, já ordenado por `generatedAt desc`, evitando uma
 * segunda chamada redundante). */
export async function getLatestPredictionByMatch(matchId: string, signal?: AbortSignal): Promise<PredictionDetail | null> {
  const { status, body } = await requestJson(`/api/predictions/match/${encodeURIComponent(matchId)}/latest`, signal);
  if (status === 404) return null;
  throwIfError(status, body);
  return body as PredictionDetail;
}
