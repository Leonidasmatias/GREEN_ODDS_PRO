# Data Ingestion Pipeline — Fase 2 (ESOCCER INTELLIGENCE V1)

## 1. Objetivo

Este documento descreve a camada de ingestão de partidas eSoccer construída
na Fase 2 do projeto GREEN ODDS PRO — ESOCCER INTELLIGENCE V1. O objetivo é
permitir que o sistema receba partidas de **qualquer provedor** (simulado,
BetsAPI, CSV ou entrada manual) através de uma arquitetura única e
independente de formato, sem que o restante do sistema — em particular o
Intelligence Engine da Fase 1.5 — precise saber de onde os dados vieram.

Nesta fase, nenhuma credencial real é usada, nenhuma chamada HTTP real é
feita, e o BetsAPI Adapter opera inteiramente sobre payloads simulados
injetados pelo chamador. Toda a arquitetura foi desenhada para que, quando
uma integração real for autorizada em uma fase futura, baste implementar o
transporte de rede dentro do adapter existente — os contratos, DTOs,
normalizer, validator, deduplicator e pipeline não precisam mudar.

## 2. Escopo e restrições

- Nenhum consumo de internet nesta fase.
- Nenhuma chave/credencial da BetsAPI é usada ou necessária.
- Nenhuma alteração no Intelligence Engine (Fase 1.5) ou no schema/migrations
  Prisma (Fase 1) — a Aggregation do Intelligence Engine é apenas
  referenciada como o próximo passo do fluxo, via um hook injetável.
- Nenhuma alteração na UI, autenticação, ou nos provedores de odds reais já
  existentes em `src/providers/{apiFootball,sportMonks,theOddsApi,
  mockProvider,types.ts,providerManager.ts,resultProvider.ts,
  competitionFilter.ts}` — esses arquivos pertencem à plataforma de odds
  real já em produção e não foram tocados; a camada eSoccer desta fase vive
  inteiramente em novas subpastas (`base/`, `betsapi/`, `fixture/`,
  `types/`, `contracts/`, `pipeline/`) dentro de `src/providers/`.
- Nenhuma dependência nova adicionada; nenhum `package.json` alterado.

## 3. Arquitetura

```
src/providers/
  types/dto.ts          — DTOs internos únicos (League, Player, VirtualTeam,
                           Match, Odds, Recommendation, Prediction)
  contracts/index.ts     — Provider, MatchProvider, OddsProvider,
                           ResultProvider, HealthProvider
  base/
    ProviderError.ts      — erro estruturado comum
    RetryPolicy.ts        — retry policy determinística (sem I/O real)
    RateLimiter.ts        — rate limiter abstrato (janela deslizante)
    InMemoryMatchProvider.ts — base para providers 100% em memória
  fixture/
    esoccerFixtureCatalog.ts — as 300 partidas simuladas (Fase 1.5), em TS
    FixtureProvider.ts    — provider simulado (Match+Result+Health)
  betsapi/
    BetsApiAdapter.ts     — adapter simulado (Match+Health), zero HTTP real
  pipeline/
    ProviderNormalizer.ts — payload bruto -> InternalMatchDTO
    MatchValidator.ts     — validação estruturada do InternalMatchDTO
    DeduplicationService.ts — NEW / DUPLICATE / UPDATED
    PipelineEvents.ts     — 6 eventos + event bus síncrono
    PipelineLogger.ts     — log em memória por execução
    ProviderHealthService.ts — health check agregado
    ProviderConfig.ts     — seleção de provider + CsvProvider/ManualProvider
    IngestionPipeline.ts  — orquestração de tudo acima
```

Nota sobre nomes: já existe `src/providers/types.ts` (arquivo) pertencente à
plataforma de odds real pré-existente. A nova pasta `src/providers/types/`
(com `dto.ts` dentro) é uma entidade de sistema de arquivos distinta — não
há conflito técnico — mas o nome idêntico é intencionalmente mantido apenas
porque a missão especificou literalmente `src/providers/types` como uma das
seis subpastas obrigatórias.

## 4. Fluxo de dados

```
Provider.listMatches()          (payload bruto, formato do provedor)
        ↓
ProviderNormalizer               (parseESoccerParticipant + normalização, Fase 1)
        ↓
InternalMatchDTO
        ↓
MatchValidator                   (jogadores/liga/datas/placares/status/provider/payload)
        ↓  (inválido → MatchRejected)
Status FINISHED?
        ↓ não → MatchIgnored     (aguarda resultado definitivo)
        ↓ sim
DeduplicationService              (NEW / DUPLICATE / UPDATED)
        ↓  (DUPLICATE → MatchDuplicated, fim)
Persistence stage (injetável)     (em produção: grava ESoccerMatch via Prisma)
        ↓
MatchImported / MatchUpdated
        ↓ (após todas as partidas do lote)
Aggregation stage (injetável)     (em produção: AggregationEngine.runAggregation(), Fase 1.5)
        ↓
AggregationCompleted
```

Cada estágio é uma função/classe independente e testável isoladamente
(ver Seção 8); a `IngestionPipeline` apenas os compõe.

## 5. Providers

- **FixtureProvider** — reexpõe as 300 partidas simuladas da Fase 1.5
  (originalmente em `tests/fixtures/esoccerIntelligenceMatches.mjs`) através
  de um catálogo TypeScript tipado (`esoccerFixtureCatalog.ts`), para que
  código de produção não precise importar de dentro de `tests/` nem quebrar
  o `tsc --noEmit` (que não resolve tipos para `.mjs` sem `allowJs`).
  Implementa `MatchProvider`, `ResultProvider` (a partida simulada já nasce
  com placar definitivo) e `HealthProvider` (sempre saudável).
- **BetsApiAdapter** — simula o formato de payload real da BetsAPI
  (`id`, `league.{id,name}`, `time` unix em segundos, `time_status`
  0/1/3, `home.name`/`away.name` no formato `"Equipe (nickname)"`, `ss`
  como placar `"2-1"`). Implementa mapeamento, tipagem, parser (reaproveita
  `parseESoccerParticipant` da Fase 1), tratamento de erros
  (`ProviderError`), health check simulado, retry policy
  (`runWithRetry`/`RetryPolicyConfig`) e rate limiter abstrato
  (`AbstractRateLimiter`) — nenhuma chamada HTTP real em nenhum ponto.
- **CsvProvider** / **ManualProvider** — implementações mínimas para
  completar as quatro opções de `ProviderConfig` (Fixture/BetsAPI/CSV/
  Manual). Reaproveitam o mesmo shape "fixture-like" e a base em memória.

Providers nunca importam nada de `src/services/intelligence/` — apenas
devolvem seu próprio payload bruto (`TRaw`); o acesso aos engines só
acontece depois do estágio de Aggregation, fora do provider.

## 6. Pipeline

`IngestionPipeline.run()` processa o lote inteiro devolvido por
`provider.listMatches()` e devolve um `PipelineRunSummary` com contagens de
`imported/updated/duplicated/ignored/rejected` e a duração total. As
etapas de persistência e de agregação são injetáveis
(`persist`/`runAggregation`) e, por padrão, são no-ops nesta fase — a
missão proíbe alterar o Intelligence Engine e não há banco de dados
disponível neste ambiente de teste (mesma limitação já documentada para
`AggregationEngine.runAggregation()` na Fase 1.5). A ligação real em
produção (gravar `ESoccerMatch` via Prisma e chamar
`AggregationEngine.runAggregation()`) fica pronta para ser conectada sem
alterar nenhum destes módulos.

## 7. Contratos e DTOs

Contratos (`src/providers/contracts/index.ts`): `Provider`,
`MatchProvider<TRaw>`, `OddsProvider`, `ResultProvider<TRaw>`,
`HealthProvider`. DTOs únicos (`src/providers/types/dto.ts`):
`InternalLeagueDTO`, `InternalPlayerDTO`, `InternalVirtualTeamDTO`,
`InternalMatchDTO`, `InternalOddsDTO`, `InternalPredictionDTO`,
`InternalRecommendationDTO` — todos independentes do formato de qualquer
provedor específico.

## 8. Eventos

Seis eventos, emitidos por um event bus síncrono e sem dependências
externas (`PipelineEventBus`): `MatchImported`, `MatchUpdated`,
`MatchIgnored`, `MatchDuplicated`, `MatchRejected`,
`AggregationCompleted`. `tests/ingestionPipelineEvents.test.mjs` cobre
disparo, múltiplos listeners, cancelamento de inscrição (`unsubscribe`) e
os seis tipos de evento.

## 9. Deduplicação

Estratégia (documentada em detalhe no cabeçalho de
`DeduplicationService.ts`): chave primária `provider::externalId`; na
ausência de `externalId`, chave secundária `provider::hash-de-conteúdo`
(jogadores + horário + status + placar). Para uma chave já vista, o hash
de conteúdo decide entre `DUPLICATE` (nada mudou) e `UPDATED` (mesma
identidade, dado novo — ex.: placar chegou depois). O hash é uma soma
polinomial simples em base 31, determinística e sem bibliotecas externas.

## 10. Health Check

`ProviderHealthService` consulta um ou mais `HealthProvider` e devolve
status, última sincronização, tempo médio de resposta, último erro e
provider ativo (`checkAll`/`checkOne`/`checkActive`/`setActiveProvider`).

## 11. Testes

Nove arquivos novos (`tests/ingestion*.test.mjs`), todos importando módulos
de produção `.ts` reais:

- `ingestionFixtureProvider.test.mjs` — Fixture Provider
- `ingestionBetsApiAdapter.test.mjs` — BetsAPI Adapter (mapeamento, parser,
  retry, rate limiter, provider indisponível)
- `ingestionProviderNormalizer.test.mjs` — Normalizer e forma dos DTOs
- `ingestionMatchValidator.test.mjs` — Validator (partida inválida, payload
  incompleto, acumulação de múltiplos erros)
- `ingestionDeduplicationService.test.mjs` — Deduplicação (duplicidade,
  atualização, fallback sem externalId)
- `ingestionPipelineEvents.test.mjs` — os 6 eventos
- `ingestionHealthAndConfig.test.mjs` — Health Service, ProviderConfig,
  CsvProvider, ManualProvider
- `ingestionPipeline.test.mjs` — Pipeline completa fim a fim, incluindo os
  edge cases exigidos pela missão: duplicidade dentro de um mesmo lote,
  partida inválida (mesmo jogador nos dois lados), payload incompleto
  (nome fora do formato "Equipe (nickname)"), e provider indisponível
  (BetsAPI simulado forçado a falhar, confirmando que a pipeline rejeita a
  execução em vez de mascarar o erro)

`node --test tests/*.test.mjs` → **206 testes, 206 passando, 0 falhas**
(138 da Fase 1/1.5 + 68 novos desta fase, sem nenhuma regressão).
`npx tsc --noEmit` → sem erros.

## 12. Quality Gates

- `npx tsc --noEmit` — **passou**, sem erros.
- `npm test` — **passou**, 206/206.
- `git diff --check` — **passou**, sem problemas de espaço em branco.
- `npx prisma format` / `npx prisma validate` / `npx prisma generate` /
  `npm run build` — **não executáveis neste ambiente**: o binário do
  engine Prisma disponível em `node_modules` foi gerado apenas para
  Windows (ambiente local do usuário), e este sandbox Linux não tem acesso
  de rede para buscar o binário equivalente em `binaries.prisma.sh`
  (`403 Forbidden`/timeout). Esta é exatamente a mesma limitação estrutural
  já registrada nas Fases 1 e 1.5, não uma falha de código desta fase —
  nenhum destes quatro comandos depende de nada criado nesta fase além do
  schema já existente (que não foi alterado).

## 13. Limitações conhecidas

- As etapas de Persistence e Aggregation da `IngestionPipeline` são
  no-ops por padrão nesta fase — a ligação real com `ESoccerMatch` (Prisma)
  e com `AggregationEngine.runAggregation()` (Fase 1.5) não é exercida
  automaticamente por nenhum teste, pelos mesmos motivos já documentados
  para o Módulo 10 da Fase 1.5 (sem banco de dados real disponível aqui).
  As funções de cálculo/transformação em si (Normalizer, Validator,
  Deduplicator, Pipeline) são 100% cobertas.
- O BetsAPI Adapter é inteiramente simulado: nenhuma chamada de rede real
  foi implementada ou testada nesta fase, por restrição explícita da
  missão.
- CSV e Manual são implementações mínimas (mas reais e testadas) — apenas o
  necessário para completar as quatro opções de `ProviderConfig`; não
  incluem, por exemplo, streaming de arquivos grandes ou validação de
  encoding.
- Os quatro quality gates que dependem do Prisma CLI (`format`/
  `validate`/`generate`) e do `next build` não puderam ser executados
  neste ambiente (ver Seção 12); precisam ser confirmados pelo usuário em
  sua máquina local, como nas fases anteriores.

## 14. Próxima fase

Com a Pipeline pronta, o GREEN ODDS PRO está preparado para receber dados
de qualquer provedor (simulado, BetsAPI real, CSV ou entrada manual) sem
alterar o motor estatístico (Intelligence Engine) já implementado. A
próxima fase natural é conectar de fato as etapas de Persistence
(`ESoccerMatch` via Prisma) e Aggregation
(`AggregationEngine.runAggregation()`) à pipeline aqui construída, e,
somente quando explicitamente autorizado, substituir os payloads simulados
do BetsAPI Adapter por uma chamada real à BetsAPI.
