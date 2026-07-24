# BetsAPI Real Integration - Fase 3 (ESOCCER INTELLIGENCE V1)

## 1. Objetivo

Este documento descreve a integracao real e controlada com a BetsAPI
construida na Fase 3 do projeto GREEN ODDS PRO - ESOCCER INTELLIGENCE V1.
A integracao real permanece **DESATIVADA por padrao** e nenhuma chamada
real ocorre sem configuracao explicita por variavel de ambiente. Esta
fase preserva integralmente a Fase 1 (eSoccer Domain), a Fase 1.5
(Intelligence Engine) e a Fase 2 (Data Ingestion Pipeline) - nenhum
arquivo dessas fases foi alterado.

Nesta fase, odds sao apenas capturadas e tipadas - **nenhuma recomendacao
financeira, calculo de edge ou Kelly Criterion e gerado**. Persistencia
real de dados exige autorizacao explicita via feature flag propria, mesmo
em modo `live`.

## 2. Arquitetura

```
src/providers/betsapi/
  BetsApiConfig.ts        - config + feature flags (validacao centralizada)
  BetsApiErrors.ts         - 9 erros estruturados (sem token)
  BetsApiRedaction.ts      - sanitizacao central (token, URLs, headers, objetos)
  BetsApiPayloads.ts       - tipagem dos payloads reais + conversao para BetsApiRawMatch
  BetsApiResponse.ts       - parse do envelope (success) + rate limit headers
  BetsApiClient.ts         - cliente HTTP real (fetch nativo, sem dependencias novas)
  EsoccerClassifier.ts     - confirmed/probable/not_esoccer/unknown
  LiveBetsApiProvider.ts   - implementa MatchProvider/HealthProvider (Fase 2) com dados reais
  BetsApiSyncService.ts    - orquestra dry-run/sandbox/live, reaproveitando a IngestionPipeline (Fase 2)
  BetsApiHealthCheck.ts    - health check rico, compativel com HealthProvider (Fase 2)
  BetsApiAdapter.ts        - (Fase 2, inalterado) apenas parser/mapeamento/tipagem/simulacao
scripts/betsapi-smoke-test.mjs - teste manual controlado, nunca automatico
```

Fluxo:

```
BetsApiClient -> BetsApiPayloads(betsApiEventToRawMatch) -> BetsApiRawMatch (Fase 2, inalterado)
       -> ProviderNormalizer (Fase 2, inalterado) -> InternalMatchDTO
```

O `BetsApiAdapter` existente (Fase 2) continua responsavel apenas por
parser/mapeamento/conversao/tipagem simulada - nenhuma linha dele foi
alterada nesta fase; toda a capacidade de rede real vive nos novos
arquivos acima.

## 3. Configuracao segura

`BetsApiConfig` (`loadBetsApiConfig`) e `BetsApiFeatureFlags`
(`loadBetsApiFeatureFlags`) carregam e validam tudo a partir de variaveis
de ambiente - nunca de valores hardcoded. Defaults sempre seguros:

```
BETSAPI_ENABLED=false
BETSAPI_MODE=fixture
```

Regras de validacao (lancam `BetsApiConfigurationError` estruturado):
- `mode` invalido (fora de `fixture`/`sandbox`/`live`) -> erro.
- `mode=sandbox` sem `BETSAPI_TOKEN` -> erro.
- `mode=live` sem `BETSAPI_ENABLED=true` -> erro.
- `mode=live` sem `BETSAPI_TOKEN` -> erro.
- qualquer campo numerico com valor nao-inteiro/negativo -> erro.

## 4. Seguranca do token

O token nunca e hardcoded, nunca e salvo no banco, nunca aparece no
frontend (nenhuma variavel `NEXT_PUBLIC_*` o referencia), e e inserido na
URL apenas no momento do envio da requisicao (`BetsApiClient.buildUrl`),
conforme a convencao real da BetsAPI (query param `token`). `.env.example`
contem apenas o nome da variavel (`BETSAPI_TOKEN=`), nunca um valor real.
`.env`, `.env.local`, `.env.production` e `.env.*.local` seguem (e agora
com o padrao `.env.*.local` adicionado ao `.gitignore` nesta fase)
ignorados pelo Git.

`BetsApiRedaction.ts` centraliza a sanitizacao: `redactUrl`/`redactHeaders`/
`redactErrorMessage`/`redactConfigObject`/`redactDeep` garantem que nenhum
log, erro, metrica, relatorio ou objeto serializado exponha o valor real
do token - testado explicitamente em `tests/betsapiRedactionAndErrors.test.mjs`
e em `tests/betsapiClient.test.mjs` (a URL da requisicao e o unico lugar
onde o token aparece).

## 5. Endpoints

Somente leitura, implementados em `BetsApiClient`:

- `getUpcomingEvents(params)` - `GET /v3/events/upcoming` (sport_id, league_id, team_id, day, page, skip_esports).
- `getEventView(eventIds)` - `GET /v1/event/view`, 1 a 10 ids por chamada (rejeita 0 ou mais de 10 sem chamar a rede).
- `getLeagues(params)` / `iterateLeagues(params, maxPages)` - `GET /v3/league`, paginacao por `max_id` decrescente, com protecao contra loop infinito (sem progresso -> para) e limite rigido de paginas.
- `getTeams(params)` / `iterateTeams(params, maxPages)` - `GET /v3/team`, mesma logica de paginacao/protecao.
- `getEventOddsSummary(eventId)` - `GET /v2/event/odds/summary`, apenas captura e tipagem; nenhuma recomendacao e gerada a partir disso.

## 6. Rate limit

`BetsApiResponse.parseRateLimitHeaders` le `X-RateLimit-Limit`/`Remaining`/
`Reset` a cada resposta - o limite **nunca** e codificado como constante
fixa, pois varia por pacote contratado. `BetsApiRateLimitState` guarda
`limit/remaining/resetAt/observedAt/blocked/reserveReached`. Quando
`remaining <= BETSAPI_RATE_LIMIT_RESERVE`, o cliente recusa a proxima
chamada **antes de qualquer requisicao de rede**, lancando
`BetsApiRateLimitError`. O relogio (`now`) e injetavel para testes 100%
deterministicos.

## 7. Retry

Retry (exponential backoff + jitter deterministico/injetavel, via
`RetryPolicy.ts` da Fase 2 reaproveitado) se aplica somente a: timeout,
erro de rede, HTTP 429/500/502/503/504 e `UNDER_MAINTENANCE`. Nunca
retenta: token invalido (`AUTHORIZE_FAILED`), permissao negada
(`PERMISSION_DENIED`), parametro invalido/ausente
(`PARAM_INVALID`/`PARAM_REQUIRED`) ou 404 definitivo.

## 8. Fallback

Apos falhas de rede/timeout/manutencao esgotarem as tentativas no host
principal (`api.b365api.com`), o cliente tenta **uma unica vez** o host
de fallback (`api.betsapi.com`) - nunca alterna indefinidamente entre os
dois. Erros de autenticacao/permissao/validacao nunca disparam fallback
(nao sao problema de host, e sim de credencial/parametro).

## 9. Classificacao eSoccer

`EsoccerClassifier.classifyEsoccerEvent` nao assume que `sport_id=1`
implica eSoccer. Combina 3 sinais independentes (`is_esports`, padrao de
participante "Equipe (nickname)" via o parser da Fase 1, allowlist de
liga) - denylist tem prioridade absoluta (`not_esoccer` imediato). 2+
sinais concordando -> `confirmed_esoccer`; exatamente 1 -> `probable_esoccer`;
nenhum sinal e `is_esports=false` -> `not_esoccer`; nenhum sinal disponivel
-> `unknown`. Toda classificacao carrega um array `evidence` auditavel.
Somente `confirmed_esoccer` segue para persistencia automatica em modo
`live`; `probable_esoccer` pode ser processado (normalizado/validado/
deduplicado) em `dry-run`/`sandbox`, nunca persistido automaticamente em
`live`.

## 10. Dry-run

`BetsApiSyncService.run("dry-run", ...)` consulta a API real (respeitando
`BETSAPI_MAX_PAGES_PER_SYNC`/`BETSAPI_MAX_EVENTS_PER_SYNC`), classifica,
normaliza, valida e deduplica **em memoria** - nunca persiste, nunca
executa a Aggregation do Intelligence Engine. Produz o `BetsApiSyncReport`
completo para inspecao.

## 11. Sandbox

Mesmo fluxo do dry-run, mas pensado para chamadas explicitas de teste
contra a API real; tambem nunca persiste por padrao (o estagio de
persistencia fica sempre `no-op` neste modo, independente das feature
flags). `probable_esoccer` pode ser incluido no processamento.

## 12. Live

Exige `BETSAPI_ENABLED=true` e `BETSAPI_TOKEN` valido (via `BetsApiConfig`).
Mesmo assim, persistencia e aggregation **so acontecem se as flags
proprias** (`BETSAPI_PERSIST_ENABLED`/`BETSAPI_AGGREGATION_ENABLED`)
estiverem em `true` - testado explicitamente
(`tests/betsapiSyncService.test.mjs`: live com flag desligada nao
persiste; live com flag ligada persiste). Somente eventos
`confirmed_esoccer` sao elegiveis a persistencia automatica; `probable_esoccer`
e excluido do processamento em modo `live`.

## 13. Feature flags

```
BETSAPI_ENABLED=false
BETSAPI_MODE=fixture
BETSAPI_PERSIST_ENABLED=false
BETSAPI_AGGREGATION_ENABLED=false
BETSAPI_ESOCCER_ALLOWLIST=
BETSAPI_ESOCCER_DENYLIST=
BETSAPI_MAX_PAGES_PER_SYNC=3
BETSAPI_MAX_EVENTS_PER_SYNC=200
```

Persistencia e aggregation exigem flag propria mesmo em `live` - nunca
sao implicitas.

## 14. Health check

`BetsApiHealthCheck` implementa o contrato `HealthProvider` da Fase 2
(inalterado) e pode ser registrado dentro de um `ProviderHealthService`
existente por composicao. `checkDetailed()` faz **no maximo uma** chamada
real (uma pagina de `getUpcomingEvents`) e devolve
`configured/enabled/mode/reachable/authenticated/permissionGranted/
latencyMs/primaryHostHealthy/fallbackHostHealthy/lastSuccessAt/
lastFailureAt/rateLimitRemaining/safeError` - nunca o token. Em modo
`fixture`, nenhuma chamada real e feita.

## 15. Observabilidade

Integra-se ao `PipelineLogger`/`PipelineEventBus` da Fase 2 (inalterados)
atraves do `BetsApiSyncService`, que reaproveita a `IngestionPipeline`
como motor de normalizacao/validacao/deduplicacao. Metricas de host
(`BetsApiClient.getHostMetrics`) registram apenas: host, latencia, ultimo
sucesso/falha e mensagem de erro ja sanitizada - nunca o corpo completo da
resposta por padrao.

## 16. Testes

10 arquivos novos (`tests/betsapi*.test.mjs` + a regressao), todos
importando codigo de producao real, **zero chamadas de rede reais**
(fetch sempre injetado/mockado):

- `betsapiConfig.test.mjs` - configuracao fixture/sandbox/live, flags.
- `betsapiRedactionAndErrors.test.mjs` - token nunca exposto, todos os 9 erros.
- `betsapiResponse.test.mjs` - envelope success/erro, headers de rate limit.
- `betsapiClient.test.mjs` - URL segura, timeout/AbortController, retry+backoff+jitter, fallback (uma vez, nao indefinido), 401/permissao sem retry, rate limit bloqueando antes da rede, paginacao com protecao de loop infinito, Event View 1-10 ids.
- `betsapiClassifier.test.mjs` - todas as classificacoes e a prioridade do denylist.
- `betsapiLiveProvider.test.mjs` - todos os metodos do MatchProvider/HealthProvider com dados reais simulados.
- `betsapiSyncService.test.mjs` - dry-run/sandbox/live, flags de persistencia/aggregation, exclusao de probable_esoccer em live, limites de paginas/eventos, deduplicacao entre execucoes.
- `betsapiHealthCheck.test.mjs` - fixture/sandbox/live, uma unica chamada, erro sanitizado.
- `betsapiRegression.test.mjs` - confirma que FixtureProvider, IngestionPipeline e Intelligence Engine continuam identicos.

`node --test tests/*.test.mjs` -> **297 testes, 297 passando, 0 falhas**
(206 anteriores + 91 novos desta fase). `npx tsc --noEmit` -> sem erros.

## 17. Smoke test

`scripts/betsapi-smoke-test.mjs` - script manual, **nunca executado
automaticamente**. Exige `BETSAPI_ENABLED=true`, `BETSAPI_MODE=sandbox` e
`BETSAPI_TOKEN` no ambiente; faz no maximo uma chamada real; nunca
persiste; nunca executa aggregation; nunca imprime o token (apenas um
resumo sanitizado via `redactDeep`); sai com codigo diferente de zero em
qualquer falha. Nenhum token foi adicionado ao script.

## 18. Limitacoes

- `LiveBetsApiProvider.listMatchesByPeriod` filtra localmente sobre o
  resultado de uma unica chamada a `getUpcomingEvents` (a API nao aceita
  um intervalo `from`/`to` diretamente) - uma simplificacao deliberada
  desta fase.
- `getEventOddsSummary` apenas captura e tipa o payload; nenhum calculo de
  probabilidade/edge/recomendacao e feito a partir dele nesta fase.
- Os quality gates dependentes do Prisma CLI (`format`/`validate`/
  `generate`) e `next build` nao puderam ser reexecutados com sucesso
  neste sandbox especifico (mesma limitacao estrutural de rede/binario ja
  registrada nas Fases 1, 1.5 e 2) - ver Secao 15 do relatorio final.
- Nenhuma chamada real foi feita durante esta implementacao: toda a
  cobertura de teste usa `fetch` injetado/mockado, por restricao
  explicita da missao.

## 19. Rollback

Para desativar a integracao real a qualquer momento, sem reverter nenhum
codigo: defina `BETSAPI_ENABLED=false` (ou remova a variavel) e/ou
`BETSAPI_MODE=fixture`. Nenhuma chamada real ocorre nesse estado, e o
restante do sistema (FixtureProvider, Intelligence Engine, Data Ingestion
Pipeline) continua funcionando exatamente como nas Fases 1, 1.5 e 2.
Reverter os commits desta fase (sem alterar os das fases anteriores)
tambem e seguro, ja que toda a integracao real vive em arquivos novos e
isolados sob `src/providers/betsapi/` (alem dos ja existentes, inalterados)
e `scripts/`.

## 20. Proxima fase

Com a integracao real pronta (porem desativada por padrao), a proxima
fase natural e habilitar, de forma gradual e monitorada, a persistencia
real (`BETSAPI_PERSIST_ENABLED=true`) e a Aggregation
(`BETSAPI_AGGREGATION_ENABLED=true`) em ambiente controlado, seguida - somente
apos validacao operacional - da geracao de predicoes/recomendacoes
combinando os indicadores do Intelligence Engine com os dados reais de
odds aqui capturados. Nenhum calculo de edge, Kelly Criterion ou
recomendacao de aposta foi implementado nesta fase.
