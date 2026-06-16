# ROADMAP_FASES - GREEN_ODDS_PRO

## Fases Concluidas Recentes

### Phase 16 - Production Certification

- Certificacao operacional de producao.
- Health, readiness, go-live e auditorias.
- Railway/PostgreSQL prontos para operacao.

### Phase 17 - Value Engine Profissional

- Analise estatistica de odds reais.
- Edge, EV, risco, score e classificacao.
- Auditoria persistida.
- Sem probabilidade inventada.
- Sem promessa de lucro ou green garantido.

### Phase 18 - Settlement Engine + Aprendizado Real

- Motor de liquidacao com resultado real.
- Tips aprovadas criadas como `PENDING`.
- TipResult, SettlementRun e MarketPerformance.
- Aprendizado com `WON`, `LOST` e `VOID` reais.
- Performance por mercado baseada em liquidações.

## Proxima Retomada

### Phase 19 - Smart Ranking Engine

Objetivo:

- Criar ranking inteligente baseado somente em resultados liquidados e performance real.

Escopo:

- Ranking por ROI real.
- Ranking por win rate real.
- Confianca historica por mercado, selecao, provider, bookmaker e faixa de odd.
- Score adaptativo com peso maior para mercados liquidados.
- Carteira automatica de oportunidades.
- Classificacao baseada em `TipResult` e `MarketPerformance`.
- Bloqueio de rankings fortes quando houver amostra insuficiente.

Fontes permitidas:

- `Tip`
- `TipResult`
- `MarketPerformance`
- `TrainingDataset`
- `OddsSnapshot`
- `ValueAnalysis`

Regras:

- Nao usar dados simulados.
- Nao criar historico fake.
- Nao prometer lucro.
- Nao prometer green garantido.
- Sem resultado real, manter oportunidade fora do ranking de performance.

Entregaveis esperados:

- `src/services/smartRankingEngine.ts`
- Tipos em `src/lib/rankingTypes.ts`
- Atualizacao do Radar Green.
- Atualizacao do Dashboard.
- Atualizacao de Performance ML.
- Auditoria de ranking.
- Job opcional `RANKING_REFRESH`.

## Estado Para Retomada

PROJECT_STATE = SAVED
NEXT_PHASE = 19
RESUME_POINT = SMART_RANKING_ENGINE
