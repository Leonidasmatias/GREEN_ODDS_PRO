# GREEN ODDS PRO - Railway + PostgreSQL

## 1. Criar o projeto

1. Crie um projeto no Railway.
2. Adicione um servico a partir deste repositorio.
3. Adicione o plugin PostgreSQL ao mesmo projeto.
4. No servico Node, referencie a `DATABASE_URL` fornecida pelo PostgreSQL.

O schema Prisma usa `provider = "postgresql"`. A baseline PostgreSQL esta em `prisma/migrations/20260616010000_railway_postgres_ready`.

## 2. Variaveis obrigatorias

Configure no servico Railway:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
ALLOW_MOCK_PROVIDER=false
SCHEDULER_ENABLED=true
ODDS_SYNC_INTERVAL_MINUTES=15
RESULTS_SYNC_INTERVAL_MINUTES=15
ADMIN_USERNAME=<set-in-railway>
ADMIN_PASSWORD=<set-in-railway>
BACKUP_DIR=<set-in-railway-or-persistent-volume-path>
OPERATION_MONITORING=true
```

Configure pelo menos um provider licenciado:

```text
ODDS_API_KEY=<set-if-used>
FOOTBALL_API_KEY=<set-if-used>
SPORTMONKS_API_KEY=<set-if-used>
ODDS_PROVIDER_PRIORITY=the-odds-api,sportmonks,api-football
COMPETITION_FILTER=ALL
```

Nunca envie as chaves ao repositorio ou aos logs.

## 3. Comandos Railway

Esses comandos estao declarados em `railway.json`:

- Build command: `npm ci && npm run build`
- Pre-deploy command: `npm run db:deploy`
- Start command: `npm run start`
- Health check path: `/api/health`

O script `postinstall` executa `prisma generate`. O `db:deploy` aplica migrations pendentes sem criar migrations em producao.

## 4. Scheduler e replicas

Apenas uma instancia deve executar jobs internos.

- Instancia principal: `SCHEDULER_ENABLED=true`
- Replicas HTTP adicionais: `SCHEDULER_ENABLED=false`

Nao escale horizontalmente a instancia com scheduler ativo sem implementar lock distribuido. Caso use multiplas replicas, crie um servico worker separado com scheduler ativo e deixe o web service com scheduler desativado.

## 5. Backup

O filesystem comum do Railway nao deve ser tratado como backup permanente.

- Configure `BACKUP_DIR` somente se houver volume persistente anexado.
- Para operacao real, envie backups para storage externo como S3 ou Cloudflare R2.
- Use tambem backups nativos do PostgreSQL Railway.

## 6. Health check

Configure o health check do Railway para:

```text
/api/health
```

Status RED responde HTTP 503. YELLOW responde HTTP 200, mas exige revisao em `/go-live`.

Verifique depois do deploy:

- `/health`
- `/jobs`
- `/provider-health`
- `/readiness`
- `/go-live`
- `/admin` com autenticacao

## 7. Migracao de dados SQLite

A baseline PostgreSQL cria um banco Railway novo. Ela nao importa automaticamente `prisma/dev.db`.

Para migrar dados existentes:

1. Exporte as tabelas SQLite em CSV/JSON.
2. Aplique `npm run db:deploy` no PostgreSQL vazio.
3. Importe preservando IDs e ordem de dependencias.
4. Valide contagens, FKs, tips liquidadas e dataset.
5. Nao importe dados mockados ou sinteticos.

As migrations SQLite anteriores foram preservadas em `prisma/migrations_sqlite_archive` apenas para auditoria.

## 8. Checklist final

- `npm run lint`, `npm run build`, `npm run db:generate` e `npx prisma validate` executados localmente/CI.
- PostgreSQL conectado em `/go-live`.
- `ALLOW_MOCK_PROVIDER=false`.
- Provider licenciado configurado e saudavel.
- Um unico scheduler ativo.
- Jobs `ODDS_SYNC` e `RESULTS_SYNC` com sucesso.
- Admin protegido.
- Backup externo testado.
- Nenhum segredo em logs.

As previsoes sao probabilisticas. O sistema nao promete lucro nem garante green.
