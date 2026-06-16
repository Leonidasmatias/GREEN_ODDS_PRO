# STATUS_PRODUCAO - GREEN_ODDS_PRO

Atualizado em: 2026-06-16

## Ambiente

- Plataforma: Railway
- Ambiente: `cooperative-art / production`
- Banco: PostgreSQL Railway
- Provider ativo: The Odds API
- Branch implantada: `main`
- Commit implantado: `4f14b7dfa3b8b2065a2d606692ed730ca3ee880d`

## Status Geral

- Railway: `success`
- PostgreSQL: operacional no fluxo Railway; migrations aceitas pelo pre-deploy
- Prisma schema: valido
- Build de producao: aprovado
- Mock em producao: desativado
- Dados simulados: fora do fluxo de producao
- Promessa de lucro/green garantido: nao existe no produto

## Fases Implantadas

### Phase 17 - Value Engine

Status: concluida e implantada.

Entregas:

- Analise de odds reais persistidas.
- Calculo de probabilidade implicita, margem, fair odds, probabilidade estimada, edge, EV, risco, score e classificacao.
- Auditoria de odds analisadas, aprovadas, rejeitadas e motivos.
- Persistencia em `value_analyses`.

### Phase 18 - Settlement Engine

Status: pronta para deploy/aprovacao operacional; deployment Railway `success`.

Entregas:

- Tabelas `TipResult`, `SettlementRun`, `MarketPerformance`.
- Motor de liquidacao real em `settlementEngine`.
- Tips aprovadas pelo Value Engine entram como `PENDING`.
- Resultado `WON`, `LOST` ou `VOID` somente com resultado real persistido.
- Sem resultado real, status permanece `PENDING`.
- Aprendizado real alimentado por liquidações verificaveis.

## Migrations De Producao

- `20260616010000_railway_postgres_ready`
- `20260616023000_phase17_value_engine`
- `20260616050000_phase18_settlement_engine`

## Endpoints Operacionais

- Health: `/api/health`
- Readiness: `/api/readiness`
- Go-live: `/api/go-live`
- Certificado de producao: `/api/production-certificate`
- Provider health: `/api/provider-health`
- Sync odds: `/api/sync/odds`
- Settlement: `/api/settle`
- Jobs: `/api/jobs`
- Performance: `/api/performance`
- Model performance: `/api/model-performance`
- AI report: `/api/green-ai-report`

## Jobs

- `ODDS_SYNC`
- `SETTLEMENT_SYNC`
- `PERFORMANCE_UPDATE`
- `TRAINING_DATASET`
- `DATA_QUALITY`
- `BACKUP`

## Pendencias Reais

- Monitorar primeira janela completa de odds reais + resultados reais.
- Confirmar volume minimo por mercado antes de liberar rankings fortes.
- Confirmar backups em storage persistente Railway.
- Registrar evidencias de `SETTLEMENT_SYNC` em `JobRun`.
- Garantir que `ALLOW_MOCK_PROVIDER` permaneça falso em producao.

## Veredito

PHASE_18_DEPLOY_READY
