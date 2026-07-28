// Sprint 8.0 — Prediction Center Integration.
// Composition root: único lugar autorizado a conhecer a implementação
// concreta do Repository. `predictionCenterService.ts` (e qualquer outro
// consumidor do Prediction Center) nunca importa
// `InMemoryPredictionRepository`/`PrismaPredictionRepository`/
// `PrismaClient`/`lib/prisma` diretamente — apenas os Application
// Services já compostos aqui.
//
// Sprint 8.3 — Production Persistence: seleção explícita por ambiente,
// nunca por acaso e nunca com fallback silencioso.
//
//   Development -> InMemoryPredictionRepository (sempre — dev não deve
//   depender de um Postgres rodando localmente).
//   Test        -> InMemoryPredictionRepository (mesma razão: a suíte
//   de testes que passa por este composition root — ex.:
//   `predictionCenterService.test.mjs`/`predictionApiHandlers.test.mjs`
//   — permanece rápida e determinística; a prova real contra Postgres
//   vive em `tests/predictionPersistenceIntegration.test.mjs`, que
//   constrói `PrismaPredictionRepository` diretamente, sem passar por
//   este composition root).
//   Production  -> PrismaPredictionRepository, OBRIGATÓRIO. Se
//   `DATABASE_URL` estiver ausente, `createRepository()` lança
//   imediatamente (nunca cai para `InMemoryPredictionRepository`) — um
//   ambiente de produção sem banco configurado deve falhar alto e claro
//   no startup, nunca perder dados silenciosamente em memória.
//
// Cache em `globalThis` — mesmo padrão já usado por `src/lib/prisma.ts`
// — essencial aqui: sem isso, cada chamada criaria um Repository novo
// (para `InMemoryPredictionRepository`, vazio a cada vez), destruindo
// qualquer persistência entre requisições/re-renders.

// Import relativo (não `@/`) — mesma justificativa já documentada em
// `predictionCenterFormatters.ts`.
import { InMemoryPredictionRepository } from "../repositories/prediction/InMemoryPredictionRepository.ts";
import { PrismaPredictionRepository } from "../repositories/prediction/PrismaPredictionRepository.ts";
import type { PredictionRepository } from "../repositories/prediction/PredictionRepository.ts";
import { PredictionPersistenceService } from "./prediction-persistence/PredictionPersistenceService.ts";
import { PredictionQueryService } from "./prediction-query/PredictionQueryService.ts";

/**
 * Versão do FORMATO do `PredictionSnapshot` persistido (Sprint 7.2) —
 * nunca a versão do algoritmo (`modelVersion`) nem o hash de
 * configuração (`configurationHash`). `"1.0"` é a primeira versão
 * conhecida deste formato, fixada uma única vez aqui — nunca recalculada,
 * nunca inventada por chamada.
 */
export const PREDICTION_SNAPSHOT_SCHEMA_VERSION = "1.0";

export type PredictionCenterApplication = {
  persistenceService: PredictionPersistenceService;
  queryService: PredictionQueryService;
};

/**
 * Falha alto e claro — nunca capturada e revertida para
 * `InMemoryPredictionRepository`. Um ambiente de produção sem
 * `DATABASE_URL` é um erro de configuração, não uma condição
 * recuperável em memória.
 */
class PredictionCenterMisconfiguredError extends Error {
  constructor() {
    super(
      "PredictionCenterComposition: DATABASE_URL ausente em produção. " +
        "PrismaPredictionRepository é obrigatório em NODE_ENV=production e nunca " +
        "cai silenciosamente para InMemoryPredictionRepository — configure " +
        "DATABASE_URL antes de iniciar a aplicação.",
    );
    this.name = "PredictionCenterMisconfiguredError";
  }
}

function createRepository(): PredictionRepository {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.DATABASE_URL) throw new PredictionCenterMisconfiguredError();
    return new PrismaPredictionRepository();
  }

  // development/test: sempre InMemoryPredictionRepository — decisão
  // explícita (ver comentário no topo do arquivo), nunca por acaso.
  return new InMemoryPredictionRepository();
}

/**
 * Envolve `createRepository()` em resolução preguiçosa (só na primeira
 * chamada real de `health()`/`save()`/`getById()`/`search()`) — nunca no
 * import do módulo. Necessário porque o Next.js executa "Collecting page
 * data" no build (`next build`, que roda com `NODE_ENV=production`)
 * importando os módulos das rotas sem nunca de fato invocá-las; se
 * `createRepository()` lançasse no topo do módulo, um build sem
 * `DATABASE_URL` disponível quebraria o BUILD inteiro, não apenas a
 * primeira requisição real. Com resolução preguiçosa, o build sempre
 * importa com segurança, e o erro de configuração só aparece — alto e
 * claro — na primeira requisição real que de fato tentar ler/escrever
 * uma previsão em produção sem banco configurado.
 */
function createLazyRepository(): PredictionRepository {
  let resolved: PredictionRepository | undefined;
  function resolve(): PredictionRepository {
    if (!resolved) resolved = createRepository();
    return resolved;
  }

  return {
    health: () => resolve().health(),
    save: (draft) => resolve().save(draft),
    getById: (id) => resolve().getById(id),
    search: (filter, options) => resolve().search(filter, options),
  };
}

function buildApplication(): PredictionCenterApplication {
  const repository = createLazyRepository();
  return {
    persistenceService: new PredictionPersistenceService(repository),
    queryService: new PredictionQueryService(repository),
  };
}

const globalForPredictionCenter = globalThis as unknown as { predictionCenterApplication?: PredictionCenterApplication };

export const predictionCenterApplication: PredictionCenterApplication = globalForPredictionCenter.predictionCenterApplication ?? buildApplication();

if (process.env.NODE_ENV !== "production") globalForPredictionCenter.predictionCenterApplication = predictionCenterApplication;
