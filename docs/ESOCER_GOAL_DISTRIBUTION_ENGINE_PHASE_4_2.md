# Goal Distribution Engine Foundation — Fase 4 / Sprint 4.2 (ESOCCER INTELLIGENCE V1)

## 1. Objetivo

Este documento descreve a fundação do Goal Distribution Engine construída
na Sprint 4.2 do projeto GREEN ODDS PRO — ESOCCER INTELLIGENCE V1. O
objetivo desta sprint é transformar os indicadores estatísticos já
produzidos pelo Intelligence Engine (Fase 1.5) em uma distribuição
probabilística de gols: gols esperados do mandante e do visitante,
distribuição de Poisson por lado, matriz conjunta de placares, placares
exatos, Over/Under, Both Teams To Score (BTTS) e as probabilidades 1X2
implícitas na própria matriz (`scoreDerivedOutcomeProbabilities`, apenas
para comparação futura com a Sprint 4.1).

**This phase does not generate betting recommendations.** Nenhum cálculo
de edge, valor esperado (EV), Kelly Criterion ou gestão de banca foi
implementado. Nenhuma odd real é consumida ou comparada.

## 2. Escopo

- Consumir os resultados já calculados pelos módulos do Intelligence
  Engine (Form, Home/Away, Head to Head, Momentum, Strength, Confidence) —
  nunca recalculá-los.
- Estimar `expectedGoals` (mandante, visitante, total) de forma
  determinística, pura, configurável e explicável.
- Implementar uma função de massa de Poisson própria (sem biblioteca
  estatística externa), com truncagem tratada explicitamente e
  renormalização.
- Construir a matriz conjunta de placares (0-0 até, no mínimo, 10-10,
  configurável) e extrair placares exatos, mais provável e top N.
- Derivar Over/Under (linhas padrão 0.5 a 7.5, configurável), BTTS e
  `scoreDerivedOutcomeProbabilities` — nunca misturados com a Sprint 4.1.

## 3. Fora do escopo

Não implementados nesta sprint: EV, odds justas comparadas com bookmaker,
edge, Kelly Criterion, stake, recomendação de aposta, "green entry", sinal
de aposta, gestão de banca, endpoints de API, UI, Prisma, migrations,
persistência, jobs, ingestão, alteração da integração real com a BetsAPI,
machine learning, treinamento automático, calibração histórica, combinação
automática com o resultado 1X2 da Sprint 4.1, Asian totals com linha
inteira ou .25. Nenhum arquivo das Fases 1 a 3.5 nem da Sprint 4.1 foi
modificado.

## 4. Reconhecimento realizado

Antes de implementar, os sete módulos do Prediction Engine (Sprint 4.1) e
os nove módulos do Intelligence Engine (Fase 1.5) foram inspecionados
diretamente no repositório (nenhuma interface foi presumida):

- **Prediction Engine (Sprint 4.1)**: `types.ts` define `PlayerPredictionInputs`
  (perfil por jogador: `matchesCount`, `rating`, `form`, `homeAway`,
  `momentum`, `strength`, `confidence`, `greenScore`, todos `| null`),
  `DataSufficiencyResult`/`DataSufficiencyStatus`/`FeatureAvailability` e
  `MatchOutcomePrediction` — todos reaproveitados nesta sprint via o barrel
  público `src/services/prediction/index.ts`. `PredictionModelConfig.ts`
  estabeleceu o padrão de config centralizada + `validate*` +
  `*ConfigurationError`, replicado aqui.
- **Intelligence Engine**: `GoalsEngine.calculateGoalsRates` devolve
  **frações de partidas acima de um limiar** (Over 0.5..5.5, BTTS, clean
  sheet), não uma média de gols — por isso não alimenta `expectedGoals`
  diretamente (ver Seção 7). O sinal real de "gols por partida" vem de
  `FormEngine` (`FormWindowStats.avgGoalsFor/avgGoalsAgainst`, nas janelas
  `last5/10/20`) e de `HomeAwayEngine`
  (`HomeAwaySplitStats.avgGoalsFor/avgGoalsAgainst`, por lado). `HeadToHeadEngine`
  devolve `playerAGoals`/`playerBGoals` (total acumulado, não média) sobre
  um par sempre canonicalizado (`playerAId <= playerBId`), reorientado
  aqui exatamente como a Sprint 4.1 fez para `headToHead`/`homeAdvantage`.
  `MomentumEngine`/`StrengthEngine` fornecem sinais indiretos (momentum
  -100..100; attack/defenseStrength 0..100) sem interpretação direta em
  gols — usados apenas como ajustes secundários limitados (Seção 7).
  `ConfidenceEngine.confidenceScore` (0..100, já baseado em tamanho de
  amostra) é reaproveitado para a suficiência de dados (Seção 9), como já
  fazia `PredictionDataSufficiency` na Sprint 4.1.

## 5. Arquivos criados

Todos em `src/services/goal-distribution/` — uma pasta nova e isolada,
seguindo a estrutura sugerida na missão (nenhuma responsabilidade
concentrada em um único arquivo):

```
src/services/goal-distribution/
  types.ts                          — tipos compartilhados + clamp/isFiniteNumber
  GoalDistributionConfig.ts          — versão, pesos, limites de lambda, suavização, validação
  ExpectedGoalsFeatureBuilder.ts     — cinco features bidirecionais (função pura)
  ExpectedGoalsEngine.ts             — combina as features em expectedGoals + fallback
  PoissonDistribution.ts             — massa de Poisson + truncagem/renormalização
  ScoreMatrixEngine.ts               — matriz conjunta + placares exatos + ranking
  GoalMarketsEngine.ts               — Over/Under, BTTS, 1X2 derivado da matriz
  GoalDistributionDataSufficiency.ts — avaliador de suficiência de dados (função pura)
  GoalDistributionEngine.ts          — orquestrador: predictGoalDistribution()
  index.ts                           — fachada pública (barrel)
```

Nenhum arquivo das Fases 1-3.5 ou da Sprint 4.1 foi modificado — apenas
consumido através dos respectivos barrels/módulos públicos.

## 6. Reuso de tipos (nenhum recriado)

`PlayerPredictionInputs`, `MatchOutcomePrediction`, `DataSufficiencyResult`,
`DataSufficiencyStatus`, `FeatureAvailability` e `DataSufficiencyThresholds`
são importados diretamente de `../prediction/index.ts` (o barrel público da
Sprint 4.1) — nunca redefinidos. `HeadToHeadResult` é importado
diretamente de `../intelligence/HeadToHeadEngine.ts` (Intelligence Engine
não tem barrel). `GoalDistributionPlayerInputs` **estende**
`PlayerPredictionInputs` com `goalsRates: GoalsRates | null` (Módulo 3),
em vez de duplicar os oito campos já existentes:

```ts
export type GoalDistributionPlayerInputs = PlayerPredictionInputs & {
  goalsRates: GoalsRates | null;
};
```

**Decisão de reuso limitado**: `goalsRates` é aceito no tipo de entrada por
completude e para uso em uma fase futura (ex.: validação cruzada entre a
distribuição de Poisson calculada aqui e as taxas históricas de
Over/BTTS observadas), mas **não influencia** o cálculo de `expectedGoals`
nesta sprint — `over25`/`bothTeamsScored`/etc. são consequências derivadas
da mesma média de gols já capturada por
`form.avgGoalsFor/avgGoalsAgainst`/`homeAway.avgGoalsFor/avgGoalsAgainst`;
usá-lo agora duplicaria sinal, não adicionaria informação independente
genuína. Da mesma forma, `GoalDistributionRequest.predictionContext` (o
`MatchOutcomePrediction` da Sprint 4.1, opcional) nunca é lido por nenhum
cálculo desta sprint — existe apenas como ponto de extensão para uma
Sprint 4.3 futura que venha a comparar/calibrar os dois modelos lado a
lado (testado explicitamente: variar `predictionContext` nunca altera
nenhum número da previsão).

## 7. Fórmula de Expected Goals

Cinco features, cada uma bidirecional (produz `contributionHome` e
`contributionAway` simultaneamente), combinadas em ordem fixa:

| # | Nome | Módulo de origem | O que mede |
|---|---|---|---|
| 1 | `recentForm` | FormEngine (`last10`) | Média de ataque de um lado + média de gols concedidos do adversário, cada uma suavizada (Seção 8) |
| 2 | `homeAwaySplit` | HomeAwayEngine | Mesma ideia, usando os splits mandante/visitante específicos — só disponível com amostra mínima |
| 3 | `headToHead` | HeadToHeadEngine | Média de gols de cada lado neste confronto direto, suavizada pela amostra de H2H; desabilitável via `config.headToHeadEnabled`; peso sempre ≤ `config.maxHeadToHeadWeight` |
| 4 | `momentum` | MomentumEngine | Ajuste secundário pequeno (±`config.maxMomentumGoalsAdjustment` gols/partida), proporcional ao momentum normalizado |
| 5 | `strength` | StrengthEngine | Ajuste secundário pequeno (±`config.maxStrengthGoalsAdjustment` gols/partida), baseado em `attackStrength`/`defenseStrength` (nunca `overallStrength`, que já incorpora rating) |

**Rating e Green Score nunca são usados** para fabricar número de gols —
não têm interpretação direta em gols (exigência explícita da missão).

Combinação final (`ExpectedGoalsEngine.computeExpectedGoals`):

```
homeRate = Σ(weight_i * contributionHome_i) / Σ(weight_i)   — apenas features AVAILABLE
awayRate = Σ(weight_i * contributionAway_i) / Σ(weight_i)   — apenas features AVAILABLE

expectedGoals.home = clamp(homeRate, minLambda, maxLambda)
expectedGoals.away = clamp(awayRate, minLambda, maxLambda)
expectedGoals.total = home + away
```

O peso de uma feature ausente é redistribuído implicitamente entre as
disponíveis (renormalização do denominador) — o mesmo padrão de
redistribuição já usado por `GreenScoreEngine`/`drawBalance` (Fase 1.5 /
Sprint 4.1). Quando **nenhuma** feature está disponível (ex.: um dos dois
jogadores é estreante — toda feature exige dados de AMBOS os lados, já
que cada uma combina ataque de um lado com defesa do outro), aplica-se o
fallback `config.fallbackBaseGoalsPerPlayer` para os dois lados
igualmente, nunca zero absoluto, sinalizado pelo aviso
`fallback_conservative_baseline_applied`.

## 8. Suavização (Shrinkage)

Toda taxa observada passa por suavização antes de contribuir:

```
adjustedRate = sampleWeight * observedRate + (1 - sampleWeight) * conservativeBaselineGoalsPerMatch
sampleWeight = clamp(matchesCount / fullConfidenceSampleSize, 0, 1)
```

Uma amostra de `fullConfidenceSampleSize` (padrão 20) partidas ou mais é
tratada como totalmente confiável; uma amostra de 1 partida com média de 5
gols é puxada para muito perto da linha de base conservadora
(`conservativeBaselineGoalsPerMatch`, padrão 1.3), nunca tratada com a
mesma confiança que uma amostra de 100 partidas com a mesma média — testado
explicitamente (`tests/expectedGoalsFeatureBuilder.test.mjs`,
`tests/expectedGoalsEngine.test.mjs`).

## 9. Distribuição de Poisson: truncagem e renormalização

`PoissonDistribution.poissonProbability` calcula `P(X=k)` pela recorrência
`p(0) = exp(-lambda)`, `p(k) = p(k-1) * lambda / k` — nunca
`Math.pow(lambda, k)` nem `k!` diretamente, evitando overflow. `lambda` é
sanitizado (`sanitizeLambda`) para `[minLambda, maxLambda]` antes do
cálculo; NaN/Infinity nunca chegam à exponenciação.

`buildPoissonDistribution(lambda, maxGoals)` calcula `k = 0..maxGoals` e
**renormaliza** dividindo cada termo pela soma bruta — a massa que
excederia `maxGoals` (a "cauda" truncada) é redistribuída
proporcionalmente entre os valores calculados, garantindo soma igual a 1
dentro da tolerância de ponto flutuante em vez de somar silenciosamente
menos que 1. No caso patológico em que a soma bruta é exatamente `0`
(lambda sanitizado extremo o suficiente para `exp(-lambda)` sofrer
underflow completo), toda a massa é atribuída a `k=0` como fallback seguro
em vez de dividir por zero — testado explicitamente forçando
`minLambda=maxLambda=1000`.

## 10. Matriz de Placares

`ScoreMatrixEngine.buildScoreMatrix` assume **independência entre os gols
do mandante e do visitante** — a premissa padrão de modelos de Poisson
bivariados simples (documentada como limitação na Seção 17):

```
matrix[h][a] = P(Home=h) * P(Away=a)
```

Normalizada dividindo pela soma total (corrige qualquer resíduo de ponto
flutuante das duas distribuições marginais). Suporta, no mínimo, 0-0 até
10-10 (`maxGoalsPerPlayer` configurável). `extractExactScores` achata a
matriz em uma lista; `rankExactScores` ordena por probabilidade
decrescente com desempate determinístico em quatro níveis: (1) maior
probabilidade; (2) menor total de gols; (3) menor gols do mandante; (4)
menor gols do visitante.

## 11. Over/Under

Linhas padrão `[0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5]`, configuráveis
(`config.overUnderLines`, validadas: finitas, positivas, terminadas em
.5, sem duplicatas — Asian totals com linha inteira ou .25 rejeitados).
Para uma linha `L`: `under = P(totalGoals <= floor(L))`,
`over = 1 - under` — o segundo é **sempre** o complemento algébrico exato
do primeiro (nunca duas somas independentes), garantindo
`over + under === 1` dentro de `Number.EPSILON` por construção, já que a
matriz de entrada está normalizada para somar 1.

## 12. BTTS

`BTTS Yes = P(homeGoals > 0 && awayGoals > 0)`; `BTTS No = 1 - Yes` (mesmo
princípio de complemento exato da Seção 11).

## 13. Score-Derived 1X2

`scoreDerivedOutcomeProbabilities` soma as células da matriz onde
`home > away` (vitória mandante), `home === away` (empate) e `home < away`
(vitória visitante), corrigidas para somar exatamente 1 via a mesma
técnica de "atribuir o menor valor como complemento exato dos outros
dois" já usada por `PredictionNormalizer` (Sprint 4.1) — reimplementada
localmente em `GoalMarketsEngine.ts`, porque `computeOutcomeProbabilities`
da Sprint 4.1 aplica softmax a logits, o que distorceria probabilidades
já bem-formadas se reaproveitado aqui. **Nunca combinado ou misturado**
com `predictMatchOutcome` (Sprint 4.1) — os dois modelos permanecem
totalmente independentes, testado explicitamente
(`tests/goalDistributionEngine.test.mjs`: mesmo cenário produz dois
`modelVersion` distintos e dois cálculos que concordam apenas
direcionalmente, nunca numericamente).

## 14. Fallback e dados insuficientes

`GoalDistributionDataSufficiency.evaluateGoalDistributionDataSufficiency`
reaproveita o mesmo conceito e escala de `ConfidenceEngine.confidenceScore`
já usado pela Sprint 4.1, com um piso rígido: `matchesCount === 0` em
qualquer jogador força `INSUFFICIENT` (avisos
`{home,away}_player_debutant`/`both_players_debutant`), independente de
qualquer outro indicador. H2H ausente (quando habilitado), amostra
mandante/visitante insuficiente, ou qualquer número inválido
(NaN/Infinity, detectado por varredura recursiva) rebaixam o status para
no máximo `SUFFICIENT`/`LIMITED`, cada um com aviso nomeado. H2H
desabilitado por configuração (`headToHeadEnabled: false`) nunca gera
aviso — é uma escolha deliberada, não uma lacuna de dados.

Quando nenhuma das cinco features do Expected Goals Engine está
disponível, o fallback conservador (Seção 7) garante gols esperados
positivos e finitos para os dois lados, com o resultado 1X2 derivado da
matriz caindo em uma distribuição exatamente simétrica (empate como maior
massa relativa) — nunca uma falsa certeza.

## 15. Configuração

Centralizada em `GoalDistributionConfig.ts`:
`GOAL_DISTRIBUTION_MODEL_VERSION = "esoccer-goal-distribution-v1.0.0-provisional"`,
`DEFAULT_GOAL_DISTRIBUTION_CONFIG`, `validateGoalDistributionConfig`
(lança `GoalDistributionConfigurationError`), com: pesos das 5 features,
`minLambda`/`maxLambda`, `maxGoalsPerPlayer`, `defaultTopExactScores`,
`overUnderLines`, `dataSufficiencyThresholds` (reaproveitado da Sprint
4.1), `shrinkage` (`fullConfidenceSampleSize`,
`conservativeBaselineGoalsPerMatch`), `headToHeadEnabled`,
`maxHeadToHeadWeight`, `fallbackBaseGoalsPerPlayer`,
`maxMomentumGoalsAdjustment`, `maxStrengthGoalsAdjustment`,
`normalizationTolerance`. Validação rejeita: pesos negativos/NaN/Infinity,
`minLambda <= 0`, `maxLambda <= minLambda`, `maxGoalsPerPlayer`
inválido, `defaultTopExactScores` inválido ou acima do total de placares
possíveis, linhas de Over/Under não-.5/duplicadas/inválidas, limiares de
suficiência fora de ordem/acima de 100, parâmetros de suavização
inválidos, `weights.headToHead > maxHeadToHeadWeight`,
`fallbackBaseGoalsPerPlayer <= 0`, ajustes de momentum/força negativos, e
`normalizationTolerance` fora de `(0, 1]`.

**PROVISIONAL — pending historical calibration**: todos os pesos, limites
de lambda, parâmetros de suavização e limiares acima são julgamento de
engenharia desta sprint, não resultado de backtest com dados reais de
eSoccer.

## 16. API pública (`src/services/goal-distribution/index.ts`)

Fachada única (barrel), no mesmo padrão de
`src/services/prediction/index.ts` (Sprint 4.1) e
`src/services/observability/index.ts` (Fase 3.5).

**Principal**: `predictGoalDistribution(request, config?, now?)` —
orquestra tudo, ponto de entrada consumidor-facing.

**Secundárias/composáveis** (expostas para composição avançada e teste,
não estritamente necessárias para o uso básico): `computeExpectedGoals`,
`buildExpectedGoalsFeatures`, `orientHeadToHeadGoals`,
`evaluateGoalDistributionDataSufficiency`, `poissonProbability`,
`buildPoissonDistribution`, `sanitizeLambda`, `buildScoreMatrix`,
`extractExactScores`, `rankExactScores`, `computeOverUnder`,
`computeGoalLineProbability`, `computeBothTeamsToScore`,
`computeScoreDerivedOutcomeProbabilities`.

**Configuração**: `GOAL_DISTRIBUTION_MODEL_VERSION`,
`DEFAULT_GOAL_DISTRIBUTION_CONFIG`, `DEFAULT_GOAL_DISTRIBUTION_WEIGHTS`,
`DEFAULT_GOAL_DISTRIBUTION_DATA_SUFFICIENCY_THRESHOLDS`,
`DEFAULT_GOAL_DISTRIBUTION_SHRINKAGE`, `DEFAULT_OVER_UNDER_LINES`,
`validateGoalDistributionConfig`, `GoalDistributionConfigurationError`.

**Tipos**: `GoalDistributionConfig`, `GoalDistributionModelWeights`,
`GoalDistributionShrinkageConfig`, `GoalDistributionPlayerInputs`,
`GoalDistributionRequest`, `ExpectedGoals`, `GoalFeatureTrace`,
`PoissonProbability`, `ExactScoreProbability`, `GoalLineProbability`,
`BothTeamsToScoreProbability`, `ScoreDerivedOutcomeProbabilities`,
`GoalDistributionPrediction`, `DataSufficiencyResult`,
`DataSufficiencyStatus`, `FeatureAvailability`, `ExpectedGoalsComputation`,
`OrientedHeadToHeadGoals`.

## 17. Limitações conhecidas

- A matriz de placares assume **independência** entre gols do mandante e
  do visitante — uma simplificação padrão de modelos de Poisson bivariados
  simples; não modela correlação (ex.: jogos "abertos" com muitos gols de
  ambos os lados tendem, na prática, a ser levemente correlacionados).
  Recalibração futura poderia introduzir um parâmetro de correlação
  (ex.: cópula bivariada de Poisson) se justificado por dados reais.
- `goalsRates` (GoalsEngine) é aceito no tipo de entrada mas não
  influencia `expectedGoals` nesta sprint (Seção 6) — reservado para
  validação cruzada futura.
- A feature `homeAwaySplit` e `recentForm` sempre exigem dados de AMBOS os
  jogadores (cada uma combina ataque de um lado com defesa do outro); um
  jogador totalmente estreante torna todas as cinco features
  indisponíveis, ativando o fallback mesmo que o adversário tenha
  histórico rico — comportamento conservador documentado e testado.
- Um branch defensivo em `PoissonDistribution.poissonProbability`
  (`isFiniteNumber(probability) ? ... : 0`) permanece sem cobertura de
  teste: uma varredura numérica extensa (lambda/k até a casa das
  centenas, incluindo a fronteira de underflow de `exp(-lambda)` por
  volta de lambda~745) não encontrou nenhuma combinação capaz de produzir
  um valor não finito — cada termo de uma distribuição de Poisson real é
  matematicamente `<= 1`, então a recorrência é autolimitada por
  construção. Mantido como defesa em profundidade, documentado no código
  como provavelmente inalcançável em vez de forçado por um teste
  artificial (ver `docs`/comentário em `PoissonDistribution.ts`).
- Os quatro quality gates que dependem apenas de ferramentas locais
  (`tsc`, `eslint`, `npm test`, `npm run build`) foram executados com
  sucesso neste ambiente Windows (ao contrário de fases anteriores, que
  rodaram em um sandbox Linux sem o binário do Prisma).

## 18. Riscos

- Os pesos, limites de lambda e parâmetros de suavização não foram
  calibrados contra resultados reais liquidados; o comportamento relativo
  (quem tem mais gols esperados) é logicamente correto, mas a magnitude
  absoluta pode não refletir a frequência real de eventos até calibração
  futura.
- A premissa de independência (Seção 17) pode subestimar a probabilidade
  de placares fortemente correlacionados (ex.: 3-3) até validação com
  dados reais.
- Este motor não é validado contra odds de mercado (fora do escopo) — não
  deve ser interpretado como sinal de valor de aposta.

## 19. Resultados dos testes

- Testes novos desta sprint: **140** distribuídos em 10 arquivos
  (`tests/goalDistributionConfig.test.mjs`,
  `tests/poissonDistribution.test.mjs`,
  `tests/expectedGoalsFeatureBuilder.test.mjs`,
  `tests/expectedGoalsEngine.test.mjs`,
  `tests/scoreMatrixEngine.test.mjs`, `tests/goalMarketsEngine.test.mjs`,
  `tests/goalDistributionDataSufficiency.test.mjs`,
  `tests/goalDistributionEngine.test.mjs`,
  `tests/goalDistributionIndexBarrel.test.mjs`,
  `tests/goalDistributionRegression.test.mjs`).
- `node --test tests/*.test.mjs` → **659 testes, 659 passando, 0 falhas**
  (519 pré-existentes das Fases 1 a 3.5 e da Sprint 4.1 + 140 novos desta
  sprint, sem nenhuma regressão).
- `npx tsc --noEmit` → sem erros.
- `npx eslint .` → 0 erros, 13 avisos pré-existentes (nenhum em
  `src/services/goal-distribution/`).
- `npm run build` (`prisma generate && next build`) → build de produção
  concluído com sucesso.
- Cobertura (`node --test --experimental-test-coverage
  --test-coverage-include="src/services/goal-distribution/**"`, recurso
  nativo do Node, nenhuma dependência nova adicionada): **100% linhas,
  100% funções, 98.91% branches** em todos os nove arquivos de
  `src/services/goal-distribution/` — acima da meta de 100%/100%/95%
  (o único branch não coberto é o discutido na Seção 17).
- `git diff --check` → sem problemas de espaço em branco (nenhum arquivo
  pré-existente foi modificado; apenas arquivos novos).

## 20. Próximos passos da Sprint 4.3

Com Expected Goals, Poisson, matriz de placares, Over/Under e BTTS
prontos, a Sprint 4.3 fica naturalmente responsável por: calibração
histórica dos pesos/limites desta sprint e da Sprint 4.1 contra resultados
reais liquidados (`MatchResult`, quando a base de dados real crescer o
suficiente); métricas de qualidade de calibração (Brier Score, Log Loss);
backtesting formal; e, somente então, uma eventual camada de comparação
cruzada entre `scoreDerivedOutcomeProbabilities` (esta sprint) e
`predictMatchOutcome` (Sprint 4.1) usando `predictionContext`. Nenhuma
dessas etapas foi antecipada nesta sprint.

**All weights and thresholds are provisional pending real historical
calibration.**
