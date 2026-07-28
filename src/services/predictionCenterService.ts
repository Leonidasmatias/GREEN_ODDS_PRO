// Sprint 6.5 — Prediction Center.
// Camada única de obtenção de dados para o Prediction Center. Consome
// exclusivamente `PredictionSnapshot[]` (hoje, a fixture de demonstração
// — nenhuma fonte real de `PredictionSnapshot` existe ainda, confirmado
// por auditoria arquitetural) e o Adapter público (Incremento 3). Nenhuma
// lógica de predição, orquestração, avaliação ou apresentação é
// recalculada aqui — apenas valida a presença dos campos essenciais de
// cada snapshot antes de repassá-lo ao Adapter, e consolida o status do
// lote.

// Imports relativos (não `@/`) — este serviço precisa ser executável
// também por `node --test` (sem bundler), mesma justificativa documentada
// em `predictionCenterFormatters.ts`.
import { PREDICTION_CENTER_FIXTURE } from "../data/predictionCenter.fixture.ts";
import { buildPredictionCenterViewModel } from "../adapters/predictionCenterAdapter.ts";
import { rollupItemsStatus } from "../lib/predictionMarketUtils.ts";
import type { PredictionCenterDataResult, PredictionCenterSourceKind, PredictionCenterViewModel, PredictionSnapshot } from "../lib/predictionCenterTypes.ts";

const GENERIC_ERROR_MESSAGE = "Não foi possível carregar as previsões do Prediction Center.";

/**
 * Confirma a presença dos campos essenciais de UM item sem validar
 * regras de negócio, matemática de probabilidade ou reconstruir o
 * contrato completo do motor (isso é responsabilidade exclusiva do
 * Prediction Orchestrator) — apenas garante que o item não vai quebrar o
 * Adapter por estrutura ausente. `value` é tratado como `unknown`
 * deliberadamente: mesmo com `PredictionSnapshot[]` já tipado no
 * parâmetro público, este guard permanece a única linha de defesa em
 * tempo de execução contra um item malformado.
 */
function hasEssentialSnapshotFields(value: unknown): value is PredictionSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;

  if (typeof snapshot.matchId !== "string" || snapshot.matchId.length === 0) return false;
  if (typeof snapshot.homePlayerId !== "string" || snapshot.homePlayerId.length === 0) return false;
  if (typeof snapshot.awayPlayerId !== "string" || snapshot.awayPlayerId.length === 0) return false;
  if (!snapshot.result || typeof snapshot.result !== "object") return false;

  const result = snapshot.result as Record<string, unknown>;
  if (!result.prediction || typeof result.prediction !== "object") return false;
  if (!result.goalDistribution || typeof result.goalDistribution !== "object") return false;
  if (!result.quality || typeof result.quality !== "object") return false;
  if (!result.explanation || typeof result.explanation !== "object") return false;
  if (!result.metadata || typeof result.metadata !== "object") return false;

  return true;
}

/**
 * Obtém o lote de `PredictionSnapshot` disponível hoje (fixture de
 * demonstração) e devolve um `PredictionCenterDataResult` tipado, sempre
 * indicando que a fonte é demonstrativa (nenhuma fonte real existe
 * ainda — `source` permanece `"fixture"` inclusive quando
 * `snapshotsOverride` é usado pelos testes, nunca `"real"`, mesmo padrão
 * de `getIntelligenceDashboardData` na Sprint 6.0). Nunca lança exceção —
 * qualquer falha (estrutural ou inesperada) vira `status: "error"` com
 * mensagem genérica estável (o erro técnico detalhado nunca é exposto).
 *
 * `snapshotsOverride` existe exclusivamente para permitir que os testes
 * exercitem de verdade os ramos `empty`/`error`/`catch`/mistura de itens
 * válidos e inválidos desta própria função — nenhum chamador de produção
 * passa este argumento.
 */
export async function getPredictionCenterData(
  snapshotsOverride?: readonly PredictionSnapshot[],
): Promise<PredictionCenterDataResult> {
  const source: PredictionCenterSourceKind = "fixture";

  try {
    const snapshots = snapshotsOverride ?? PREDICTION_CENTER_FIXTURE;

    if (snapshots.length === 0) {
      return { status: "empty", source };
    }

    const validSnapshots = snapshots.filter(hasEssentialSnapshotFields);
    const droppedCount = snapshots.length - validSnapshots.length;

    if (validSnapshots.length === 0) {
      return { status: "error", message: GENERIC_ERROR_MESSAGE };
    }

    const items: PredictionCenterViewModel[] = validSnapshots.map((snapshot) => buildPredictionCenterViewModel(snapshot));

    // Uma mistura de itens válidos/inválidos nunca é reportada como
    // "success" limpo, mesmo que todo item processado esteja individualmente
    // limpo — a presença de item(ns) descartado(s) já é, por si, um sinal
    // de degradação do lote (regra 4 desta missão).
    const status = droppedCount > 0 ? "partial" : rollupItemsStatus(items);

    return { status, source, items };
  } catch {
    return { status: "error", message: GENERIC_ERROR_MESSAGE };
  }
}
