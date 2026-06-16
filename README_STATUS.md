# GREEN_ODDS_PRO - README_STATUS

Snapshot oficial salvo em: 2026-06-16

## Projeto

- Nome: GREEN_ODDS_PRO
- Ambiente alvo: Producao Railway
- Banco: PostgreSQL Railway
- Provider real prioritario: The Odds API
- Mock em producao: desativado
- Dados sinteticos/mock: nao utilizados nos motores de producao
- Phase 28 base commit: `e6bcd13cdcfbe748a849205d07f511bb176266ab`

## Status Atual

- Phase 17 Value Engine: concluida
- Phase 18 Settlement Engine: concluida
- Phase 19 Smart Ranking Engine: concluida
- Phase 20 Smart Confidence Engine: concluida
- Phase 21 Machine Learning Real: concluida
- Phase 22 Auto Discovery Engine: concluida
- Phase 23 Portfolio & Bankroll Engine: concluida
- Phase 24 Risk Shield & Exposure Control: concluida
- Phase 25 Performance Attribution Engine: concluida
- Phase 26 Adaptive Strategy Engine: concluida
- Phase 27 Operations Intelligence & Data Quality: concluida
- Phase 28 Real Result Collector + Auto Settlement: concluida

## Componentes Operacionais

- PostgreSQL Railway operacional
- Provider The Odds API ativo
- RESULT_SYNC implementado
- Settlement Engine operacional
- Smart Confidence operacional
- ML Engine operacional
- Adaptive Strategy operacional
- Data Quality operacional
- Sistema aguardando crescimento organico da base real de resultados `WON`, `LOST` e `VOID`

## Phase 28

Arquivos principais:

- `prisma/migrations/20260616160000_phase28_real_result_collector/migration.sql`
- `src/services/resultCollectorEngine.ts`
- `src/services/schedulerService.ts`

Tabelas:

- `match_results`
- `result_sync_runs`
- `settlement_audits`

Job:

- `RESULT_SYNC`

Regra operacional:

- Nenhum `TipResult` e criado sem resultado final real vindo de provider licenciado.
- Se o resultado nao existir, o fluxo permanece `PENDING`.

## Variaveis Obrigatorias

- `DATABASE_URL`
- `NODE_ENV=production`
- `ALLOW_MOCK_PROVIDER=false`
- `SCHEDULER_ENABLED=true`
- `ODDS_SYNC_INTERVAL_MINUTES`
- `RESULTS_SYNC_INTERVAL_MINUTES`
- `OPERATION_MONITORING=true`
- `BACKUP_DIR`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ODDS_API_KEY`
- `ODDS_PROVIDER_PRIORITY=the-odds-api,sportmonks,api-football`
- `COMPETITION_FILTER`

Opcionais conforme providers auxiliares:

- `FOOTBALL_API_KEY`
- `SPORTMONKS_API_KEY`

## Endpoints Certificados

- `/api/health`
- `/api/readiness`
- `/api/go-live`
- `/api/production-certificate`
- `/api/provider-health`
- `/api/sync/odds`
- `/api/settle`
- `/api/jobs`
- `/api/model-performance`
- `/api/green-ai-report`
- `/api/performance`
- `/api/audit`
- `/api/audit/data`

## Pagina Institucional

- `/about`

## Assinatura Institucional

Criado por:

Leônidas Matias

Supervisor de Telecomunicações  
Engenheiro Eletricista

GREEN ODDS PRO  
Inteligencia estatistica para analise de odds com dados reais.

Contato:

- E-mail: [leonidasmatias81@gmail.com](mailto:leonidasmatias81@gmail.com)
- Telefone: +55 11 93729-9687

## Pendencias Reais

- Acompanhar crescimento organico de resultados liquidados reais.
- Confirmar ciclos de `RESULT_SYNC` em producao apos cada rodada finalizada.
- Liberar sinais mais fortes somente quando houver amostra real suficiente.
- Manter mock desativado em producao.
- Monitorar Railway deployment e migrations no pre-deploy.

## Proxima Retomada

PROJECT_STATE = SAVED  
NEXT_PHASE = 29  
RESUME_POINT = ELITE_SIGNAL_ENGINE
