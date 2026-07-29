# Calibration Report — Explainability

Sprint 9.1 — Explainability Calibration & Backtest. Sprint 9.1.1 —
Calibration Data Integrity & Report Hardening. Relatório gerado
automaticamente por `npm run calibration` (`scripts/calibration.mjs`).
**Nenhum threshold de produção foi alterado por este relatório** — todos
os valores em `src/services/prediction-explanation/predictionExplanationConstants.ts`
permanecem exatamente como estavam antes desta execução.

Gerado em: 2026-07-29T03:19:12.460Z

## 1. Resumo executivo

- Origem dos dados: **Dataset sintético de demonstração** — Dataset sintético embutido neste script, gerado apenas para demonstrar o pipeline de backtest — não representa partidas reais.
- Status geral do relatório: **Demonstração (sem tentativa de dado real)**
- Existem recomendações operacionais nesta execução: **não**
- Alterações de produção permitidas a partir deste relatório: **Não — nenhum relatório de calibração aplica alterações de produção automaticamente, em nenhum status.**
- Status da avaliação (join/validação): **OK**
- Registros válidos analisados: **40**
- Acurácia global observada: **40.0%**

## 2. Dataset e proveniência

- Identificador: `synthetic-demo`
- Origem computada: **SYNTHETIC** (0 registro(s) reais, 40 registro(s) sintéticos, de 40 previsões fornecidas)
- Consulta a dado real tentada nesta execução: não
- Previsões fornecidas: 40
- Resultados reais fornecidos: 40
- Registros casados (previsão + resultado): 40
- Registros válidos (após validação estrutural): 40
- Registros ignorados/descartados: 0
- Motivos de descarte: nenhum
- Período coberto (registros válidos): 2026-01-01T00:00:00.000Z a 2026-01-02T15:00:00.000Z
- Ligas distintas: 3
- Jogadores distintos: 12

## 3. Distribuição e avisos

Avisos encontrados durante o join/validação: nenhum.
Registros rejeitados: 0.

## 4. Confidence

| Faixa de Confidence | Amostra | Acurácia real | Status |
|---|---|---|---|
| 0-20 | 3 | 33.3% | Amostra insuficiente |
| 20-40 | 10 | 30.0% | OK |
| 40-60 | 10 | 30.0% | OK |
| 60-80 | 10 | 50.0% | OK |
| 80-100 | 7 | 57.1% | OK |

## 5. Quality

Escala monotonicamente calibrada (A+ >= A >= ... >= D, com tolerância, considerando apenas notas com amostra suficiente): **não confirmada com os dados atuais**.

| Nota | Amostra | Acurácia real |
|---|---|---|
| A+ | 5 | 20.0% |
| A | 3 | 100.0% |
| B+ | 2 | 50.0% |
| B | 8 | 50.0% |
| C | 15 | 33.3% |
| D | 7 | 28.6% |

## 6. Risk

| Código | Frequência | Acurácia com risco | Acurácia sem risco | Impacto |
|---|---|---|---|---|
| LOW_SAMPLE_SIZE | 15 (37.5%) | 40.0% | 40.0% | +0.0pp |
| STALE_DATA | 40 (100.0%) | 40.0% | N/A (sem amostra) | N/A (sem amostra em um dos lados) |
| INDICATOR_CONFLICT | 18 (45.0%) | 44.4% | 36.4% | -8.1pp |
| INSUFFICIENT_CONFIDENCE | 23 (57.5%) | 30.4% | 52.9% | +22.5pp |
| HIGH_VOLATILITY | 12 (30.0%) | 83.3% | 21.4% | -61.9pp |
| NO_HEAD_TO_HEAD_HISTORY | 10 (25.0%) | 60.0% | 33.3% | -26.7pp |

Impacto positivo indica que o risco de fato correlaciona com acurácia menor nos dados observados (comportamento esperado de um risco genuíno).

## 7. Factor Importance

| Fator | Amostra disponível | Acurácia quando disponível | Acurácia quando indisponível | Impacto |
|---|---|---|---|---|
| RECENT_FORM | 32 | 34.4% | 62.5% | -28.1pp |
| TEAM_STRENGTH | 32 | 34.4% | 62.5% | -28.1pp |
| GOALS_AVERAGE | 40 | 40.0% | N/A (sem amostra) | N/A (sem amostra em um dos lados) |
| HOME_AWAY_PERFORMANCE | 32 | 34.4% | 62.5% | -28.1pp |
| HEAD_TO_HEAD | 30 | 33.3% | 60.0% | -26.7pp |
| SAMPLE_CONSISTENCY | 40 | 40.0% | N/A (sem amostra) | N/A (sem amostra em um dos lados) |
| DATA_CONFIDENCE | 40 | 40.0% | N/A (sem amostra) | N/A (sem amostra em um dos lados) |

## 8. Resultado operacional

Status geral do relatório: **Demonstração (sem tentativa de dado real)**.

Esta execução não tentou consultar dados reais (nenhum `DATABASE_URL` configurado, ou execução explicitamente em modo demonstração). O resultado abaixo é inteiramente sintético — ver Seção 9 (Demonstração técnica do otimizador). Nenhuma recomendação operacional existe nesta execução.

## 9. Demonstração técnica do otimizador

**Esta seção nunca representa uma recomendação de produção — mesmo quando a amostra é real.** Ela existe apenas para tornar o mecanismo do otimizador auditável: mostra, para cada parâmetro, exatamente o que o cálculo produziu, incluindo os casos em que nenhuma sugestão numérica foi possível. Sugestões aqui só podem informar produção depois de passar pela Seção 8 (Resultado operacional) e por revisão humana explícita.

### HIGH_VOLATILITY_MARGIN_THRESHOLD

- **Current**: 0.08
- **Amostra analisada**: 40 registros
- **Resultado do otimizador**: Sugestão encontrada
- **Valor sugerido pelo otimizador**: 0.08
- **Separação de acurácia**: 61.9pp
- **Evidence score**: 95/100
- **Detalhe**: Acurácia observada é 61.9 pontos percentuais maior abaixo deste valor, com 40 registros analisados.

### INSUFFICIENT_CONFIDENCE_HIGH_THRESHOLD

- **Current**: 40
- **Amostra analisada**: 40 registros
- **Resultado do otimizador**: Sugestão encontrada
- **Valor sugerido pelo otimizador**: 35
- **Separação de acurácia**: 40.0pp
- **Evidence score**: 95/100
- **Detalhe**: Acurácia observada é 40.0 pontos percentuais maior acima deste valor, com 40 registros analisados.

### INSUFFICIENT_CONFIDENCE_MEDIUM_THRESHOLD

- **Current**: 60
- **Amostra analisada**: 40 registros
- **Resultado do otimizador**: Sugestão encontrada
- **Valor sugerido pelo otimizador**: 35
- **Separação de acurácia**: 40.0pp
- **Evidence score**: 95/100
- **Detalhe**: Acurácia observada é 40.0 pontos percentuais maior acima deste valor, com 40 registros analisados.

### QUALITY_GRADE_A_PLUS_MIN_SCORE

- **Current**: 90
- **Amostra analisada**: 40 registros
- **Resultado do otimizador**: Sugestão encontrada
- **Valor sugerido pelo otimizador**: 43
- **Separação de acurácia**: 22.9pp
- **Evidence score**: 95/100
- **Detalhe**: Acurácia observada é 22.9 pontos percentuais maior acima deste valor, com 40 registros analisados.


## 10. Conclusões

Status "Demonstração (sem tentativa de dado real)": este relatório não sustenta nenhuma conclusão operacional. As tabelas acima refletem exatamente os dados fornecidos (reais, sintéticos, ou a ausência deles), sem extrapolação.

## 11. Limitações

- Todos os thresholds recomendados são heurísticas estatísticas simples (separação de acurácia por threshold), nunca Machine Learning, nunca um teste de hipótese formal.
- `evidenceScore` é uma heurística baseada em tamanho de amostra, não um p-value, não um intervalo de confiança, não uma probabilidade de o efeito ser real.
- Este relatório nunca altera nenhum arquivo de configuração de produção.
- Resultados com amostra pequena são estatisticamente ruidosos — nunca devem ser interpretados como definitivos.
- Nenhuma previsão foi recalculada para gerar este relatório — todos os dados vêm de snapshots já persistidos.
- Dataset com origem `MIXED` nunca é elegível para revisão como ajuste de produção (Seção 8), mesmo com amostra grande — apenas leitura observacional.
- Ver `docs/CALIBRATION_METHODOLOGY.md` para a metodologia completa (fórmulas, limites de amostra, política de elegibilidade).
