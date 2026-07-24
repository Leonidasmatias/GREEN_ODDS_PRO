# Intelligence Engine — Fase 1.5 (ESOCCER INTELLIGENCE V1)

## 1. Objetivo

Este documento descreve o Intelligence Engine construído na Fase 1.5 do
projeto GREEN ODDS PRO — ESOCCER INTELLIGENCE V1. Esta fase constrói uma
camada puramente estatística sobre a fundação de domínio da Fase 1
(`docs/ESOCER_DOMAIN_V1.md`): dado o histórico de partidas de um jogador
(e, quando aplicável, de um par de jogadores), os módulos aqui descritos
calculam rating, forma, taxas de gols, desempenho mandante/visitante,
confronto direto, momentum, força, confiança estatística e um indicador
consolidado interno ("Green Score").

Esta fase é **exclusivamente estatística**. Nenhum dos módulos gera
probabilidades por inferência de IA, nenhum consome BetsAPI ou qualquer
outra fonte externa, e nenhum produz odds, mercados ou recomendações de
aposta finais — isso é escopo de fases futuras (predição/recomendação), que
combinarão estes indicadores com dados de mercado ainda não implementados.
Todos os pesos e limiares usados nas fórmulas abaixo são **PROVISÓRIOS**,
definidos por julgamento de engenharia nesta fase e sinalizados em código
para recalibração após backtests com dados reais.

## 2. Escopo e restrições

- 100% offline: todos os cálculos operam sobre estruturas de dados em
  memória (`ESoccerPlayerMatchRecord[]`, `AggregationMatchInput[]`, etc.),
  nunca sobre uma chamada de rede.
- Nenhuma integração com BetsAPI, odds ou qualquer provider externo.
- Nenhuma predição final nem recomendação de aposta — apenas indicadores
  estatísticos internos (rating, forma, força, confiança, Green Score).
- Não altera nem faz squash dos commits da Fase 1 (`ce1698b`..`e021eaa`).
- Reutiliza a ordenação canônica de par (`canonicalizePlayerPair`) e a
  regra central de identidade (nickname = jogador, equipe virtual = apenas
  contexto) definidas na Fase 1.

## 3. Arquitetura geral

Todos os módulos vivem em `src/services/intelligence/`. Nove dos dez
módulos (1 a 9) são **funções puras**: recebem dados já carregados pelo
chamador e devolvem um resultado calculado, sem tocar em banco de dados,
rede ou relógio do sistema (além de `new Date()` para ordenar por
`playedAt`, que já vem nos dados). Apenas o décimo módulo
(`AggregationEngine`) acessa o Prisma, e mesmo assim sua lógica de cálculo
central também é exposta como funções puras testáveis isoladamente.

```
types.ts              — tipos compartilhados (ESoccerPlayerMatchRecord, clampScore, ...)
RatingEngine.ts        (Módulo 1)  — rating Elo simplificado
FormEngine.ts           (Módulo 2)  — forma em janelas de 5/10/20 partidas
GoalsEngine.ts          (Módulo 3)  — taxas de gols (Over 0.5..5.5, BTTS, clean sheet)
HomeAwayEngine.ts       (Módulo 4)  — desempenho separado mandante/visitante (usa Módulo 3)
HeadToHeadEngine.ts     (Módulo 5)  — confronto direto (usa canonicalizePlayerPair da Fase 1)
MomentumEngine.ts       (Módulo 6)  — tendência recente (usa Módulo 2)
StrengthEngine.ts       (Módulo 7)  — força de ataque/defesa/geral (usa 2, 4, 6 e o rating)
ConfidenceEngine.ts     (Módulo 8)  — confiança estatística baseada em tamanho de amostra
GreenScoreEngine.ts     (Módulo 9)  — indicador consolidado (usa 3, 5, 6, 7, 8)
AggregationEngine.ts    (Módulo 10) — orquestração + persistência via Prisma
```

## 4. Fluxo de dados

1. `AggregationEngine.runAggregation()` lê todas as `ESoccerMatch` com
   `status = FINISHED` e placar completo via Prisma (único ponto de I/O
   real de todo o Intelligence Engine).
2. Essas partidas são convertidas em `AggregationMatchInput[]` e, por
   jogador, em `ESoccerPlayerMatchRecord[]` (histórico orientado do ponto
   de vista de cada jogador, independente de mandante/visitante).
3. As funções puras (`computeRollingStatsForPlayer`,
   `computeHeadToHeadPairs`, `computeRatings`) recalculam rolling stats,
   pares de H2H e ratings a partir desse histórico.
4. `runAggregation()` persiste os resultados via `upsert`/`create` nas
   tabelas `ESoccerPlayerRollingStats`, `ESoccerHeadToHeadStats` e
   `ESoccerPlayerRating` (schema definido na Fase 1).
5. Para compor um indicador de um jogador específico (fora do fluxo de
   agregação em lote), o chamador combina os módulos 1 a 9 diretamente
   sobre o histórico de um jogador: Rating + Form + HomeAway + Momentum →
   Strength; Form + H2H + Rating → Confidence; Strength + Momentum + H2H +
   Goals + Confidence → Green Score.

## 5. Módulo 1 — Rating Engine

Elo simplificado, sem bibliotecas externas. `INITIAL_RATING = 1500`,
`K_FACTOR = 20`. Probabilidade esperada de A vencer B:
`1 / (1 + 10^((ratingB - ratingA) / 400))`. `batchRecalculate` reprocessa
todas as partidas de um conjunto **em ordem cronológica**, partindo do
rating inicial para qualquer jogador sem histórico anterior, e devolve um
`Map<playerId, {rating, matchesCount}>`.

## 6. Módulo 2 — Form Engine

`calculateFormWindow(records, windowSize)` calcula vitórias, empates,
derrotas, taxa de vitória, pontos por jogo, gols pró/contra e saldo para
as `windowSize` partidas mais recentes (por `playedAt`), usando todas as
disponíveis se houver menos. `calculateFormSnapshot` calcula as três
janelas padrão (5, 10, 20) de uma vez.

## 7. Módulo 3 — Goals Engine

`calculateGoalsRates(records)` calcula, para o conjunto de partidas
fornecido, a fração (0 a 1) de partidas acima de cada limiar de gols totais
(Over 0.5 a Over 5.5), a fração com ambas equipes marcando (BTTS), clean
sheet e failed-to-score. Lista vazia devolve tudo zerado, sem lançar erro.

## 8. Módulo 4 — Home/Away Engine

`calculateHomeAwaySnapshot(records)` separa o histórico em mandante e
visitante (`record.isHome`) e resume cada lado independentemente
(taxa de vitória, gols, BTTS, Over 2.5), reaproveitando o Módulo 3 para as
taxas de gols de cada lado.

## 9. Módulo 5 — Head to Head Engine

`calculateHeadToHead(playerAId, playerBId, matches)` usa
`canonicalizePlayerPair` (Fase 1) para normalizar a ordem do par antes de
filtrar as partidas relevantes, garantindo que o mesmo confronto seja
representado de forma idêntica independente da ordem dos argumentos ou de
quem jogou em casa. Devolve vitórias/empates/gols de cada lado, taxas de
Over 2.5/3.5 e BTTS do confronto, além da última partida e das últimas
cinco.

## 10. Módulo 6 — Momentum Engine

FÓRMULA PROVISÓRIA:

```
momentumScore = clamp(
  ((recentPPG - baselinePPG) / 3) * 60 + (recentWinRate - baselineWinRate) * 40,
  -100, 100
)
```

`recentPPG`/`recentWinRate` vêm de `calculateFormWindow(records, 5)`;
`baselinePPG`/`baselineWinRate` vêm de `calculateFormWindow(records, 20)`.
Resultado limitado a `[MOMENTUM_MIN, MOMENTUM_MAX] = [-100, 100]`.

## 11. Módulo 7 — Strength Engine

Combina rating, forma, ataque/defesa, momentum e desempenho
mandante/visitante em três indicadores de 0 a 100. Pesos PROVISÓRIOS:

```
attackStrength  = ataque 45% + forma 25% + rating 15% + momentum 15%
defenseStrength = defesa 45% + forma 25% + rating 15% + momentum 15%
overallStrength = média(attackStrength, defenseStrength, rating, forma, momentum, mandante/visitante)
```

Cada componente é normalizado para 0..100 antes da combinação (rating em
relação à faixa 1000-2000; forma e ataque/defesa em relação a uma
referência de 3 gols por partida; momentum reescalado de -100..100 para
0..100).

## 12. Módulo 8 — Confidence Engine

Confiança estatística baseada em **tamanho de amostra**, não em qualidade
do resultado. Alvos e pesos PROVISÓRIOS:

```
matchesFactor = min(matchesCount / 20, 1) * 100      (peso 50%)
h2hFactor     = min(h2hMatchesCount / 5, 1) * 100     (peso 20%)
formFactor    = min(formMatchesCount / 10, 1) * 100   (peso 30%)
confidenceScore = matchesFactor*0.5 + h2hFactor*0.2 + formFactor*0.3
```

Um jogador com pouquíssimo histórico (ex.: 0 ou 1 partida) recebe
confiança próxima de zero, mesmo que os demais indicadores pareçam fortes
— a confiança modela "quão sólida é a amostra", não "quão bom é o
jogador".

## 13. Módulo 9 — Green Score Engine

O principal indicador interno desta fase (0 a 100), com classificação em
quatro faixas PROVISÓRIAS centralizadas em `GREEN_SCORE_THRESHOLDS`:

```
0–39   FRACO
40–59  REGULAR
60–79  BOM
80–100 EXCELENTE
```

Pesos PROVISÓRIOS de combinação:

```
overallStrength (Módulo 7)                       — 35%
momentum normalizado -100..100 → 0..100 (Módulo 6) — 15%
H2H win rate do jogador avaliado (Módulo 5)       — 10%
média de BTTS e Over 2.5 (Módulo 3)                — 15%
confidenceScore (Módulo 8)                         — 25%
```

Quando não há H2H disponível (`headToHead` nulo ou `matchesCount === 0`),
o peso do H2H (10%) é redistribuído proporcionalmente entre os quatro
demais componentes, para que a soma dos pesos continue 100% mesmo sem
histórico de confronto direto — este caso é coberto explicitamente em
`tests/intelligenceGreenScoreEngine.test.mjs`.

## 14. Módulo 10 — Aggregation Engine

Único módulo que acessa o Prisma. Expõe três funções puras,
independentes de banco de dados e totalmente cobertas por teste:

- `computeRollingStatsForPlayer(playerId, matches)` — rolling stats
  (janelas 5/10/20) de um jogador a partir do histórico completo.
- `computeHeadToHeadPairs(matches)` — uma linha de H2H por par de
  jogadores que já se enfrentaram, em ordenação canônica.
- `computeRatings(matches)` — recalcula o rating Elo de todos os
  jogadores presentes no histórico (reaproveita o Módulo 1).

`runAggregation()` é a única função assíncrona que lê `ESoccerMatch`
finalizadas via Prisma, recalcula com as três funções acima e persiste via
`upsert`/`create` em `ESoccerPlayerRollingStats`, `ESoccerHeadToHeadStats`
e `ESoccerPlayerRating`. **Nota de implementação**: o import do Prisma
Client é feito de forma tardia (`await import("../../lib/prisma.ts")`),
dentro do corpo de `runAggregation()`, e não no topo do arquivo — isso
permite que os testes importem o módulo inteiro (para exercitar as três
funções puras) sem que a instanciação do Prisma Client seja disparada
(o que falharia neste ambiente por ausência de binário de engine
compatível e de conexão de banco, ver Seção 16).

## 15. Fixtures e cobertura de testes

`tests/fixtures/esoccerIntelligenceMatches.mjs` contém 300 partidas
simuladas (`ESOCCER_INTELLIGENCE_FIXTURES_DATA_KIND = "SIMULATED_TEST_DATA"`),
geradas deterministicamente (PRNG com seed fixa), distribuídas entre 20
jogadores simulados (`player-01`..`player-20`) e 10 equipes virtuais
simuladas (`TeamA`..`TeamJ`). Nenhuma partida, placar ou horário
corresponde a um evento real.

Dez arquivos de teste (`tests/intelligence*.test.mjs`), todos importando
os módulos de produção reais (`.ts`) diretamente via a resolução nativa de
TypeScript do Node 22, cobrem:

- Módulo 1 (Rating): `tests/intelligenceRatingEngine.test.mjs`
- Módulo 2 (Form): `tests/intelligenceFormEngine.test.mjs`
- Módulo 3 (Goals): `tests/intelligenceGoalsEngine.test.mjs`
- Módulo 4 (Home/Away): `tests/intelligenceHomeAwayEngine.test.mjs`
- Módulo 5 (H2H): `tests/intelligenceHeadToHeadEngine.test.mjs`
- Módulo 6 (Momentum): `tests/intelligenceMomentumEngine.test.mjs`
- Módulo 7 (Strength): `tests/intelligenceStrengthEngine.test.mjs`
- Módulo 8 (Confidence): `tests/intelligenceConfidenceEngine.test.mjs`
- Módulo 9 (Green Score): `tests/intelligenceGreenScoreEngine.test.mjs`
- Módulo 10 (Aggregation, apenas as três funções puras):
  `tests/intelligenceAggregationEngine.test.mjs`

Casos de borda exigidos pela missão são cobertos explicitamente: mesmo
jogador em múltiplas posições (mandante/visitante), 0/1/5/20/100 partidas,
limites exatos das faixas do Green Score (39/40, 59/60, 79/80), ausência
de H2H, e uma passada de sanidade sobre as 300 partidas do fixture
completo (rolling stats, pares de H2H e ratings para os 20 jogadores).

`node --test tests/*.test.mjs` — 138 testes, 138 passando, 0 falhas
(inclui os testes da Fase 1 e de todo o restante do projeto, sem
regressões). `npx tsc --noEmit` — sem erros.

## 16. Dependências e reuso da Fase 1

- `HeadToHeadEngine.ts` e `AggregationEngine.ts` importam
  `canonicalizePlayerPair` de `src/lib/esoccer/normalization.ts` (Fase 1)
  para garantir que a ordenação de pares de H2H seja idêntica à definida
  na fundação de domínio.
- Nenhum tipo do Prisma Client é usado pelos módulos 1-9; apenas o Módulo
  10 depende do schema `ESoccerMatch`/`ESoccerPlayerRollingStats`/
  `ESoccerHeadToHeadStats`/`ESoccerPlayerRating` definido na Fase 1.

## 17. Limitações conhecidas

- `runAggregation()` não é coberta por teste automatizado nesta fase: ela
  depende de uma conexão real com o PostgreSQL de produção/desenvolvimento
  e do Prisma Client gerado para a plataforma correta, nenhum dos dois
  disponível neste ambiente de execução. As três funções de cálculo que
  ela orquestra são 100% cobertas.
- Todos os pesos, alvos de amostra e limiares de classificação
  (`K_FACTOR`, pesos do Momentum/Strength/Confidence/Green Score, faixas
  de classificação) são PROVISÓRIOS — definidos por julgamento de
  engenharia nesta fase, não por backtest com dados reais de eSoccer.
  Estão documentados em código com o comentário "PROVISÓRIO"/"PROVISIONAL"
  para facilitar localização e recalibração futura.
- Nesta fase não há geração de predições, recomendações, odds ou qualquer
  saída voltada a apostas — apenas indicadores estatísticos internos.
- O ambiente de execução usado para construir esta fase não conseguiu
  rodar `prisma generate`/`prisma format`/`prisma validate`/`npm run
  build` (binário de engine Prisma disponível apenas para Windows,
  gerado no ambiente do usuário, e sem acesso de rede para buscar o
  binário Linux equivalente). Isso não afeta os módulos 1-9 (que não
  dependem do Prisma Client) nem a suíte de testes (que evita a
  instanciação do Prisma Client graças ao import tardio do Módulo 10).

## 18. Próxima fase

Fase 2 — Data Ingestion Pipeline (provider-agnóstico, incluindo um adapter
BetsAPI sem chamadas HTTP reais nesta etapa) foi apresentada durante esta
sessão e **deliberadamente adiada** a pedido explícito do usuário até a
conclusão completa desta Fase 1.5. Ela deverá reaproveitar o
`AggregationEngine` (Módulo 10) como consumidor dos dados normalizados
pelo pipeline de ingestão, sem alterar os módulos 1-9 nem o schema Prisma
definido na Fase 1.
