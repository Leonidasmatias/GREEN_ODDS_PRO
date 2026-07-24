# Fase 3.5 — Observabilidade e Validação em Produção

## 1. Objetivo

Construir uma camada de observabilidade que meça, de forma passiva e opcional, a
qualidade dos dados e a saúde operacional da integração real com a BetsAPI
(Fase 3), sem alterar uma única linha das Fases 1, 1.5, 2 ou 3. O objetivo é
responder, com evidência quantitativa, perguntas como "os dados recebidos estão
completos?", "a classificação eSoccer está confiável?", "a integração está
estável o suficiente para observar com mais confiança?" — nunca "essa partida é
uma boa aposta?".

## 2. Escopo e Não-Escopo

Esta fase **constrói**: métricas de qualidade de dados, métricas operacionais
de provider, um motor de alertas, um avaliador de prontidão para produção, e
relatórios consolidados.

Esta fase **NÃO constrói**: nenhuma recomendação de aposta, edge, valor
esperado (EV) ou Kelly Criterion; nenhum modelo de Machine Learning; nenhum
dashboard visual (reservado para uma hipotética Fase 3.6); nenhuma alteração de
schema Prisma ou migration nova; nenhuma alteração do Intelligence Engine, UI,
autenticação ou pagamentos; nenhuma dependência nova.

## 3. Arquitetura Geral

```
BetsApiSyncService (Fase 3, inalterado)
        │  (chamado por fora, nunca modificado)
        ▼
SyncRunTracker  ──────────────►  ObservabilityRepository (contrato)
        │                              │
        ▼                              ├── InMemoryObservabilityRepository (padrão)
DataQualityEngine                       └── PrismaObservabilityRepository (adapter, indisponível nesta fase)
        │
        ▼
AlertRuleEngine ──► ProductionReadinessEvaluator ──► ObservabilityReportBuilder
```

Todo o código novo vive em `src/services/observability/` (16 módulos + índice)
e `src/repositories/observability/` (3 arquivos). Nenhum módulo desta camada
importa Prisma diretamente (exceto o adapter opcional, de forma duck-typed) e
nenhum importa o Intelligence Engine.

## 4. Módulos de `src/services/observability/`

| Módulo | Responsabilidade |
|---|---|
| `types.ts` | Tipos centrais compartilhados |
| `ObservabilityConfig.ts` | 18 variáveis de ambiente, todas com default seguro |
| `ObservabilityRedaction.ts` | Sanitização, reaproveitando `BetsApiRedaction` |
| `SyncRunTracker.ts` | Instrumenta o `BetsApiSyncService` por composição |
| `DataCompletenessAnalyzer.ts` | Completude por campo crítico/importante |
| `DataConsistencyAnalyzer.ts` | 6 verificações estruturais nomeadas |
| `DataQualityEngine.ts` | Combina os 6 sub-scores obrigatórios em `overallScore` (0..100) |
| `ClassificationMetrics.ts` | Agrega resultados do `EsoccerClassifier` |
| `FreshnessScore.ts` | FreshnessScore (0..100) a partir da última sync bem-sucedida |
| `DuplicateMetrics.ts` | Lê a saída da `DeduplicationService` (Fase 2) |
| `ProviderMetrics.ts` | Métricas operacionais por provider + `ProviderReliabilityScore` |
| `RateLimitMetrics.ts` | Agrega estados reais de rate limit (Fase 3) |
| `LatencyMetrics.ts` | Percentis p50/p95/p99 sem biblioteca externa |
| `FixtureComparisonService.ts` | Comparação estrutural live vs. fixture |
| `AlertRuleEngine.ts` | 16 tipos de alerta nomeados |
| `ProductionReadinessEvaluator.ts` | Veredito de prontidão operacional |
| `ObservabilityReportBuilder.ts` | Relatório final em 17 partes, 3 formatos |
| `ObservabilityService.ts` | Fachada única que orquestra tudo acima |
| `index.ts` | Barrel export |

## 5. Repositórios (`src/repositories/observability/`)

`ObservabilityRepository` é o contrato único de persistência. Nenhum módulo de
`services/observability/` acessa armazenamento diretamente — sempre através
desta interface.

`InMemoryObservabilityRepository` é a implementação **padrão e obrigatória**:
guarda tudo em memória do processo, sem sobreviver a um reinício.

`PrismaObservabilityRepository` é um **adapter opcional**. Como esta fase não
adiciona nenhum modelo novo ao `prisma/schema.prisma` (proibido pela missão),
esta classe funciona hoje sempre em modo `unavailable`: qualquer leitura ou
escrita lança `ObservabilityStorageUnavailableError` de forma estruturada, e
`health()` reporta o motivo. Ela existe pronta para uma fase futura que
introduza o schema real.

## 6. Modelos de Dados

`SyncRun`: snapshot de uma execução do `BetsApiSyncService` (id, provider,
mode, timestamps, status, contadores de eventos/importados/duplicados/
rejeitados, erros sanitizados, rate limit remanescente).

`DataQualitySnapshot`: `sampleSize`, os 6 sub-scores obrigatórios
(`completenessScore`, `consistencyScore`, `classificationScore`,
`duplicationScore`, `freshnessScore`, `providerReliabilityScore` — todos
0..100), `overallScore` (0..100), `fieldMetrics`, `leagueMetrics`,
`inconsistencies`.

`FieldQualityMetric` / `LeagueQualityMetric`: granularidade por campo e por
liga.

`ProviderOperationalMetric`: janela de tempo, contadores de requisições
bem-sucedidas/**parciais**/falhas/retry/fallback/rate-limit (desde a
correção, sucesso/parcial/falha são 3 contadores distintos — antes, parcial
era contado junto de sucesso), último erro sanitizado.

## 7. SyncRunTracker e Composição com BetsApiSyncService

`SyncRunTracker` **não modifica** `BetsApiSyncService.ts`. Em vez de adicionar
um parâmetro novo em `BetsApiSyncServiceOptions`, ele envolve a chamada por
fora: `tracker.track(syncService, mode, params)` chama `syncService.run(...)`,
cronometra, converte o `BetsApiSyncReport` resultante em um `SyncRun` e
persiste via `ObservabilityRepository`. Se `run()` lançar, um `SyncRun` com
status `failed` e mensagem sanitizada é salvo antes do erro original ser
relançado. Este é o mesmo padrão de composição já usado por
`LiveBetsApiProvider` e `BetsApiHealthCheck` na Fase 3 — nenhum teste
existente da Fase 3 é afetado porque o arquivo nunca é tocado.

## 8. DataQualityEngine e a Fórmula Ponderada (PROVISÓRIA) — CORRIGIDA

> **Correção pós-auditoria**: a versão original desta fase usava apenas 4
> sub-scores em escala 0..1. Uma auditoria posterior identificou que
> `freshnessScore` e `providerReliabilityScore` estavam ausentes e não
> documentados como uma decisão deliberada — o que era uma divergência real
> da missão, não uma escolha de escopo. Esta seção descreve a fórmula
> corrigida, já implementada.

Todos os 6 sub-scores e o `overallScore` estão na escala **0..100**:

```
overallScore =
    completenessScore        * 0.25   (weights.completeness)
  + consistencyScore         * 0.20   (weights.consistency)
  + classificationScore      * 0.20   (weights.classification)
  + duplicationScore         * 0.15   (weights.duplicate)
  + freshnessScore           * 0.10   (weights.freshness)
  + providerReliabilityScore * 0.10   (weights.providerReliability)
```

Os pesos somam exatamente 1, são centralizados em
`ObservabilityConfig.weights`, e são renormalizados automaticamente se a soma
configurada desviar de 1. Esta fórmula é **PROVISÓRIA** e deve ser
recalibrada após operação real, seguindo a mesma convenção já usada pelo
`EsoccerClassifier` (Fase 3) para regras heurísticas. O cálculo é 100%
determinístico: nenhuma chamada de rede, e o relógio (`now`) é sempre
injetável.

### 8.1 FreshnessScore (`FreshnessScore.ts`)

Baseado na idade da última sincronização bem-sucedida
(`SyncRun.status === "success"`, via `lastSuccessfulSyncAt`):

- sem timestamp utilizável (`null` ou não parseável) → **0**
- idade ≤ `OBSERVABILITY_STALE_DATA_MINUTES` (default 60min, "janela fresca") → **100**
- idade entre 1x e `FRESHNESS_ZERO_MULTIPLIER` (10x, constante provisória interna) vezes o limiar → decaimento **linear** de 100 a 0
- idade ≥ 10x o limiar → **0**

Exemplos concretos (com `OBSERVABILITY_STALE_DATA_MINUTES=60`):

| Idade da última sync | freshnessScore |
|---|---|
| 5 minutos | 100 |
| 60 minutos (exatamente no limiar) | 100 |
| 330 minutos (meio do caminho entre 60 e 600) | 50 |
| 600 minutos (10x o limiar) | 0 |
| 2000 minutos | 0 |
| `null` (nunca sincronizou) | 0 |
| timestamp inválido | 0 |

### 8.2 ProviderReliabilityScore (`ProviderMetrics.ts`)

Baseado em `ProviderOperationalMetric`: taxa de sucesso, falhas parciais
(contam como "meio sucesso", peso 0.5 — PROVISÓRIO), falhas totais, eventos
de rate-limit (penalidade de 20% sobre a taxa observada), retries e uso de
fallback (penalidades de 10% cada — sempre `0` nesta fase, ver Seção 13).
**Quando não há dados suficientes** (`totalRequests === 0` ou métrica nula),
devolve `PROVIDER_RELIABILITY_NEUTRAL_SCORE = 50` — um valor neutro
explícito, **nunca assumindo confiabilidade máxima** na ausência de
evidência.

Exemplos concretos:

| Cenário | providerReliabilityScore |
|---|---|
| Sem dados operacionais (metric nulo ou totalRequests=0) | 50 (neutro, documentado) |
| 10/10 janelas com sucesso total, sem rate-limit | 100 |
| 10/10 janelas com falha total | 0 |
| 10/10 janelas com falha parcial | 50 |
| 10/10 sucesso total, mas todas com rate-limit atingido | 80 (100 − 20% de penalidade) |

## 9. DataCompletenessAnalyzer

Campos **críticos** (7, entram na média do score): `externalId`, `provider`,
`league.name`, `scheduledAt`, `status`, `home.player.nickname`,
`away.player.nickname`.

Campos **importantes** (4, reportados mas fora da média): `homeScore`,
`awayScore`, `home.virtualTeam.name`, `away.virtualTeam.name`.

## 10. DataConsistencyAnalyzer

Seis verificações nomeadas: `home_equals_away_team`, `negative_score`,
`score_present_while_scheduled`, `score_missing_while_finished`,
`invalid_scheduled_at`, `missing_league_name`. O score de consistência é a
proporção de registros sem nenhuma falha.

## 11. ClassificationMetrics

Agrega os resultados do `EsoccerClassifier` (Fase 3) em contagens e um
`classificationConfidenceScore` ponderado: `confirmed_esoccer` pesa 1.0,
`probable_esoccer` pesa 0.5, `unknown`/`not_esoccer` pesam 0.

## 12. DuplicateMetrics

Lê `totalRaw`/`duplicated` já produzidos pela `IngestionPipeline`/
`DeduplicationService` (Fase 2) — não reimplementa nenhuma lógica de
deduplicação. `duplicateHealthScore = 1 - duplicateRate` (clampado em [0,1]).

## 13. ProviderMetrics — Limitação Documentada

`BetsApiClient` (Fase 3) expõe apenas o último estado por host
(`getHostMetrics`), não contadores acumulados de tentativas de retry nem de
uso do host de fallback, nem categoriza a causa de uma falha (timeout vs.
indisponibilidade) — ambas aparecem apenas como `SyncRun.status = "failed"`
com uma mensagem sanitizada. Por isso `retryCount` e `fallbackCount`
permanecem sempre `0` nesta fase — nenhum número é inventado — e o efeito de
timeouts/indisponibilidade sobre o `ProviderReliabilityScore` (Seção 8.2) é
refletido apenas indiretamente via `failedRequests`. Uma fase futura poderia
estender `BetsApiHostMetrics` (por composição) para expor esses contadores/
causas reais. Desde esta correção, `ProviderOperationalMetric` também separa
`successfulRequests`/`partialRequests`/`failedRequests` em 3 contadores
distintos (antes, `partialRequests` era contado junto de `successfulRequests`
— um erro corrigido nesta revisão).

## 14. RateLimitMetrics

Agrega uma série de `BetsApiRateLimitState` (sempre derivados de headers reais
da BetsAPI, nunca de um limite hardcoded) em contagem de observações, mínimo
`remaining` observado, quantas vezes a reserva foi atingida e quantas chamadas
foram bloqueadas.

## 15. LatencyMetrics

Percentis p50/p95/p99 e média, calculados pelo método "nearest rank" sobre a
lista ordenada — sem nenhuma biblioteca externa.

## 16. FixtureComparisonService

Compara a **estrutura** (conjunto de chaves + tipos primitivos) de
`InternalMatchDTO` vindos de eventos reais contra a mesma estrutura vinda do
`FixtureProvider` (300 partidas simuladas, Fase 2). Nunca compara valores de
identificadores literalmente. Campos nulos em um lado e não-nulos no outro não
são tratados como incompatibilidade (nulidade é esperada para campos como
placar antes do fim da partida). Nunca gera recomendação de aposta — o
resultado é puramente estrutural, usado apenas para o alerta
`FIXTURE_STRUCTURAL_DRIFT`.

## 17. AlertRuleEngine — 16 Tipos Nomeados

`LOW_COMPLETENESS`, `LOW_CONSISTENCY`, `LOW_CLASSIFICATION_CONFIDENCE`,
`HIGH_DUPLICATE_RATE`, `HIGH_ERROR_RATE`, `HIGH_LATENCY_P95`,
`RATE_LIMIT_EXHAUSTED`, `RATE_LIMIT_FREQUENT_HITS`, `SYNC_RUN_FAILED`,
`SYNC_RUN_PARTIAL`, `PROVIDER_UNAVAILABLE`, `FALLBACK_HOST_USED_FREQUENTLY`,
`FIXTURE_STRUCTURAL_DRIFT`, `LOW_SAMPLE_SIZE`, `STALE_SYNC`,
`CONFIGURATION_INVALID`. Quando `OBSERVABILITY_ALERTS_ENABLED=false` (default),
nenhum alerta é avaliado. Alertas abaixo de `OBSERVABILITY_ALERT_MIN_SEVERITY`
são descartados.

## 18. ProductionReadinessEvaluator

Quatro status: `insufficient_data` (amostra abaixo do mínimo configurado),
`not_ready` (alerta crítico ativo, configuração inválida, ou score abaixo do
piso mínimo), `ready` (score no mínimo configurado e nenhum alerta ativo),
`conditionally_ready` (demais casos). O vocabulário de `recommendedNextAction`
é fechado e nunca menciona aposta, edge, EV, Kelly ou stake:
`collect_more_data`, `investigate_active_alerts`,
`monitor_before_expanding_persistence`, `safe_to_expand_observation_window`,
`resolve_configuration_before_proceeding`.

## 19. ObservabilityReportBuilder

Relatório final em 17 partes (metadata + 16 seções de conteúdo), disponível em
3 formatos: objeto TypeScript, JSON e Markdown seguro (nunca HTML, nunca PDF).
Todo o conteúdo passa por `ObservabilityRedaction` antes de ser serializado.
Todo relatório carrega o conjunto completo e obrigatório de avisos (ver Seção
25).

## 20. ObservabilityConfig — 18 Variáveis de Ambiente (18, após a correção)

`OBSERVABILITY_ENABLED`, `OBSERVABILITY_RETENTION_DAYS`,
`OBSERVABILITY_SAMPLE_SIZE_MAX`, `OBSERVABILITY_ALERTS_ENABLED`,
`OBSERVABILITY_ALERT_MIN_SEVERITY`, `OBSERVABILITY_STORAGE_MODE`,
`OBSERVABILITY_COMPLETENESS_WEIGHT`, `OBSERVABILITY_CONSISTENCY_WEIGHT`,
`OBSERVABILITY_CLASSIFICATION_WEIGHT`, `OBSERVABILITY_DUPLICATE_WEIGHT`,
`OBSERVABILITY_FRESHNESS_WEIGHT` (novo), `OBSERVABILITY_PROVIDER_RELIABILITY_WEIGHT` (novo),
`OBSERVABILITY_READINESS_MIN_SAMPLE_SIZE`, `OBSERVABILITY_READINESS_MIN_SCORE`
(escala alterada de 0..1 para 0..100 — default mudou de `0.75` para `75`),
`OBSERVABILITY_LATENCY_P95_THRESHOLD_MS`, `OBSERVABILITY_ERROR_RATE_THRESHOLD`,
`OBSERVABILITY_DUPLICATE_RATE_THRESHOLD`,
`OBSERVABILITY_STALE_DATA_MINUTES` (novo, default 60). Todas com default
seguro (ver `.env.example`). `OBSERVABILITY_ERROR_RATE_THRESHOLD` e
`OBSERVABILITY_DUPLICATE_RATE_THRESHOLD` permanecem propositalmente na
escala 0..1: medem uma taxa bruta de eventos, não um dos 6 scores da
fórmula da Seção 8.

## 21. Política de Retenção

Default de 30 dias (`OBSERVABILITY_RETENTION_DAYS`). A remoção
(`repository.pruneOlderThan(...)` / `ObservabilityService.pruneExpiredData()`)
**nunca é chamada automaticamente na importação de nenhum módulo** — apenas
quando um chamador externo invoca explicitamente o método, testado por
`tests/observabilityRepository.test.mjs` e `tests/observabilityService.test.mjs`.

## 22. Persistência

`OBSERVABILITY_STORAGE_MODE=memory` é o default de fábrica e usa
`InMemoryObservabilityRepository` — nada sobrevive ao reinício do processo, o
que é esperado e documentado. `PrismaObservabilityRepository` existe como
adapter, mas permanece `unavailable` nesta fase (ver Seção 5).

## 23. Testes

17 arquivos em `tests/`, cobrindo cada módulo individualmente
(`observabilityConfig`, `observabilityRedaction`,
`observabilityCompletenessAndConsistency`, `observabilityDataQualityEngine`,
`observabilityClassificationMetrics`, `observabilityFreshnessScore` (novo),
`observabilityDuplicateMetrics`, `observabilityLatencyMetrics`,
`observabilityRateLimitMetrics`, `observabilityProviderMetrics` (estendido
com testes de `computeProviderReliabilityScore`), `observabilityFixtureComparison`,
`observabilityAlertRuleEngine`, `observabilityProductionReadiness`,
`observabilitySyncRunTracker`, `observabilityRepository`,
`observabilityReportBuilder`, `observabilityService`) mais
`observabilityRegression.test.mjs`, que reimporta `FixtureProvider`,
`IngestionPipeline`, `BetsApiSyncService`, `ProviderHealthService`,
`classifyEsoccerEvent` e `calculateGreenScore` (Intelligence Engine) para
provar ausência de regressão, além de verificar estruturalmente que nenhum
módulo novo importa `@prisma/client`, referencia o Intelligence Engine ou lê
`BETSAPI_TOKEN` do ambiente. Os testes reaproveitam as 300 partidas simuladas
existentes (`esoccerFixtureCatalog`) em vez de duplicar dados. Total: **431
testes** (297 pré-existentes da Fase 3 + 134 da camada de observabilidade,
incluindo a correção do DataQualityEngine), todos passando.

## 24. Limitações Conhecidas

`ProviderMetrics.retryCount`/`fallbackCount` sempre `0` nesta fase (ver Seção
13). `PrismaObservabilityRepository` sempre `unavailable` nesta fase (ver
Seção 5). Os limiares de `RATE_LIMIT_FREQUENT_HITS`,
`FALLBACK_HOST_USED_FREQUENTLY` e `STALE_SYNC` (o alerta, não o score de
frescor) usam constantes provisórias internas ao `AlertRuleEngine.ts` (não
configuráveis por variável de ambiente). `FreshnessScore.ts` usa uma segunda
constante provisória própria, `FRESHNESS_ZERO_MULTIPLIER = 10`, também não
exposta por variável de ambiente — são dois conceitos deliberadamente
independentes: o alerta `STALE_SYNC` (binário, limiar fixo de 24h) mede
"a última sincronização falhou há tempo demais", enquanto `freshnessScore`
(contínuo, curva de decaimento configurável via
`OBSERVABILITY_STALE_DATA_MINUTES`) mede "o quão recente é o dado" como
componente da fórmula de qualidade — não foram unificados nesta correção
para não alterar o comportamento já testado do alerta existente.
`ProviderReliabilityScore` não distingue timeout de indisponibilidade (ver
Seção 13) e usa um valor neutro (50, nunca 100) quando não há dados
operacionais suficientes — nunca inventa uma métrica que o modelo de dados
não contém. Todos os pesos e limiares são provisórios e sujeitos a
recalibração após operação real.

## 25. Avisos Obrigatórios e Próxima Fase

Este módulo **não** contém, gera ou sugere recomendação de aposta, edge, valor
esperado (EV) ou Kelly Criterion. **Não** implementa Machine Learning. **Não**
altera o Intelligence Engine (Fase 1.5). A simples existência ou execução
desta camada **não ativa** nenhuma persistência real em produção — isso
continua exigindo as flags explícitas da Fase 3
(`BETSAPI_PERSIST_ENABLED`/`BETSAPI_AGGREGATION_ENABLED`). Todos os limiares e
pesos usados são provisórios. Um status de prontidão `ready` descreve apenas
estabilidade técnica de dados/integração — nunca uma garantia financeira. Uma
hipotética Fase 3.6 poderia adicionar um dashboard visual read-only e/ou o
schema Prisma real para `PrismaObservabilityRepository` deixar de estar
`unavailable`.
