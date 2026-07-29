# Explainability — Prediction Intelligence Framework

Sprint 9.0.1 — Explainability Documentation. Documenta exclusivamente o
que existe hoje no código da Sprint 9.0 (`src/services/prediction-explanation/`,
`predictionExplanationApiHandlers.ts`, a rota
`GET /api/predictions/[id]/explanation`, `PredictionExplanationSection.tsx`
e os testes correspondentes) — nenhum campo, threshold, código ou
comportamento aqui descrito foi inventado; todos foram confirmados por
leitura direta do código-fonte antes da escrita deste documento.

## 1. Visão geral

O **Prediction Intelligence Framework** é a camada de explicabilidade do
Prediction Center. Ele resolve um problema específico: até a Sprint 8.x,
o sistema informava *o quê* — Green Score, Confidence, placar previsto,
vencedor, status — mas não *por quê*. Esta sprint responde exatamente a
essa pergunta: **"por que esta previsão foi produzida?"**.

Pontos centrais:

- A explicabilidade **não altera a previsão original** em nenhuma
  hipótese — ela é uma camada de leitura e interpretação, nunca de
  cálculo.
- Qualquer `PredictionSnapshotRecord` já persistido (Sprint 7.2+) é
  elegível: a explicação é gerada **sob demanda**, a partir do snapshot
  já salvo, nunca em um novo processo de geração.
- Não existe explicação "ao vivo" antes da previsão existir — o fluxo
  sempre parte de um snapshot já persistido.

## 2. Princípio de não recálculo

```
Prediction Engine
        │
        ▼
PredictionSnapshot persistido
        │
        ▼
Prediction Explanation Engine
        │
        ▼
API / UI
```

Garantias, verificadas por auditoria de código e por testes
(`predictionExplanationScope.test.mjs`):

- **Nenhum motor de previsão é executado novamente.** A camada de
  explicação nunca importa `predictMatch` nem qualquer módulo do
  Prediction Engine/Goal Distribution Engine para fins de cálculo —
  apenas lê os campos já produzidos por eles dentro do
  `PredictionSnapshot`.
- **Nenhum dado é escrito no banco.** A rota é exclusivamente `GET`; o
  handler (`predictionExplanationApiHandlers.ts`) nunca chama `.save()`
  nem qualquer método de persistência.
- **Nenhum resultado persistido é modificado.** O snapshot lido nunca é
  alterado — a explicação é um objeto novo, derivado, nunca gravado de
  volta.
- **A explicação é derivada em memória**, dentro da própria requisição
  HTTP, a partir do `PredictionDetail.snapshot` já retornado pela busca
  existente (`getPersistedPredictionById`).
- **A rota é somente leitura** (`GET /api/predictions/[id]/explanation`).
- **A camada é determinística**: para o mesmo `PredictionSnapshot` e o
  mesmo valor de `now` (usado apenas para avaliar o risco de dados
  desatualizados — ver §7), o resultado é sempre idêntico. Nenhuma
  função interna lê `Date.now()`/relógio do sistema diretamente; `now`
  é sempre recebido como parâmetro.

### O que esta camada não faz

- Não recalcula Green Score.
- Não recalcula Confidence.
- Não recalcula probabilidades.
- Não altera a previsão original.
- Não substitui backtest ou validação histórica.
- Não garante resultado esportivo.
- Não converte uma heurística de apresentação em evidência estatística
  validada — os thresholds e pesos usados são julgamento de engenharia
  desta sprint (ver §14), não resultado de calibração com dados reais.

## 3. Arquitetura

```
PredictionSnapshot
        │
        ├── PredictionFactorsEngine
        ├── ConfidenceBreakdownEngine
        ├── PredictionReasonsEngine
        ├── RiskIndicatorEngine
        └── QualityScoreEngine
                │
                ▼
PredictionExplanationEngine
                │
                ▼
predictionExplanationApiHandlers
                │
                ▼
GET /api/predictions/[id]/explanation
                │
                ▼
PredictionExplanationSection
```

| Módulo | Arquivo | Responsabilidade |
|---|---|---|
| `PredictionFactorsEngine` | `src/services/prediction-explanation/PredictionFactorsEngine.ts` | Constrói os 7 fatores estruturados (§4) a partir de `featureTrace`/`quality`/`expectedGoals` já calculados |
| `ConfidenceBreakdownEngine` | `.../ConfidenceBreakdownEngine.ts` | Normaliza pesos e scores reais em 6 categorias que somam 100% (§5) |
| `PredictionReasonsEngine` | `.../PredictionReasonsEngine.ts` | Converte `explanation.topSignals` (já ranqueado pelo motor) em frases determinísticas (§6) |
| `RiskIndicatorEngine` | `.../RiskIndicatorEngine.ts` | Classifica riscos operacionais a partir de campos já calculados (§7) |
| `QualityScoreEngine` | `.../QualityScoreEngine.ts` | Calcula a nota A+..D (§8) |
| `PredictionExplanationEngine` | `.../PredictionExplanationEngine.ts` | Composição pública: `buildPredictionExplanation(snapshot, now)` combina os 5 módulos acima |
| `predictionExplanationApiHandlers.ts` | `src/services/predictionExplanationApiHandlers.ts` | Handler puro da rota — reutiliza `getPersistedPredictionById` e `mapErrorToResult`, já existentes |
| `route.ts` | `src/app/api/predictions/[id]/explanation/route.ts` | Wrapper Next.js — autenticação/autorização e adaptação `NextRequest`/`NextResponse` |
| `PredictionExplanationSection` | `src/components/prediction-history/PredictionExplanationSection.tsx` | Seção de interface, renderizada dentro do drawer de detalhe já existente |

## 4. Prediction Factors

Fatores explicativos são uma leitura estruturada e classificada de dados
que o Prediction Engine e o Goal Distribution Engine **já calcularam**
(`featureTrace`) — nunca uma nova medição. Cada fator tem 4 campos:
`code`, `availability` (`AVAILABLE`/`MISSING`/`NOT_APPLICABLE`),
`direction` (`HOME`/`AWAY`/`NEUTRAL`) e `magnitude`/`weight` (`null`
quando não aplicável). Um fator com `availability !== "AVAILABLE"` nunca
recebe `magnitude` fabricada — permanece `null`, honestamente.

**Limitação registrada explicitamente**: o motor atual **não separa
força ofensiva e força defensiva como grandezas independentes** — ele só
calcula uma força geral (`strengthDifference`/`strength`). Por isso a
explicação usa um único fator agregado, `TEAM_STRENGTH`. Esta
documentação não sugere, em nenhum ponto, que existem dois cálculos
separados quando existe apenas um.

| Código | Significado | Origem dos dados | Direção possível | Interpretação na interface |
|---|---|---|---|---|
| `RECENT_FORM` | Forma recente das equipes | `formDifference` (Prediction Engine), com fallback para `recentForm` (Goal Distribution Engine) | HOME / AWAY / NEUTRAL | "Forma recente" no breakdown/fatores |
| `TEAM_STRENGTH` | Força geral (agregada, não dividida em ofensiva/defensiva) | `strengthDifference` (Prediction Engine), fallback `strength` (Goal Distribution Engine) | HOME / AWAY / NEUTRAL | "Força da equipe" |
| `GOALS_AVERAGE` | Tendência de gols da partida | `expectedGoals.total` (Goal Distribution Engine) | sempre NEUTRAL (não é um tilt casa/fora) | "Média de gols" |
| `HOME_AWAY_PERFORMANCE` | Desempenho relativo mandante/visitante | `homeAdvantage` (Prediction Engine), fallback `homeAwaySplit` (Goal Distribution Engine) | HOME / AWAY / NEUTRAL | "Desempenho casa/fora" |
| `HEAD_TO_HEAD` | Confronto direto | `headToHead` (Prediction Engine), fallback `headToHead` (Goal Distribution Engine) | HOME / AWAY / NEUTRAL | "Confronto direto (H2H)" |
| `SAMPLE_CONSISTENCY` | Coerência entre os dois motores | `quality.consistency.maxProbabilityDelta` | sempre NEUTRAL | "Consistência da amostra" |
| `DATA_CONFIDENCE` | Confiança geral do modelo | `confidence` (0..100, normalizado para 0..1) | sempre NEUTRAL | "Confiança dos dados" |

## 5. Confidence Breakdown

O breakdown de confiança é uma **decomposição explicativa** — reexpressa,
como percentuais, números que já existem (pesos reais de
`featureTrace[].weight`, `expectedGoals.total`, `dataSufficiency.status`,
`quality.combinedStatus`). Ele **não substitui nem recalcula** o valor
original de `confidence` retornado pelo Prediction Orchestrator.

Os 6 componentes são normalizados para somarem **exatamente 100** pelo
método do maior resto (determinístico): cada categoria recebe a parte
inteira de sua fração proporcional, e os pontos restantes (por
arredondamento) são distribuídos, em ordem, às categorias com a maior
parte fracionária. Se todos os valores brutos forem zero (nenhum dado
disponível), os 100 pontos são distribuídos igualmente entre as 6
categorias — nunca concentrados artificialmente em uma só.

| Categoria | Fonte dos dados | Finalidade | Limitações |
|---|---|---|---|
| `RECENT_FORM` | Peso real de `formDifference`/`recentForm` | Parcela de confiança atribuída à forma recente | Zero se a feature estiver indisponível |
| `GOALS_TREND` | Distância de `expectedGoals.total` até 2,5 gols (baseline neutro) | Parcela atribuída à tendência de gols | Baseline (2,5) é constante de exibição desta sprint, não um valor calibrado |
| `HOME_ADVANTAGE` | Peso real de `homeAdvantage`/`homeAwaySplit` | Parcela atribuída ao mando de campo | Zero se indisponível |
| `HEAD_TO_HEAD` | Peso real de `headToHead` | Parcela atribuída ao confronto direto | Zero se não houver amostra H2H |
| `SAMPLE_SIZE` | `dataSufficiency.status` do Prediction Engine, convertido pela mesma tabela canônica já usada pelo Green Score/Confidence Engine | Parcela atribuída ao tamanho da amostra | Reflete apenas o status do Prediction Engine, não do Goal Distribution Engine |
| `DATA_QUALITY` | `quality.combinedStatus`, mesma tabela canônica | Parcela atribuída à qualidade combinada dos dados | — |

> **Aviso**: um componente representar determinada porcentagem do
> breakdown não significa que ele seja causalmente responsável pela
> mesma porcentagem do resultado real. É uma representação explicativa
> do modelo atual.

## 6. Prediction Reasons

As razões são geradas a partir de `result.explanation.topSignals` — a
lista de sinais **já ranqueada por magnitude** pelo Prediction
Orchestrator (Sprint 4.3). A ordem das razões preserva exatamente essa
ordem; o motor de explicação nunca reordena ou filtra novamente. Cada
razão tem `rank` (posição, 1-based), `signalType`, `favors`, `magnitude`
(repassados sem alteração) e `text` — uma frase em português produzida
por um **template fixo e determinístico**, indexado por
`signalType`/`favors`. Não existe geração livre por IA nem texto
dinâmico fora desses templates; nenhum texto afirma algo que o sinal de
origem não sustente.

Exemplos genéricos de template (sem afirmar valores reais de nenhuma
partida específica):

- `RATING_ADVANTAGE` + `HOME` → "Rating consideravelmente superior do mandante"
- `FORM_ADVANTAGE` + `AWAY` → "Equipe visitante em melhor fase recente"
- `HEAD_TO_HEAD_ADVANTAGE` + `HOME` → "Histórico direto (H2H) favorece o mandante"
- `HIGH_SCORING_TREND` (sempre `NEUTRAL`) → "Tendência de partida com muitos gols"
- `LOW_SCORING_TREND` (sempre `NEUTRAL`) → "Tendência de partida com poucos gols"

Se `topSignals` estiver vazio, a lista de razões também é vazia — nunca
uma razão é fabricada sem sinal correspondente.

## 7. Risk Indicators

Os riscos só aparecem no array de saída quando a condição real que os
ativa for verdadeira — nunca uma lista fixa sempre presente com todos os
códigos.

| Código | Condição que ativa | Severidade possível | Interpretação | Não significa |
|---|---|---|---|---|
| `LOW_SAMPLE_SIZE` | `quality.combinedStatus` é `INSUFFICIENT` (→ HIGH) ou `LIMITED` (→ MEDIUM) | HIGH / MEDIUM | Amostra de dados pequena para uma das partes | Não significa que a previsão está errada — apenas que há menos evidência |
| `STALE_DATA` | Mais de 24h entre `metadata.generatedAt` e o `now` avaliado (severidade HIGH acima de 72h, MEDIUM entre 24h e 72h) | HIGH / MEDIUM | Os dados de base da previsão podem estar desatualizados | Não reavalia se algo mudou de fato no mundo real |
| `INDICATOR_CONFLICT` | `quality.consistency.level` é `MAJOR_DIVERGENCE` (→ HIGH) ou `MINOR_DIVERGENCE` (→ LOW) | HIGH / LOW | Os dois motores (resultado e distribuição de gols) discordam | Não indica qual dos dois motores está certo |
| `INSUFFICIENT_CONFIDENCE` | `confidence` abaixo de 40 (→ HIGH) ou abaixo de 60 (→ MEDIUM) | HIGH / MEDIUM | Confiança do modelo baixa/moderada | Não é uma probabilidade de erro calculada estatisticamente |
| `HIGH_VOLATILITY` | `prediction.probabilityMargin` abaixo de 0,08 | MEDIUM (fixa) | Margem estreita entre o resultado mais provável e o segundo | Não significa "jogo imprevisível" no sentido esportivo, apenas que o modelo não tem um favorito claro |
| `NO_HEAD_TO_HEAD_HISTORY` | `prediction.dataSufficiency.headToHeadSampleSize` é zero | LOW (fixa) | Não há confrontos diretos anteriores entre os jogadores | Não impede a previsão — apenas remove esse sinal específico |

Todos os thresholds numéricos acima (24h/72h, 40/60, 0,08) são
constantes documentadas em `predictionExplanationConstants.ts`,
específicas desta camada de apresentação — nunca compartilhadas com o
Prediction Orchestrator.

Um risco **não invalida automaticamente uma previsão** — ele sinaliza
cautela e deve ser lido em conjunto com Confidence, Quality e o contexto
da partida, nunca isoladamente.

## 8. Prediction Quality Score

Escala real: `A_PLUS`, `A`, `B_PLUS`, `B`, `C`, `D` (exibidos na
interface como `A+`, `A`, `B+`, `B`, `C`, `D`).

**Diferença em relação ao Green Score**: o Green Score (Prediction
Orchestrator, Sprint 4.3) mede o quão favorável é a previsão para a
aposta. O Prediction Quality Score é **independente** e nunca lê o
Green Score como entrada — mede apenas a qualidade/confiabilidade dos
dados que sustentam a previsão (quantidade de dados, confiança,
consistência entre motores), não o quão "verde" é a oportunidade.

Critério de cálculo: uma nota-base (0 a 100) é a média entre `confidence`
e `quality.combinedStatus` (convertido pela mesma tabela canônica do
Green Score/Confidence Engine), somada a um ajuste de
`quality.consistency.level` (+5 se `ALIGNED`, −5 se `MINOR_DIVERGENCE`,
−15 se `MAJOR_DIVERGENCE`) — sempre limitada a 0..100.

| Nota | Interpretação operacional |
|---|---|
| A+ | Score ≥ 90 — dados fortes, alta confiança, motores alinhados |
| A | Score ≥ 80 |
| B+ | Score ≥ 70 |
| B | Score ≥ 60 |
| C | Score ≥ 40 — qualidade de dados/confiança moderada |
| D | Score < 40 — dados fracos e/ou motores divergentes e/ou baixa confiança |

Os thresholds (90/80/70/60/40) são julgamento de engenharia desta
sprint, **ainda não calibrados por backtest**. A nota **não é uma
garantia de acerto** — mede a qualidade dos dados de entrada, não a
probabilidade de o resultado esportivo se confirmar.

## 9. API

### `GET /api/predictions/[id]/explanation`

- **Método**: GET, somente leitura.
- **Autenticação/autorização**: mesmo gate `getApiAccess("predictionCenter", ...)` usado por todos os demais endpoints de `/api/predictions*` (Sprint 8.1) — exige sessão autenticada e plano com acesso à feature `predictionCenter`.
- **Origem dos dados**: `getPersistedPredictionById(id)` (já existente, Sprint 7.4/8.0) busca o `PredictionDetail`; o motor de explicação processa `detail.snapshot` em memória.
- **Persistência**: nenhuma. **Recálculo**: nenhum.

Respostas:

| Status | Quando |
|---|---|
| `200` | Previsão encontrada — corpo é o `PredictionExplanationView` completo |
| `400` | `id` vazio |
| `404` | Nenhuma previsão encontrada com esse `id` |
| `500`/`503` | Falhas técnicas (ex.: repositório indisponível), mapeadas pela mesma função `mapErrorToResult` já usada pelos demais endpoints — mensagens sempre genéricas, nunca stack trace, causa interna ou detalhe de infraestrutura |

Exemplo de resposta (**fictício**, valores ilustrativos, sem dados reais de produção):

```json
{
  "factors": [
    { "code": "RECENT_FORM", "availability": "AVAILABLE", "direction": "HOME", "magnitude": 0.42, "weight": 0.31 },
    { "code": "TEAM_STRENGTH", "availability": "MISSING", "direction": "NEUTRAL", "magnitude": null, "weight": null }
  ],
  "confidenceBreakdown": [
    { "category": "RECENT_FORM", "percentage": 35 },
    { "category": "GOALS_TREND", "percentage": 20 },
    { "category": "HOME_ADVANTAGE", "percentage": 15 },
    { "category": "HEAD_TO_HEAD", "percentage": 10 },
    { "category": "SAMPLE_SIZE", "percentage": 12 },
    { "category": "DATA_QUALITY", "percentage": 8 }
  ],
  "reasons": [
    { "rank": 1, "signalType": "RATING_ADVANTAGE", "favors": "HOME", "magnitude": 0.6, "text": "Rating consideravelmente superior do mandante" }
  ],
  "risks": [
    { "code": "NO_HEAD_TO_HEAD_HISTORY", "severity": "LOW", "description": "Nenhum confronto direto (H2H) encontrado entre os dois jogadores." }
  ],
  "quality": { "grade": "A", "score": 84 }
}
```

## 10. Interface

A seção **"Por que esta previsão?"** aparece dentro do drawer de detalhe
já existente do Prediction History (`PredictionHistoryDetailPanel.tsx`,
Sprint 8.2), como a última seção — adicionada, nunca substituindo
nenhuma das seções anteriores (`PredictionHeader`, `PredictionSummary`,
`PredictionConfidenceCard`, `PredictionMarkets`,
`PredictionRecommendation`, `PredictionFactors`, `PredictionRiskPanel`
permanecem intactas).

- **Carregamento sob demanda**: a explicação só é buscada quando o
  drawer de detalhe de uma previsão específica é aberto — nunca para
  itens da listagem (sem N+1).
- **Estado de loading independente**: um esqueleto próprio, que não
  bloqueia nem depende do carregamento das seções anteriores do drawer.
- **Estado de erro independente**: mensagem própria, sem afetar o
  restante do drawer.
- **Seções exibidas** (títulos reais usados no código): "Qualidade da
  previsão", "Razões", "Breakdown da confiança", "Indicadores de risco".
- **Integração**: puramente aditiva — confirmado por teste automatizado
  (`predictionExplanationScope.test.mjs`) que todas as seções anteriores
  do drawer continuam presentes.

## 11. Performance

- A explicação é **derivada em memória**, dentro da própria resposta da
  rota — nenhuma consulta adicional ao banco além da já existente busca
  do snapshot (`getPersistedPredictionById`).
- Na interface, há **uma chamada HTTP adicional apenas ao abrir o
  detalhe** de uma previsão — nunca uma chamada por item da listagem.
- Nenhuma migration, nenhuma variável de ambiente nova, nenhum impacto
  no pipeline de geração da previsão (`POST /api/predictions` permanece
  inalterado).

Formulação precisa, sem afirmar custo zero: **impacto limitado e
controlado, composto pelo processamento em memória e por uma chamada
HTTP sob demanda.**

## 12. Segurança

- Mesma autorização `predictionCenter` de todos os demais endpoints de
  `/api/predictions*`.
- Rota exclusivamente `GET` — nenhum verbo de escrita implementado.
- Respostas sanitizadas: nunca stack trace, nunca `DATABASE_URL`, nunca
  credenciais, nunca `snapshotPayload` bruto (confirmado por teste
  automatizado).
- A UI (`PredictionExplanationSection.tsx`) nunca acessa Repository ou
  Prisma diretamente — consome exclusivamente `predictionApiClient.ts`,
  a mesma fronteira HTTP já usada por todo o histórico de previsões
  (Sprint 8.2).
- O acesso ao snapshot, no servidor, passa pela mesma função de consulta
  já existente (`getPersistedPredictionById`, Query Service) — nenhum
  caminho novo de acesso ao Repository foi criado.
- Nenhuma escrita no banco em nenhum ponto desta camada.

## 13. Testes

| Arquivo | Responsabilidade | Quantidade |
|---|---|---|
| `tests/predictionExplanationEngine.test.mjs` | Os 5 motores + composição (lógica pura) | 32 |
| `tests/predictionExplanationApiHandlers.test.mjs` | Handler da rota, contra o composition root real | 9 |
| `tests/predictionExplanationFormatters.test.mjs` | Cobertura dos formatadores PT-BR | 6 |
| `tests/predictionExplanationScope.test.mjs` | Auditoria estrutural (rotas existentes intocadas, sem import proibido, UI aditiva) | 7 |

Números no momento da Sprint 9.0 (podem mudar em sprints futuras):
**54 testes novos · 1756 testes totais · 1747 passando · 9 skipped · 0
falhas.**

## 14. Limitações conhecidas

- Thresholds de classificação (riscos, notas de qualidade, categorias do
  breakdown) ainda são **provisórios** — julgamento de engenharia desta
  sprint.
- **Ausência de calibração por backtest** para qualquer threshold desta
  camada.
- `TEAM_STRENGTH` é agregado (o motor não separa força ofensiva de
  defensiva).
- A explicação depende inteiramente da qualidade do `PredictionSnapshot`
  original — um snapshot com dados insuficientes gera uma explicação
  honesta sobre essa insuficiência, nunca uma explicação inventada.
- Não há explicação para informação que o motor original não calculou —
  campos indisponíveis permanecem `null`/`MISSING`, nunca preenchidos
  artificialmente.
- Risco real de **interpretação excessiva** dos percentuais do
  Confidence Breakdown (ver aviso no §5).
- O Prediction Quality Score **não é uma probabilidade de acerto**.
- Explicabilidade **não elimina a incerteza esportiva** inerente a
  qualquer previsão.

## 15. Evoluções futuras

Listadas como possibilidades — **nenhuma faz parte da Sprint 9.0.1**:

- Calibração dos thresholds por backtest histórico.
- Versionamento explícito dos thresholds (similar ao versionamento já
  usado pelo Prediction Orchestrator).
- Explicações específicas por mercado (1X2, Over/Under, BTTS).
- Comparação entre a explicação prevista e o resultado real da partida.
- Avaliação da qualidade da explicação segmentada por liga/jogador.
- Telemetria de uso da funcionalidade de explicação.
- Internacionalização (hoje, 100% português).
- Documentação pública voltada a usuários finais (este documento é
  técnico/operacional).
