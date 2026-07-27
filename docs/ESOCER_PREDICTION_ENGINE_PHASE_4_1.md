# Prediction Engine Foundation — Fase 4 / Sprint 4.1 (ESOCCER INTELLIGENCE V1)

## 1. Objetivo

Este documento descreve a fundação do Prediction Engine construída na
Sprint 4.1 do projeto GREEN ODDS PRO — ESOCCER INTELLIGENCE V1. O objetivo
desta sprint é transformar os indicadores estatísticos já produzidos pelo
Intelligence Engine (Fase 1.5, `docs/INTELLIGENCE_ENGINE_V1.md`) em uma
previsão de resultado de partida no mercado 1X2: probabilidade de vitória
do mandante (`HOME_WIN`), empate (`DRAW`) e vitória do visitante
(`AWAY_WIN`).

**This phase does not generate betting recommendations.** Nenhum cálculo
de edge, valor esperado (EV) ou Kelly Criterion foi implementado. Nenhuma
odd real é consumida ou comparada.

## 2. Escopo

- Consumir os resultados já calculados pelos Módulos 1-9 do Intelligence
  Engine (Rating, Form, Goals, Home/Away, Head to Head, Momentum,
  Strength, Confidence, Green Score) — nunca recalculá-los.
- Produzir três probabilidades (`homeWin`, `draw`, `awayWin`) que somam 1,
  o resultado mais provável, a margem entre as duas maiores probabilidades,
  suficiência de dados e rastreabilidade completa das features usadas.
- Modelo determinístico, explicável, configurável e testável, sem
  dependências novas e sem machine learning treinado.
- Uma versão de modelo explícita e centralizada.

## 3. Fora do escopo

Não implementados nesta sprint (reservados para a Sprint 4.2 — Goal
Distribution Engine — ou fases posteriores): Over/Under, BTTS, distribuição
de Poisson, placar correto, Expected Goals, calibração histórica, Brier
Score, Log Loss, backtesting, EV, value betting, Kelly Criterion,
comparação de odds, bankroll, stake, recomendação de aposta, integração
com dashboard, nova rota de API, chamadas BetsAPI, persistência de
previsões, alterações no schema Prisma, migrações, IA generativa, machine
learning treinado, dados sintéticos, fuzzy matching. Nenhum arquivo das
Fases 1, 1.5, 2, 3 ou 3.5 foi modificado.

## 4. Arquivos criados

Todos em `src/services/prediction/` — uma pasta nova e isolada, seguindo o
mesmo princípio de isolamento por camada já usado por
`src/services/observability/` (Fase 3.5):

```
src/services/prediction/
  types.ts                          — tipos compartilhados + clamp/isFiniteNumber
  PredictionModelConfig.ts           — versão, pesos, limiares, validação, erro estruturado
  PredictionFeatureBuilder.ts        — Feature Builder (função pura)
  PredictionDataSufficiency.ts       — avaliador de suficiência de dados (função pura)
  PredictionNormalizer.ts            — softmax numericamente estável
  MatchOutcomeProbabilityEngine.ts   — orquestrador: predictMatchOutcome()
  index.ts                           — fachada pública (barrel)
```

**Decisão de nomenclatura**: a sugestão inicial da missão incluía um
arquivo `PredictionModelVersion.ts` separado. Optamos por centralizar a
versão do modelo dentro de `PredictionModelConfig.ts` (constante
`PREDICTION_MODEL_VERSION` + campo `modelVersion` da própria configuração),
já que versão e pesos são, na prática, a mesma unidade de configuração —
evitando um arquivo com uma única constante. Um módulo separado
`PredictionDataSufficiency.ts` foi adicionado (não sugerido explicitamente
no prompt) porque a lógica de suficiência de dados é substancial o
suficiente (múltiplas regras de rebaixamento de status, detecção de
números inválidos, detecção de divergência entre indicadores) para
merecer isolamento e testes próprios, em vez de inflar o orquestrador
principal.

**Decisão sobre barrel (`index.ts`)**: o Intelligence Engine (Fase 1.5) não
usa um arquivo barrel — cada um dos dez módulos é importado diretamente
pelos consumidores, adequado para dez módulos majoritariamente
independentes entre si. Aqui, ao contrário, existe um único ponto de
entrada consumidor-facing (`predictMatchOutcome`), o que torna uma fachada
única mais apropriada — o mesmo padrão já usado por
`src/services/observability/index.ts` (Fase 3.5, `ObservabilityService`
como fachada). Os testes desta sprint importam os módulos individuais
diretamente (mesma convenção da Fase 1.5), com um teste dedicado
exercitando o barrel para garantir que a fachada pública funciona e nunca
diverge da implementação direta.

## 5. Tipos existentes reutilizados (nenhum recriado)

`PlayerRatingResult` (RatingEngine), `FormSnapshot`/`FormWindowStats`
(FormEngine), `HomeAwaySnapshot`/`HomeAwaySplitStats` (HomeAwayEngine),
`MomentumResult` (MomentumEngine), `StrengthResult` (StrengthEngine),
`ConfidenceResult` (ConfidenceEngine), `GreenScoreResult`
(GreenScoreEngine), `HeadToHeadResult` (HeadToHeadEngine) — todos
importados via `import type` diretamente dos módulos da Fase 1.5, nunca
redeclarados. `calculateExpectedScore` (RatingEngine, Módulo 1) é
reaproveitado para normalizar a diferença de rating, em vez de inventar
uma escala nova. `GoalsRates` (GoalsEngine) foi deliberadamente **excluído**
do tipo de entrada do jogador: é um indicador de mercado de gols e não
tem papel em uma previsão 1X2 — incluí-lo sem uso real violaria a regra de
não fabricar features artificiais.

## 6. Fluxo de dados

```
PlayerPredictionInputs (home) ─┐
PlayerPredictionInputs (away) ─┼─► PredictionFeatureBuilder.buildPredictionFeatures()
HeadToHeadResult (ou null) ────┘        │
                                         ▼
                          8 PredictionFeatureTrace (ordem fixa)
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
      soma das 7 contribuições    contribuição de      PredictionDataSufficiency
      de tilt (exceto drawBalance)   drawBalance         .evaluateDataSufficiency()
                    │                    │                    │
                    ▼                    ▼                    │
              homeLogit           drawLogit                   │
                    │                    │                    │
              awayLogit = -homeLogit     │                    │
                    └─────────┬──────────┘                    │
                               ▼                               │
                 PredictionNormalizer.computeOutcomeProbabilities()
                 (÷ temperature, softmax estável, soma exata)   │
                               │                                │
                               ▼                                ▼
                         MatchOutcomePrediction (probabilities, predictedOutcome,
                         topProbability, probabilityMargin, dataSufficiency, featureTrace)
```

`predictMatchOutcome()` (`MatchOutcomeProbabilityEngine.ts`) é a única
função pública de orquestração. `now: () => Date` é injetável e preenche
apenas `generatedAt` — nunca influencia o cálculo (testado explicitamente
em `tests/matchOutcomeProbabilityEngine.test.mjs`).

## 7. Features utilizadas

Oito features, sempre nesta ordem no `featureTrace`:

| # | Nome | Módulo de origem | O que mede |
|---|---|---|---|
| 1 | `ratingDifference` | RatingEngine (Módulo 1) | Diferença de rating via a mesma probabilidade esperada de Elo (`calculateExpectedScore`) já usada para recalcular ratings |
| 2 | `formDifference` | FormEngine (Módulo 2) | Diferença de pontos por jogo na janela configurada (`config.formWindow`, padrão `last10`) |
| 3 | `strengthDifference` | StrengthEngine (Módulo 7) | Diferença de `overallStrength` (já combina ataque, defesa, forma, rating e momentum — não recalculado aqui) |
| 4 | `momentumDifference` | MomentumEngine (Módulo 6) | Diferença de `momentumScore` |
| 5 | `homeAdvantage` | HomeAwayEngine (Módulo 4) | Taxa de vitória do mandante jogando em casa menos taxa de vitória do visitante jogando fora — só disponível com amostra mínima de cada lado |
| 6 | `headToHead` | HeadToHeadEngine (Módulo 5) | Vantagem no confronto direto, reorientada do par canônico para a perspectiva mandante/visitante real desta partida |
| 7 | `greenScoreDifference` | GreenScoreEngine (Módulo 9) | Diferença do indicador consolidado |
| 8 | `drawBalance` | composto (ver Seção 9) | Equilíbrio entre os dois jogadores — nunca favorece casa ou visitante, apenas o empate |

Cada feature carrega `rawValue`, `normalizedValue`, `weight`,
`contribution`, `availability` (`AVAILABLE`/`MISSING`/`NOT_APPLICABLE`) e
`direction` (`FAVORS_HOME`/`FAVORS_DRAW`/`FAVORS_AWAY`/`NEUTRAL`).

**Semântica de disponibilidade**: `MISSING` significa que o indicador de
origem está ausente (`null`) ou contém um número não finito (NaN/Infinity)
— dado que deveria existir mas não existe ou é inválido. `NOT_APPLICABLE`
significa que o dado existe, mas uma regra estrutural do modelo o
desqualifica (ex.: `homeAdvantage` com amostra mandante/visitante abaixo
do mínimo configurado). Em ambos os casos a contribuição é sempre `0` —
nunca um valor fabricado.

## 8. Fórmula do modelo

Sete features (todas exceto `drawBalance`) formam um tilt casa/visitante
simétrico:

```
homeLogit = Σ contribution(feature)   para as 7 features de tilt
awayLogit = -homeLogit
drawLogit = contribution(drawBalance)

[homeWin, draw, awayWin] = softmax([homeLogit, drawLogit, awayLogit] ÷ temperature)
```

Cada `contribution = weight × normalizedValue`, com `normalizedValue`
sempre em `-1..1` (ou `0..1` apenas para `drawBalance`). `temperature`
(padrão `4`, ver Seção 10) controla o quão extremas as probabilidades
finais podem ficar — um valor maior achata a distribuição.

## 9. Tratamento do empate (nunca `1 - home - away`)

`drawBalance` é uma feature própria, nunca derivada por subtração. É a
média dos sub-sinais de equilíbrio **realmente disponíveis**:

- proximidade de rating (`1 - |ratingDifference.normalizedValue|`);
- equilíbrio de forma (`1 - |formDifference.normalizedValue|`);
- equilíbrio de força geral (`1 - |strengthDifference.normalizedValue|`);
- equilíbrio no confronto direto (`1 - |headToHead.normalizedValue|`);
- proximidade de Green Score (`1 - |greenScoreDifference.normalizedValue|`);
- frequência histórica média de empates dos dois jogadores (janela
  configurada).

Quando um sub-sinal não está disponível (ex.: rating ausente), ele é
simplesmente excluído da média — o peso é redistribuído implicitamente
entre os sub-sinais disponíveis, o mesmo padrão de redistribuição já usado
por `GreenScoreEngine.calculateGreenScore` (Fase 1.5) quando o H2H está
ausente. **Quando nenhum sub-sinal está disponível** (os dois jogadores
são estreantes), o componente inteiro fica `NOT_APPLICABLE` — nunca
assume um valor neutro arbitrário como `0.5`.

## 10. Normalização (softmax numericamente estável)

`PredictionNormalizer.computeOutcomeProbabilities` implementa softmax com
subtração do maior logit antes de exponenciar (evita overflow para logits
extremos) e neutraliza logits `NaN`/`±Infinity` para `0` antes do cálculo,
em vez de propagá-los.

**Nota sobre "soma exatamente 1"**: nenhuma sequência de operações de
ponto flutuante pode garantir `a + b + c === 1` bit a bit para toda
entrada possível — limitação estrutural do IEEE-754 double (52 bits de
mantissa), não uma falha de implementação. Este módulo garante: (1)
nenhuma probabilidade é negativa ou maior que 1 (clamp final); (2) a soma
das três probabilidades retornadas está sempre a, no máximo,
`Number.EPSILON` de 1 (a menor das três é sempre definida como o
complemento exato das outras duas, técnica testada exaustivamente com
milhares de combinações aleatórias em
`tests/predictionNormalizer.test.mjs`, incluindo logits extremos e
inválidos).

## 11. Pesos provisórios

**PROVISIONAL — pending historical calibration.** Todos os pesos, a
temperatura do softmax, a janela de forma padrão e os limiares de
suficiência de dados abaixo são julgamento de engenharia desta sprint, não
resultado de backtest com dados reais de eSoccer — a mesma convenção já
usada por `MomentumEngine`/`StrengthEngine`/`ConfidenceEngine`/
`GreenScoreEngine` (Fase 1.5) e pelo `EsoccerClassifier`/`DataQualityEngine`
(Fases 3/3.5).

```
ratingDifference:    1.1
formDifference:      0.8
strengthDifference:  1.0
momentumDifference:  0.5
homeAdvantage:       0.3   (deliberadamente pequeno — Seção 12)
headToHead:          0.6
greenScoreDifference:0.7
drawBalance:         1.0

temperature: 4        (achata a distribuição; ver Seção 10)
formWindow:  10        (last10 — equilíbrio entre recência e amostra)
```

Todos centralizados em `PredictionModelConfig.ts`, validados por
`validatePredictionModelConfig` (rejeita pesos negativos, NaN, Infinity,
temperatura ≤ 0, `formWindow` fora de `{5,10,20}`, limiares de suficiência
fora de ordem ou acima de 100) e substituíveis pelo chamador sem alterar
o motor.

## 12. Home Advantage

O eSoccer usa jogadores permanentes e equipes virtuais efêmeras
(`docs/ESOCER_DOMAIN_V1.md`, Seções 2-3): a vantagem de mandante não pode
ser a força permanente do jogador nem uma suposição herdada do futebol
físico tradicional. `homeAdvantage` é calculado exclusivamente a partir de
`HomeAwayEngine` (taxa de vitória do mandante em casa menos taxa de vitória
do visitante fora), **separado** de `strengthDifference`/`ratingDifference`,
com peso pequeno por padrão (`0.3`, o segundo menor dos oito) e só
disponível (`AVAILABLE`) quando ambos os lados atingem a amostra mínima
configurada (`minHomeAwaySampleSize`, padrão `3`) — caso contrário,
`NOT_APPLICABLE`, nunca extrapolado de uma amostra insuficiente.

**Nota sobre simetria**: ao contrário das outras sete features de tilt,
`homeAdvantage` não é simétrica sob troca de mandante/visitante — e isso é
intencional, não um defeito. Trocar quem manda de fato muda o significado
da feature (um jogador pode ter ótimo retrospecto em casa e mediano fora,
e o inverso não é verdade automaticamente). `tests/matchOutcomeProbabilityEngine.test.mjs`
testa a simetria de troca isolando as sete features simétricas (omitindo
dados de mandante/visitante), não o conjunto completo.

## 13. Comportamento com dados insuficientes

`PredictionDataSufficiency.evaluateDataSufficiency` nunca fabrica
confiança. Reaproveita `ConfidenceEngine.confidenceScore` (Módulo 8, já
uma métrica de suficiência de amostra) como sinal primário, com um piso
rígido:

1. **Amostra zero de qualquer jogador** (`matchesCount === 0`) força
   `INSUFFICIENT`, independente de qualquer outro indicador — cobre
   jogador estreante (um lado) e ambos estreantes (avisos
   `home_player_debutant`/`away_player_debutant`/`both_players_debutant`).
2. Caso contrário, o piso é o menor `confidenceScore` entre os dois
   jogadores, contra limiares configuráveis
   (`minConfidenceForLimited=25`, `minConfidenceForSufficient=50`,
   `minConfidenceForStrong=75`). `confidence` ausente para um lado é
   tratado como o pior caso (`0`), nunca assumido como bom
   (aviso `{home,away}_confidence_unavailable`).
3. Ausência de H2H rebaixa (nunca eleva) o status para no máximo
   `SUFFICIENT` (aviso `no_head_to_head_history`).
4. Amostra mandante/visitante insuficiente em qualquer um dos dois
   jogadores rebaixa para no máximo `SUFFICIENT`
   (aviso `insufficient_home_away_split_data`).
5. Qualquer número inválido (NaN/Infinity) em qualquer indicador de
   entrada rebaixa para no máximo `LIMITED`
   (aviso `invalid_numeric_indicator_ignored`) — verificado por uma
   varredura recursiva de todos os campos numéricos da requisição.
6. Divergência forte entre indicadores (≥ 2 features de tilt favorecendo
   casa e ≥ 2 favorecendo visitante simultaneamente, com contribuição
   relevante) gera o aviso `conflicting_indicators`, sem alterar o status.

Quando os dois jogadores são totalmente desconhecidos, todas as oito
features ficam `MISSING`/`NOT_APPLICABLE`, os três logits são exatamente
`0`, e a previsão resultante é uma distribuição perfeitamente equilibrada
(`1/3` cada, dentro de `Number.EPSILON`) — nunca uma falsa certeza.

## 14. Explicabilidade

Cada uma das oito entradas de `featureTrace` expõe `rawValue` (unidade
original do domínio, `null` para a feature composta `drawBalance`),
`normalizedValue`, `weight`, `contribution`, `availability` e `direction`
— dados estruturados, sem texto em linguagem natural (fora do escopo desta
sprint). `direction` é sempre derivada do sinal de `contribution` (exceto
`drawBalance`, que é sempre `FAVORS_DRAW` quando disponível e `NEUTRAL`
quando não, já que estruturalmente nunca favorece um lado).

## 15. Versionamento

`PREDICTION_MODEL_VERSION = "esoccer-outcome-v1.0.0-provisional"`,
centralizado em `PredictionModelConfig.ts` e propagado para
`MatchOutcomePrediction.modelVersion` em toda previsão. Deve mudar sempre
que features, pesos, fórmula ou normalização mudarem de forma que o
resultado numérico deixe de ser comparável a versões anteriores.

## 16. Determinismo

Nenhum módulo usa números aleatórios, `Date.now()`/relógio do sistema
dentro da matemática, estado global mutável, rede, banco de dados ou
arquivos externos. `now` é injetável e usado exclusivamente para
`generatedAt`, nunca lido dentro do cálculo de probabilidades — testado
explicitamente (`generatedAt reflects the injected clock and never
influences the math`).

## 17. Limitações conhecidas

- `formDifference` e o sub-sinal de frequência histórica de empates usam
  apenas a janela `config.formWindow` (padrão `last10`); as janelas
  `last5`/`last20` calculadas pelo Intelligence Engine para essa mesma
  partida não são combinadas entre si nesta sprint.
- `homeAdvantage` combina, em uma única feature, os dois candidatos
  distintos sugeridos pela missão ("vantagem de mandante" e "força como
  visitante") — uma simplificação deliberada, já que a estrutura de pesos
  de oito posições não reserva um slot separado para cada um.
- `ProviderReliability`/dados de mercado de odds não são consultados; esta
  sprint opera inteiramente sobre indicadores internos do Intelligence
  Engine.
- `runAggregation()` (Fase 1.5) continua sem cobertura automatizada por
  depender de Prisma real — limitação pré-existente, não desta sprint.

## 18. Riscos

- Os pesos e a temperatura não foram calibrados contra resultados reais
  liquidados; o comportamento relativo (quem favorece o quê) é
  logicamente correto, mas a magnitude absoluta das probabilidades pode
  não refletir a frequência real de eventos até uma calibração futura.
- `drawBalance` e `homeAdvantage` dependem inteiramente da precisão dos
  dados do Intelligence Engine — qualquer viés sistemático herdado das
  Fases 1.5/2/3 se propaga para a previsão.
- Este motor não é validado contra odds de mercado (fora do escopo) —
  não deve ser interpretado como sinal de valor de aposta.

## 19. Resultados dos testes

- Testes novos desta sprint: **88** (`tests/predictionNormalizer.test.mjs`,
  `tests/predictionFeatureBuilder.test.mjs`,
  `tests/predictionDataSufficiency.test.mjs`,
  `tests/predictionModelConfig.test.mjs`,
  `tests/matchOutcomeProbabilityEngine.test.mjs`,
  `tests/predictionRegression.test.mjs`,
  `tests/predictionIndexBarrel.test.mjs`).
- `node --test tests/*.test.mjs` → **519 testes, 519 passando, 0 falhas**
  (431 pré-existentes das Fases 1 a 3.5 + 88 novos desta sprint, sem
  nenhuma regressão).
- `npx tsc --noEmit` → sem erros.
- `npx eslint .` → 0 erros, 13 avisos pré-existentes (nenhum em
  `src/services/prediction/`).
- `npm run build` (`prisma generate && next build`) → build de produção
  concluído com sucesso.
- `git diff --check` → sem problemas de espaço em branco (nenhum arquivo
  pré-existente foi modificado; apenas arquivos novos).
- Cobertura (`node --test --experimental-test-coverage
  --test-coverage-include="src/services/prediction/**"`, recurso nativo do
  Node, nenhuma dependência nova adicionada): **100% linhas, 97.35%
  branches, 100% funções** em todos os sete arquivos de
  `src/services/prediction/` — acima da meta de 95% linhas / 90% branches.

## 20. Handoff para a Sprint 4.2

A Sprint 4.2 (Goal Distribution Engine) fica responsável por: expectativa
de gols, distribuição de total de gols, Over/Under, BTTS e probabilidades
de mercados de gols — nada disso foi antecipado nesta sprint.
`GoalsRates` (GoalsEngine, Fase 1.5) permanece disponível e intocado para
essa fase consumir. `PredictionModelConfig`, `PredictionFeatureTrace` e o
padrão de disponibilidade/direção estabelecidos aqui devem ser reutilizados
(não recriados) por qualquer novo motor de mercado de gols, seguindo o
mesmo princípio desta sprint: consumir o Intelligence Engine, nunca
duplicá-lo.

**All weights and thresholds are provisional pending real historical
calibration.**
