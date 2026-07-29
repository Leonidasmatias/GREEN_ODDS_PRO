# Calibration Methodology

Sprint 9.1 — Explainability Calibration & Backtest. Sprint 9.1.1 —
Calibration Data Integrity & Report Hardening.

Este documento descreve **como** `docs/CALIBRATION_REPORT.md` é
calculado, quais garantias de honestidade o pipeline oferece, e quais
são os limites explícitos de cada número que aparece nele. Ele não
substitui o relatório em si — é a referência para interpretar
corretamente qualquer execução futura de `npm run calibration`.

## 1. Objetivo e escopo

O módulo de calibração (`src/services/explainability-calibration/`)
existe para responder uma pergunta: **as previsões explicadas pela
Sprint 9.0 (fatores, risco, qualidade, confidence) se comportam, na
prática, como o esperado?** Ele nunca gera uma previsão nova, nunca
recalcula Green Score/Confidence/Prediction Engine, e nunca altera um
threshold de produção automaticamente. Todo o pipeline é composto de
funções puras — dado o mesmo dataset de entrada, a mesma saída é
produzida sempre.

## 2. Proveniência do dataset (`DatasetProvenance.ts`)

Toda execução do CLI tageia cada previsão usada com sua origem real:
`REAL` (veio de `PredictionSnapshotRecord` persistido no Postgres,
casado com uma partida `ESoccerMatch` finalizada) ou `SYNTHETIC` (veio
do gerador determinístico embutido em `scripts/calibration/syntheticDataset.mjs`).
A proveniência agregada do dataset é:

- **`REAL`**: 100% dos registros são reais.
- **`SYNTHETIC`**: 100% dos registros são sintéticos.
- **`MIXED`**: há pelo menos um registro de cada tipo.

Nenhum valor de proveniência é inferido — vem sempre de tags explícitas
fornecidas por quem monta o dataset (o CLI). O CLI atual (Sprint 9.1.1)
nunca mistura as duas fontes numa mesma execução: ou usa 100% dados
reais encontrados, ou cai inteiramente para o dataset sintético. A
origem `MIXED` existe no contrato para suportar, sem alteração
estrutural futura, um cenário em que dados reais insuficientes sejam
complementados por dados sintéticos — cenário que **não é implementado
nesta sprint**.

Além da origem, a proveniência registra: contagem total/real/sintética,
período coberto pelos registros válidos (`generatedAt` mais antigo e
mais recente), número de ligas e jogadores distintos, registros
válidos/descartados, e os motivos de descarte agregados (reaproveitando
os mesmos avisos já computados pela Sprint 4.5 — nenhum motivo novo é
inventado). Quando não há registros válidos, período/ligas/jogadores
aparecem como `null`/`0` — nunca um valor inventado.

## 3. Como o dado real é obtido

`scripts/calibration.mjs` tenta, em modo **somente leitura**, consultar
`PredictionSnapshotRecord` (previsões persistidas) e casar por
`matchId` com `ESoccerMatch` já `FINISHED`. Se `DATABASE_URL` não
estiver configurada, ou a consulta falhar, ou zero partidas finalizadas
forem encontradas, o CLI cai para o dataset sintético — sempre
registrando, no relatório, se a tentativa de consulta real chegou a
acontecer (`realDataAttempted`). Essa distinção importa para o status
geral do relatório (Seção 6).

## 4. Constantes de amostra mínima (isoladas desta sprint)

Duas constantes, definidas em `RecommendationEligibility.ts`, controlam
a elegibilidade de qualquer leitura estatística. Elas **nunca são
thresholds de produção** — não vivem em
`predictionExplanationConstants.ts`, não afetam nenhuma previsão real,
e só existem para decidir se uma amostra é grande o suficiente para ser
lida como algo além de uma demonstração técnica:

- `MIN_SAMPLE_FOR_OBSERVATIONAL_READING = 10`: abaixo disto, nenhuma
  leitura estatística é considerada, nem mesmo observacional.
- `MIN_SAMPLE_FOR_ELIGIBLE_REVIEW = 30`: abaixo disto (com dado real
  puro), a leitura permanece observacional — não é considerada pronta
  para revisão humana como possível ajuste de produção.

Separadamente, `ThresholdOptimizer.ts` mantém sua própria constante,
`MIN_SAMPLE_PER_SIDE = 5`: o número mínimo de registros exigido em cada
lado de um ponto de corte candidato para que ele seja sequer
considerado — não é a mesma constante das anteriores porque resolve um
problema diferente (evitar overfitting a um único ponto de corte, não
decidir se o dataset inteiro é grande o bastante para ter voz).

## 5. Política de elegibilidade de recomendação (`RecommendationEligibility.ts`)

Cada sugestão de threshold recebe uma de quatro classificações:

| Elegibilidade | Quando ocorre |
|---|---|
| `DEMONSTRATION_ONLY` | Origem do dataset é `SYNTHETIC` — sempre, qualquer que seja o tamanho da amostra. |
| `INSUFFICIENT_SAMPLE` | Amostra abaixo de `MIN_SAMPLE_FOR_OBSERVATIONAL_READING`, mesmo com dado real. |
| `OBSERVATIONAL` | Dataset `MIXED` com amostra suficiente (nunca sobe a `ELIGIBLE_FOR_REVIEW`, mesmo com muitos registros); ou dataset `REAL` com amostra entre os dois limites. |
| `ELIGIBLE_FOR_REVIEW` | Dataset `REAL` puro com amostra >= `MIN_SAMPLE_FOR_ELIGIBLE_REVIEW`. |

Apenas `OBSERVATIONAL` e `ELIGIBLE_FOR_REVIEW` podem aparecer na Seção
8 do relatório ("Resultado operacional"). `DEMONSTRATION_ONLY` e
`INSUFFICIENT_SAMPLE` só podem aparecer na Seção 9 ("Demonstração
técnica do otimizador").

## 6. Status geral do relatório (`ReportStatus.ts`)

Um único valor resume a execução inteira, computado exclusivamente a
partir da proveniência — nunca digitado à mão em nenhum lugar:

| Status | Condição |
|---|---|
| `BLOCKED_NO_REAL_DATA` | Origem `SYNTHETIC` **e** uma consulta real foi tentada (não encontrou nada). |
| `DEMONSTRATION` | Origem `SYNTHETIC` **e** nenhuma consulta real foi tentada. |
| `BLOCKED_INSUFFICIENT_SAMPLE` | Origem `REAL`/`MIXED` com amostra válida abaixo de `MIN_SAMPLE_FOR_OBSERVATIONAL_READING`. |
| `OBSERVATIONAL` | Origem `MIXED` com amostra suficiente; ou origem `REAL` com amostra abaixo de `MIN_SAMPLE_FOR_ELIGIBLE_REVIEW`. |
| `READY_FOR_HUMAN_REVIEW` | Origem `REAL` pura com amostra >= `MIN_SAMPLE_FOR_ELIGIBLE_REVIEW`. |

Em nenhum status o relatório aplica qualquer alteração de produção —
"pronto para revisão humana" significa exatamente isso: pronto para um
humano olhar, nunca para um script aplicar.

## 7. Metodologia do otimizador de threshold (`ThresholdOptimizer.ts`)

Para cada parâmetro numérico (ex.: `HIGH_VOLATILITY_MARGIN_THRESHOLD`),
o otimizador testa cada valor distinto presente na amostra como ponto
de corte candidato, divide a amostra em "abaixo" e "acima/igual", e
escolhe o candidato que maximiza `|acurácia(acima) - acurácia(abaixo)|`
— desde que ambos os lados tenham pelo menos `MIN_SAMPLE_PER_SIDE`
registros. É busca exaustiva sobre estatística simples — **nunca**
Machine Learning, **nunca** um teste de hipótese formal (sem p-value,
sem intervalo de confiança). Quando nenhuma sugestão numérica é
possível, o resultado sempre explica o motivo (nunca omite
silenciosamente):

- `NO_VARIATION`: o parâmetro tem um único valor distinto em toda a
  amostra — não há nenhum ponto de corte para testar.
- `SINGLE_OUTCOME_CLASS`: todos os registros têm o mesmo resultado
  (todos corretos ou todos incorretos) — não há variação a ser
  explicada por nenhum threshold.
- `INSUFFICIENT_SAMPLE`: existe variação, mas nenhum candidato reúne o
  mínimo de registros em ambos os lados.
- `RECOMMENDED`: um candidato viável foi encontrado.

## 8. `evidenceScore` — o que é e o que não é

`evidenceScore` (0-95) é uma função crescente e saturada do tamanho
total da amostra: `50 + min(45, amostra * 1.5)`, arredondado, nunca
excedendo 95. **Não é**:

- Um p-value.
- Um intervalo de confiança.
- Uma probabilidade de o efeito observado ser real.
- Qualquer forma de significância estatística formal.

**É apenas**: "quantos registros sustentam este número" — nada mais.
O nome anterior deste campo (`recommendationConfidence`, Sprint 9.1) foi
deliberadamente abandonado na Sprint 9.1.1 por sugerir rigor estatístico
que a heurística nunca teve.

## 9. Estrutura do relatório: operacional vs. demonstração técnica

`docs/CALIBRATION_REPORT.md` separa, sempre, duas seções com propósitos
diferentes:

- **Seção 8 — Resultado operacional**: só existe conteúdo aqui quando o
  status geral permite (`OBSERVATIONAL` ou `READY_FOR_HUMAN_REVIEW`).
  Em qualquer status bloqueado (`BLOCKED_NO_REAL_DATA`,
  `BLOCKED_INSUFFICIENT_SAMPLE`) ou puramente demonstrativo
  (`DEMONSTRATION`), esta seção mostra uma mensagem explícita de bloqueio
  — nunca uma tabela de números.
- **Seção 9 — Demonstração técnica do otimizador**: sempre presente,
  sempre rotulada como não-operacional, mostra o resultado bruto do
  otimizador para todos os parâmetros (inclusive os casos
  `NO_VARIATION`/`SINGLE_OUTCOME_CLASS`/`INSUFFICIENT_SAMPLE`) — existe
  para tornar o mecanismo auditável, nunca para informar uma decisão de
  produção, mesmo quando os dados de origem são reais.

O resumo executivo (Seção 1) sempre declara, antes de qualquer tabela:
origem dos dados, status geral, se existem recomendações operacionais
nesta execução, e que nenhuma alteração de produção é permitida a
partir do relatório.

## 10. Garantias de honestidade

- Nenhum threshold de `predictionExplanationConstants.ts` é lido
  automaticamente por este módulo — os valores "atuais" vêm sempre
  explicitamente do chamador, para nunca acoplar silenciosamente a
  produção viva ao processo de calibração.
- Nenhum threshold é alterado, em nenhuma hipótese, por este relatório.
- Nenhuma previsão é recalculada — todos os dados vêm de snapshots já
  persistidos (Sprint 8.3) e de explicações já geradas (Sprint 9.0).
- `docs/CALIBRATION_REPORT.md` só pode ser atualizado executando
  `npm run calibration` — nunca editado manualmente.
- Métricas com amostra vazia ou unilateral nunca aparecem como um
  percentual "seco" — sempre como `N/A (sem amostra)` ou equivalente.

## 11. Como regenerar o relatório

```
npm run calibration
```

Isso executa `scripts/calibration.mjs`, que tenta um dataset real, cai
para o sintético se necessário, roda o backtest completo, e sobrescreve
`docs/CALIBRATION_REPORT.md`. Nenhuma variável de ambiente além de
`DATABASE_URL` (opcional) é necessária. O script nunca escreve no banco
e nunca toca Railway/git.
