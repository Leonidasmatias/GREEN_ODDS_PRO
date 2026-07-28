// Sprint 6.5 — Prediction Center (Sprint 8.1: leitura e escrita separadas).
// Camada única de obtenção/geração de dados para o Prediction Center.
// Consome exclusivamente `PredictionSnapshot[]` e o Adapter público
// (Sprint 6.5), mais os Application Services de consulta/persistência
// (Sprint 7.4/7.5) através do composition root (Sprint 8.0). Nenhuma
// lógica de predição, orquestração, avaliação ou apresentação é
// recalculada aqui — apenas valida a presença dos campos essenciais de
// cada snapshot antes de repassá-lo ao Adapter, e consolida o status do
// lote.
//
// Sprint 8.1 — mudança de comportamento documentada: `getPredictionCenterData`
// DEIXOU de persistir automaticamente (fazia isso desde a Sprint 8.0).
// Motivo: uma operação de LEITURA (usada pela página, prefetch, e agora
// também por rotas GET) nunca pode ter efeito colateral de escrita —
// princípio explícito desta sprint. A geração+persistência explícita
// agora vive em `generateAndPersistPredictionCenterData`, usada
// exclusivamente pelo POST. O comportamento VISUAL da página é 100%
// preservado — `page.tsx` nunca leu o campo `persistence` que existia
// no resultado, então esta mudança é invisível para o usuário final.

// Imports relativos (não `@/`) — este serviço precisa ser executável
// também por `node --test` (sem bundler), mesma justificativa documentada
// em `predictionCenterFormatters.ts`. `predictionCenterApplication` é o
// ÚNICO ponto de acesso aos Application Services de persistência/consulta
// (Sprint 7.5/7.4) — este arquivo nunca importa `PredictionRepository`,
// `InMemoryPredictionRepository`/`PrismaPredictionRepository`, Prisma ou
// `lib/prisma` diretamente; a implementação concreta é responsabilidade
// exclusiva do composition root (Sprint 8.0).
import { PREDICTION_CENTER_FIXTURE } from "../data/predictionCenter.fixture.ts";
import { buildPredictionCenterViewModel } from "../adapters/predictionCenterAdapter.ts";
import { rollupItemsStatus } from "../lib/predictionMarketUtils.ts";
import type { PredictionCenterDataResult, PredictionCenterViewModel, PredictionSnapshot } from "../lib/predictionCenterTypes.ts";
import { PREDICTION_SNAPSHOT_SCHEMA_VERSION, predictionCenterApplication } from "./predictionCenterComposition.ts";
import type { PredictionDetail, PredictionQueryInput, PredictionQueryPage } from "./prediction-query/predictionQueryTypes.ts";
import type { PredictionPersistenceResult } from "./prediction-persistence/predictionPersistenceTypes.ts";
import { predictMatch } from "./prediction-orchestrator/index.ts";
import type { PredictionOrchestratorRequest } from "./prediction-orchestrator/index.ts";

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
 * SOMENTE LEITURA (Sprint 8.1) — nunca persiste, nunca chama
 * `PredictionPersistenceService`. Seguro para GET, prefetch e
 * renderização de página.
 *
 * `snapshotsOverride` existe exclusivamente para permitir que os testes
 * exercitem de verdade os ramos `empty`/`error`/`catch`/mistura de itens
 * válidos e inválidos desta própria função — nenhum chamador de produção
 * passa este argumento.
 */
export async function getPredictionCenterData(
  snapshotsOverride?: readonly PredictionSnapshot[],
): Promise<PredictionCenterDataResult> {
  const source = "fixture" as const;

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

/**
 * Consulta previsões já persistidas — delega inteiramente ao
 * `PredictionQueryService` (Sprint 7.4), nunca ao Repository/Prisma
 * diretamente.
 */
export async function getPersistedPredictions(query?: PredictionQueryInput): Promise<PredictionQueryPage> {
  return predictionCenterApplication.queryService.search(query);
}

/** Histórico de previsões de UMA partida — delega a `getByMatch`. */
export async function getPredictionHistoryByMatch(matchId: string, options?: Omit<PredictionQueryInput, "matchId" | "playerId">): Promise<PredictionQueryPage> {
  return predictionCenterApplication.queryService.getByMatch(matchId, options);
}

/** Previsão mais recente (por `generatedAt`, nunca por `id`) de UMA
 * partida — delega a `getLatestByMatch`. */
export async function getLatestPredictionByMatch(matchId: string): Promise<PredictionDetail | null> {
  return predictionCenterApplication.queryService.getLatestByMatch(matchId);
}

/** Detalhe de UMA previsão persistida por `id` — delega a `getById`. */
export async function getPersistedPredictionById(id: string): Promise<PredictionDetail | null> {
  return predictionCenterApplication.queryService.getById(id);
}

/**
 * Entrada mínima e segura para gerar uma previsão — nunca um
 * `PredictionSnapshot`/hash/payload pronto. Mesma técnica de jogador
 * mínimo já usada e aprovada por `predictionCenter.fixture.ts`
 * (`rating`+`matchesCount`, demais campos `null`) — não existe hoje
 * nenhuma entrada pública confiável que resolva um `matchId`/jogador
 * real em todos os inputs do Intelligence Engine (isso pertenceria a uma
 * orquestração inteiramente fora do escopo desta sprint). Por isso
 * `source` do resultado é sempre `"fixture"`, nunca `"real"`.
 */
export type GeneratePredictionInput = {
  matchId: string;
  homePlayerId: string;
  awayPlayerId: string;
  homeRating: number;
  awayRating: number;
  virtualTeamHome?: string | null;
  virtualTeamAway?: string | null;
  league?: string | null;
  period?: string | null;
  sequenceKey?: string | number | null;
};

type GeneratePredictionPlayerInputs = PredictionOrchestratorRequest["homePlayer"];

function minimalPlayerInputs(id: string, rating: number): GeneratePredictionPlayerInputs {
  return {
    playerId: id,
    matchesCount: 24,
    rating: { playerId: id, rating, matchesCount: 24 },
    form: null,
    homeAway: null,
    momentum: null,
    strength: null,
    confidence: null,
    greenScore: null,
    goalsRates: null,
  };
}

/**
 * Caso de uso oficial de GERAÇÃO + PERSISTÊNCIA (Sprint 8.1) — usado
 * exclusivamente pelo POST. Chama o Prediction Orchestrator de verdade
 * (`predictMatch`, com `now` real — esta é uma geração ao vivo, não uma
 * fixture determinística de teste), monta o `PredictionSnapshot` e
 * delega a persistência inteira a `PredictionPersistenceService`.
 * `modelVersion`/`configurationHash` vêm diretamente do resultado real
 * do motor; `schemaVersion` vem da constante única do composition root.
 * Falha do motor (nunca alcançável aqui, pois `predictMatch` não lança
 * para entradas válidas) ou falha de persistência propagam como
 * exceção — para uma operação explicitamente chamada para "gerar e
 * salvar", a persistência faz parte do sucesso (nunca a Política B da
 * Sprint 8.0, que era exclusiva da exibição).
 */
export async function generateAndPersistPredictionCenterData(input: GeneratePredictionInput): Promise<PredictionPersistenceResult> {
  const homePlayer = minimalPlayerInputs(input.homePlayerId, input.homeRating);
  const awayPlayer = minimalPlayerInputs(input.awayPlayerId, input.awayRating);
  const result = predictMatch({ homePlayer, awayPlayer, headToHead: null });

  const snapshot: PredictionSnapshot = {
    matchId: input.matchId,
    homePlayerId: input.homePlayerId,
    awayPlayerId: input.awayPlayerId,
    virtualTeamHome: input.virtualTeamHome ?? null,
    virtualTeamAway: input.virtualTeamAway ?? null,
    league: input.league ?? null,
    period: input.period ?? null,
    sequenceKey: input.sequenceKey ?? null,
    result,
  };

  return predictionCenterApplication.persistenceService.persist({
    snapshot,
    schemaVersion: PREDICTION_SNAPSHOT_SCHEMA_VERSION,
    modelVersion: result.metadata.orchestratorModelVersion,
    configurationHash: result.metadata.configurationHash,
    source: "fixture",
  });
}
