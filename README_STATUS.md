# GREEN_ODDS_PRO - README_STATUS

Snapshot oficial salvo em: 2026-06-16

## Projeto

- Nome: GREEN_ODDS_PRO
- Ambiente alvo: Producao Railway
- Banco: PostgreSQL Railway
- Provider real prioritario: The Odds API
- Mock em producao: desativado via `ALLOW_MOCK_PROVIDER=false`
- Dados simulados: removidos do fluxo de producao; engines usam odds/resultados reais persistidos

## Estado Git

- Branch: `main`
- Remoto: `origin/main`
- Commit atual: `4f14b7dfa3b8b2065a2d606692ed730ca3ee880d`
- Commit curto: `4f14b7d`
- Ultimos commits:
  - `4f14b7d feat: phase 18 settlement engine`
  - `0a9dbf2 feat: phase 17 value engine`
  - `8b7a4f2 feat: production certification phase 16`
  - `08afff7 fix: avoid duplicate npm ci on railway`
  - `b8d14c3 fix: remove railway engine strict build flag`

## Deploy Railway

- Ambiente: `cooperative-art / production`
- Status do commit: `success`
- Status do deployment: `success`
- Deployment ID: `5075425459`
- Criado em: `2026-06-16T06:32:29Z`
- Atualizado em: `2026-06-16T06:34:47Z`
- Painel: https://railway.com/project/025c80d0-cade-4a1e-9a32-f3f0260cae4f?environmentId=2c8e35c2-fd0f-4860-9d7c-44ce7454273b

## Status Das Fases

- Phase 17 Value Engine: concluida e implantada
- Phase 18 Settlement Engine: pronta para deploy/aprovacao operacional; deployment Railway registrado como `success`
- Proxima fase: Phase 19 - Smart Ranking Engine

## Migrations

Migrations criadas e versionadas:

- `20260616010000_railway_postgres_ready`
- `20260616023000_phase17_value_engine`
- `20260616050000_phase18_settlement_engine`

Confirmacao:

- `prisma validate`: OK em schema local
- `prisma generate`: OK
- `npm run build`: OK
- Railway executa `npm run db:deploy` no pre-deploy
- Como o deployment Railway do commit `4f14b7d` ficou `success`, as migrations foram aceitas no fluxo de producao

## Variaveis Obrigatorias

- `DATABASE_URL`
- `NODE_ENV=production`
- `ALLOW_MOCK_PROVIDER=false`
- `SCHEDULER_ENABLED=true`
- `ODDS_SYNC_INTERVAL_MINUTES`
- `RESULTS_SYNC_INTERVAL_MINUTES`
- `SETTLEMENT_SYNC_INTERVAL_MINUTES`
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

## Snapshot Tecnico

- Framework: Next.js 15
- Runtime: Node.js >= 20
- ORM: Prisma 6
- Banco: PostgreSQL
- Arquivos rastreados no snapshot de codigo: 145, excluindo `node_modules`, `.next` e backups locais
- Build command Railway: `npm run build`
- Pre-deploy Railway: `npm run db:deploy`
- Start command Railway: `npm run start`
- Healthcheck Railway: `/api/health`

## Pendencias Reais

- Confirmar no painel Railway os valores reais das variaveis secretas, sem expor chaves.
- Acompanhar primeiras execucoes reais do job `SETTLEMENT_SYNC`.
- Aguardar resultados reais suficientes para liberar classificacoes fortes baseadas em amostra liquidada.
- Phase 19 deve usar somente `TipResult`, `MarketPerformance` e `TrainingDataset` reais.

## Proxima Retomada

PROJECT_STATE = SAVED
NEXT_PHASE = 19
RESUME_POINT = SMART_RANKING_ENGINE
