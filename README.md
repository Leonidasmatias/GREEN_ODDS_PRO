# GREEN ODDS PRO

Radar inteligente para odds com valor estatistico.

Aplicacao Next.js, TypeScript, Prisma e PostgreSQL para analise probabilistica de jogos, providers licenciados, auditoria operacional e certificacao de producao. O projeto nao usa scraping, nao promete lucro e nao garante green.

## Deploy no Railway

O projeto esta preparado para Railway com PostgreSQL gerenciado.

Scripts principais:

```bash
npm run build
npm run start
npm run db:generate
npm run db:deploy
npm run health:check
```

Configurar as variaveis a partir de `.env.railway.example`. O Railway deve fornecer `DATABASE_URL` pelo plugin PostgreSQL.

O arquivo `railway.json` ja declara os comandos recomendados:

- Build command: `npm ci && npm run build`
- Pre-deploy command: `npm run db:deploy`
- Start command: `npm run start`
- Health check path: `/api/health`

## Banco e migrations

O Prisma usa PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

A baseline PostgreSQL esta em `prisma/migrations/20260616010000_railway_postgres_ready`. As migrations antigas de SQLite foram preservadas apenas para auditoria em `prisma/migrations_sqlite_archive`.

## Variaveis essenciais

- `DATABASE_URL`
- `NODE_ENV=production`
- `ALLOW_MOCK_PROVIDER=false`
- `SCHEDULER_ENABLED=true` em apenas uma instancia/worker
- `ODDS_SYNC_INTERVAL_MINUTES`
- `RESULTS_SYNC_INTERVAL_MINUTES`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `BACKUP_DIR` ou storage externo equivalente
- Pelo menos uma chave licenciada: `ODDS_API_KEY`, `SPORTMONKS_API_KEY` ou `FOOTBALL_API_KEY`

Nenhuma chave real deve ser versionada.

## Rotas de producao

- `/health` e `/api/health`
- `/readiness` e `/api/readiness`
- `/go-live` e `/api/go-live`
- `/production-certificate` e `/api/production-certificate`
- `/audit/data` e `/api/audit/data`
- `/admin` protegido por Basic Auth em producao

## Producao e seguranca

- Mock provider e bloqueado em `NODE_ENV=production`.
- Historico e performance de producao usam somente dados persistidos no banco.
- Logs passam por redaction para evitar exposicao de secrets.
- Scheduler pode ser ligado/desligado por `SCHEDULER_ENABLED`.
- Headers basicos de seguranca sao definidos em `next.config.ts`.

## Responsabilidade

As analises sao probabilisticas. O sistema nao cria historico sintetico em producao, nao promete lucro e nao garante green. Use apenas com providers licenciados e gestao responsavel.
