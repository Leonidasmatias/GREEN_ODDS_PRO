# GREEN ODDS PRO - Production Certificate

Data da revisao: 2026-06-15
Fase: 15 - Production Certification
Status: certificacao tecnica implementada, com pendencias reais de ambiente antes de operacao em producao.

## Rotas certificadas

- `/production-certificate`
- `/api/production-certificate`
- `/audit/data`
- `/api/audit/data`
- `/health`
- `/api/health`
- `/readiness`
- `/api/readiness`
- `/go-live`
- `/api/go-live`
- `/admin`
- `/api/admin`

## Auditoria de infraestrutura

- Prisma configurado com datasource PostgreSQL via `DATABASE_URL`.
- Migration PostgreSQL presente em `prisma/migrations/20260616010000_railway_postgres_ready`.
- Migrations SQLite antigas foram preservadas em `prisma/migrations_sqlite_archive`.
- Scheduler controlado por `SCHEDULER_ENABLED`.
- Backup exige `BACKUP_DIR` ou storage externo configurado.
- Health, readiness e go-live continuam como endpoints dinamicos.
- `railway.json` define build, pre-deploy, start e healthcheck para Railway.

## Auditoria de dados

- `/audit/data` verifica dados mock/sinteticos persistidos em `Match`, `OddsSnapshot` e `Tip`.
- Dataset de treinamento exige origem em tips liquidadas.
- Historico e performance em producao nao usam mais `src/data/mockData`.
- Nenhum historico sintetico deve ser criado por esta fase.

## Auditoria de providers

- Providers licenciados usam chaves via env:
  - `ODDS_API_KEY`
  - `SPORTMONKS_API_KEY`
  - `FOOTBALL_API_KEY`
- Mock provider so fica configuravel fora de `NODE_ENV=production`.
- Failover registra chamadas em `ProviderCall` sem persistir secrets.

## Auditoria de seguranca

- Admin protegido por Basic Auth em producao via middleware.
- Credenciais exigidas: `ADMIN_USERNAME` e `ADMIN_PASSWORD`.
- Logs de scheduler/provider/sync passam por redaction para valores sensiveis conhecidos.
- A auditoria de ambiente nao imprime valores de secrets.
- Headers basicos de seguranca sao enviados pelo Next.

## Scores

- Readiness score: calculado em tempo real por `/api/go-live`.
- Production score: calculado em tempo real por `/api/production-certificate`.
- Classificacao final depende de banco, migrations aplicadas, providers, scheduler, backup, treinamento e auditoria de dados.

## Operation monitoring

- Monitoramento de operacao disponivel no certificado.
- Habilitacao por `OPERATION_MONITORING=true`.
- Janela padrao: 7 dias de `JobRun`, `ProviderCall`, `SyncRun`, settlements e performance.

## Aviso de responsabilidade

GREEN ODDS PRO trabalha com analise probabilistica, dados reais auditaveis e gestao de risco. O sistema nao promete lucro, nao promete green garantido e nao substitui responsabilidade do operador.

## Pendencias reais antes de producao

- Configurar `DATABASE_URL` PostgreSQL real.
- Executar `prisma migrate deploy` no ambiente alvo.
- Configurar pelo menos um provider licenciado.
- Definir `ADMIN_USERNAME` e `ADMIN_PASSWORD`.
- Configurar `BACKUP_DIR` ou storage externo persistente.
- Decidir se a instancia executara scheduler com `SCHEDULER_ENABLED=true`.
- Habilitar `OPERATION_MONITORING=true` se desejado.
- Confirmar dataset real suficiente para treinamento antes de ativar decisoes automatizadas.
