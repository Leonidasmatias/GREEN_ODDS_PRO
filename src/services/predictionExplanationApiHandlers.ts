// Sprint 9.0 — Prediction Intelligence Framework, Etapa 6.
// Núcleo puro e testável da rota `GET /api/predictions/[id]/explanation`
// — mesmo padrão de `predictionApiHandlers.ts` (Sprint 8.1): nunca importa
// `next/server`, autenticação/autorização permanecem exclusivamente no
// `route.ts`. Reutiliza `getPersistedPredictionById` (nunca acessa
// Repository/Prisma diretamente) e `mapErrorToResult` já existente —
// nunca duplica o mapeamento de erro. Endpoint somente leitura: nunca
// persiste, nunca recalcula a previsão (o motor de explicação, Sprint
// 9.0, só reempacota o que já está no snapshot persistido).

// Imports relativos (não `@/`) — mesma justificativa documentada em
// `predictionApiHandlers.ts`.
import { getPersistedPredictionById } from "./predictionCenterService.ts";
import { mapErrorToResult, type ApiResult } from "./predictionApiHandlers.ts";
import { buildPredictionExplanation } from "./prediction-explanation/index.ts";

/**
 * `now` (ISO 8601) tem default para o momento real da requisição — a
 * rota nunca precisa fornecer, mas testes podem injetar um valor fixo
 * para determinismo (mesma convenção usada pelos motores internos do
 * Prediction Orchestrator).
 */
export async function handleGetPredictionExplanation(id: string, now: string = new Date().toISOString()): Promise<ApiResult> {
  if (!id) return { status: 400, body: { error: "id não pode ser vazio." } };

  try {
    const detail = await getPersistedPredictionById(id);
    if (!detail) return { status: 404, body: { error: "Previsão não encontrada." } };

    const explanation = buildPredictionExplanation(detail.snapshot, now);
    return { status: 200, body: explanation };
  } catch (error) {
    return mapErrorToResult(error);
  }
}
