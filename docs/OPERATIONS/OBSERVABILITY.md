# Observabilidade — GREEN ODDS PRO (Railway)

Sprint 8.3.2 — Production Hardening & Operations. Documento puramente
operacional: onde olhar quando algo dá errado em produção. Não descreve
nenhuma nova ferramenta — usa exclusivamente os recursos já existentes
(logs nativos do Railway, `railway.json`, `/api/health`, Prisma CLI).

## 1. Projeto/serviço em produção

| Item | Valor |
|---|---|
| Projeto Railway | `GREEN_ODDS_PRO` |
| Serviço da aplicação | `green-odds-pro-web` |
| Serviço PostgreSQL | `Postgres` |
| Ambiente | `production` |
| Domínio | `https://green-odds-pro-web-production.up.railway.app` |
| Healthcheck | `/api/health` |

## 2. Onde consultar logs

Todos os logs vivem no próprio Railway — nenhuma plataforma externa foi
adicionada.

```bash
# Logs de deploy (build + pre-deploy + start) do deployment mais recente
railway logs --service green-odds-pro-web --deployment

# Logs de um deployment específico
railway logs <deploymentId> --service green-odds-pro-web --deployment

# Logs HTTP (por rota/status/latência)
railway logs --service green-odds-pro-web --http

# Últimas N linhas sem streaming
railway logs --service green-odds-pro-web --lines 200

# Somente erros
railway logs --service green-odds-pro-web --filter "@level:error"

# Logs HTTP com erro (>=400)
railway logs --service green-odds-pro-web --http --status ">=400"
```

Painel web equivalente: `railway open` (abre o dashboard do projeto no
navegador) → serviço `green-odds-pro-web` → aba **Logs** / **Deployments**.

## 3. Padrão de logging da aplicação

A aplicação usa `console.log`/`console.error` com prefixo entre colchetes,
por módulo — nunca um valor de segredo, sempre presença/tamanho/status:

| Prefixo | Onde | O que informa |
|---|---|---|
| `[startup]` | `src/instrumentation.ts`, `scripts/railway-start.mjs` | ENV carregado, scheduler habilitado/desabilitado, conexão com banco, servidor pronto |
| `[health]` | `src/app/api/health/route.ts` | Requisição recebida / 200 retornado |
| `[command-center]`, `[provider-economy]`, `[providers-status]`, `[readiness]`, `[results-sync-audit]` | rotas de auditoria (`src/app/api/audit/*`, `src/app/api/*`) | requisição recebida, motivo de acesso negado, status retornado, erro (mensagem curta, nunca stack) |
| `[provider-audit]` | `src/providers/theOddsApi/index.ts`, `src/app/api/audit/provider-live/route.ts` | `apiKeyPresent` (booleano) e `apiKeyLength` (número) — nunca a chave em si |
| `[dashboard]` | `src/services/dashboardSnapshotService.ts` | início/duração da montagem do snapshot |

A Prediction API (`/api/predictions*`, Sprint 8.1) **não usa `console.log`
próprio** — depende inteiramente dos logs HTTP/erro nativos do Railway
(`railway logs --http`) e do mapeamento de erro já testado
(`predictionApiHandlers.ts::mapErrorToResult`, 41 testes automatizados
confirmando ausência de stack/segredo em qualquer resposta).

## 4. Como identificar um erro

1. **A aplicação está de pé?** `curl -s https://green-odds-pro-web-production.up.railway.app/api/health` — espera-se `{"status":"OK",...}` com HTTP 200.
2. **Houve erro 5xx recente?** `railway logs --service green-odds-pro-web --http --status "500..599" --lines 50`.
3. **Erro de Prisma/banco?** Buscar por `PrismaClientKnownRequestError`, `Can't reach database`, `P1001` (host inacessível), `P1012` (schema/env) nos logs de deploy/deployment: `railway logs --service green-odds-pro-web --filter "Prisma"`.
4. **Erro de migration?** Ver a seção "Applying migration" / "Error:" nos logs do deployment mais recente (`--deployment`), ou rodar `npx prisma migrate status` (ver §6).
5. **Erro específico da Prediction API?** As respostas de erro já vêm com `{"error": "<mensagem segura>", "fields"?: [...]}` e status HTTP correto (400/401/402/403/404/409/500/503) — nunca stack trace, nunca `DATABASE_URL`, nunca `snapshotPayload`. Consultar `railway logs --http --path /api/predictions --status ">=400"`.
6. **Loop de restart?** `railway status --json` → procurar `instances[].status` alternando repetidamente entre `CRASHED`/`RUNNING`, ou `restartPolicyMaxRetries` sendo atingido nos logs.

## 5. Como reiniciar o serviço

```bash
# Restart sem rebuild (novo processo, mesmo artefato de build)
railway restart --service green-odds-pro-web --yes

# Redeploy completo (novo build a partir do commit atual conectado)
railway redeploy --service green-odds-pro-web --yes --from-source
```

Após qualquer restart/redeploy: aguardar o healthcheck (`/api/health`,
timeout configurado em 300s) antes de considerar o serviço recuperado. Ver
`RUNBOOK.md` para o procedimento completo.

## 6. Como validar o banco

```bash
# Status das migrations (não altera nada)
npx prisma migrate status   # requer DATABASE_URL no ambiente do shell

# Consultar variáveis (nomes apenas, nunca valores em log/relatório)
railway variable list --service Postgres --kv | cut -d= -f1
```

Para rodar comandos Prisma localmente contra o Postgres do Railway, usar a
`DATABASE_PUBLIC_URL` do serviço `Postgres` (nunca a `DATABASE_URL` interna
`postgres.railway.internal`, que só resolve de dentro da rede privada do
Railway) — nunca imprimir o valor; atribuir a uma variável de shell
temporária e descartá-la (`unset`) logo após o uso. Ver `RUNBOOK.md` §4.

## 7. O que NUNCA deve aparecer em log/relatório

`DATABASE_URL` completa, usuário/senha do Postgres, `AUTH_SECRET`/
`NEXTAUTH_SECRET`, token de sessão/cookie, stack trace enviada ao cliente,
`snapshotPayload` bruto. Confirmado por auditoria (Sprint 8.3.2, Etapa 1) —
nenhuma ocorrência encontrada no código-fonte atual.
