# GREEN ODDS PRO - Production Checklist

Este checklist prepara o deploy real com PostgreSQL, providers licenciados e operacao continua. As previsoes do sistema sao probabilisticas; nao existe promessa de lucro nem green garantido.

## 1. PostgreSQL

- Criar um banco PostgreSQL gerenciado no Railway.
- Copiar a `DATABASE_URL` gerada pelo Railway para as variaveis do servico Node.
- Confirmar que `prisma/schema.prisma` usa `provider = "postgresql"`.
- Rodar migrations no deploy com:

```bash
npm run db:deploy
```

## 2. Variaveis de Ambiente

Configurar no Railway:

```env
DATABASE_URL=
NODE_ENV=production
ODDS_API_KEY=
FOOTBALL_API_KEY=
SPORTMONKS_API_KEY=
ODDS_PROVIDER_PRIORITY=the-odds-api,sportmonks,api-football
COMPETITION_FILTER=ALL
ALLOW_MOCK_PROVIDER=false
SCHEDULER_ENABLED=true
ODDS_SYNC_INTERVAL_MINUTES=15
RESULTS_SYNC_INTERVAL_MINUTES=15
OPERATION_MONITORING=true
ADMIN_USERNAME=
ADMIN_PASSWORD=
BACKUP_DIR=
```

`ALLOW_MOCK_PROVIDER` deve permanecer `false` em producao. Sem provider licenciado configurado, o health/readiness deve ficar `YELLOW` ou `RED`.

## 3. Providers

- Usar apenas APIs licenciadas.
- Nao usar scraping.
- Confirmar chave ativa em pelo menos um provider real.
- Validar `/health`, `/readiness` e `/go-live` depois de configurar as chaves.

## 4. Scheduler e Jobs

- Manter `SCHEDULER_ENABLED=true` em apenas uma instancia responsavel por jobs internos.
- Confirmar execucoes recentes em `/jobs`.
- Validar que odds, resultados, liquidacao e performance estao registrando `JobRun`.

## 5. Backup

- Configurar `BACKUP_DIR` ou storage externo persistente.
- Validar exportacoes CSV/JSON das tabelas operacionais.
- Confirmar que `/health`, `/go-live` e `/readiness` mostram backup configurado.

## 6. Admin

- Configurar `ADMIN_USERNAME` e `ADMIN_PASSWORD`.
- Validar acesso protegido em `/admin`.
- Revisar logs sem exposicao de secrets.

## 7. Validacao Final

Confirmar `railway.json`:

```text
buildCommand: npm ci && npm run build
preDeployCommand: npm run db:deploy
startCommand: npm run start
healthcheckPath: /api/health
```

Rodar antes do deploy:

```bash
npm run lint
npm run build
npm run db:generate
npx prisma validate
```

Depois do deploy:

```bash
npm run health:check
```

No Railway, configure o health check path como `/api/health`.

## 8. Criterios de Go Live

- Banco PostgreSQL conectado.
- Mock provider desligado.
- Provider real configurado e saudavel.
- Scheduler ativo com jobs recentes.
- Backup configurado.
- Admin protegido.
- Dataset e treinamento baseados apenas em tips liquidadas reais.

Nao criar historico sintetico em producao. O modelo so deve treinar quando houver dados reais suficientes.
