# Runbook — GREEN ODDS PRO (Railway)

Sprint 8.3.2 — Production Hardening & Operations. Passo a passo puramente
operacional para as tarefas mais comuns em produção.

Projeto: `GREEN_ODDS_PRO` · Serviço web: `green-odds-pro-web` · Postgres:
`Postgres` · Ambiente: `production` · Domínio:
`https://green-odds-pro-web-production.up.railway.app`.

---

## 1. Deploy

1. Validar localmente primeiro (nunca pular esta etapa):
   ```bash
   npx prisma format && npx prisma validate && npx prisma generate
   npx tsc --noEmit
   npm test
   npm run build
   ```
2. Confirmar `git status`/`git log -1` — qual commit será implantado.
3. Push para `main` (**somente com autorização explícita**, conforme regra padrão deste projeto) — o Railway está conectado ao repositório `Leonidasmatias/GREEN_ODDS_PRO`, branch `main`.
4. Acompanhar o deploy automaticamente disparado, ou disparar manualmente:
   ```bash
   railway redeploy --service green-odds-pro-web --yes --from-source
   ```
5. Acompanhar em tempo real:
   ```bash
   railway logs --service green-odds-pro-web --deployment
   ```
6. Esperar, na ordem: instalação de dependências → `prisma generate` → `npm run build` → `npm run db:deploy` (`prisma migrate deploy`) → `npm run start` → healthcheck `/api/health` respondendo 200.
7. Confirmar status final:
   ```bash
   railway deployment list --service green-odds-pro-web --json
   ```
8. Rodar o checklist pós-deploy (`PRODUCTION_CHECKLIST.md`).

## 2. Restart

Usar quando a aplicação está degradada mas o código/commit atual continua correto (não requer novo build):

```bash
railway restart --service green-odds-pro-web --yes
```

Confirma-se que é um restart real (novo processo, não apenas resposta em
cache) verificando que o `instances[].id` mudou:

```bash
railway status --json
```

Aguardar o healthcheck antes de considerar concluído (ver §3).

## 3. Health Check

```bash
curl -s https://green-odds-pro-web-production.up.railway.app/api/health
```

Resposta esperada: `{"status":"OK","service":"green-odds-pro","timestamp":"...","uptimeSeconds":N}`
com HTTP 200. `uptimeSeconds` baixo logo após um restart/deploy é
esperado e confirma que é uma instância nova.

Se não responder 200 dentro de ~300s após um deploy: ver
`DISASTER_RECOVERY.md`, Cenário 2.

## 4. Banco (validação, sem alterar nada)

```bash
# Nomes das variáveis do Postgres (nunca os valores)
railway variable list --service Postgres --kv | cut -d= -f1

# Para rodar comandos Prisma daqui (fora da rede privada do Railway),
# usar a URL pública em uma variável de shell temporária, nunca impressa:
DBURL=$(railway variable list --service Postgres --kv | grep '^DATABASE_PUBLIC_URL=' | cut -d= -f2-)
DATABASE_URL="$DBURL" npx prisma migrate status
unset DBURL DATABASE_URL
```

Resultado esperado: `19 migrations found`, `Database schema is up to
date!`, nenhuma pendente, nenhuma falha.

## 5. Login

1. Abrir `https://green-odds-pro-web-production.up.railway.app/login`.
2. Autenticar com uma conta com plano `PREMIUM` (necessário para acessar o Prediction Center — ver `subscriptionAccess.ts`). Para validação técnica, ver `VALIDATION_ACCOUNT.md`.
3. Login bem-sucedido redireciona para `/dashboard`.
4. Sessão é validada via cookie `gop_session` (httpOnly, `secure` em produção) — armazenada na tabela `Session` do Postgres, não em memória do processo (sobrevive a restart).

## 6. Prediction History (`/prediction/history`)

1. Após login, acessar `/prediction/history` (ou pelo menu lateral "Historico de Previsoes").
2. Confirmar: cards de estatística (`TOTAL ENCONTRADO`/`NESTA PÁGINA`/`FIXTURE`/`REAL`), listagem, filtros (`Match ID`/`Player ID`/`Liga`/`Período`/ordenação/itens por página), botão "Aplicar filtros"/"Limpar".
3. Botão **DETALHES** abre o drawer com o snapshot completo (Green Score, Confidence, resultado previsto, mercados) — nunca recalculado, apenas o que já foi persistido.
4. Botão **TIMELINE** abre o histórico daquela partida, mais recente primeiro.
5. `Escape` fecha qualquer drawer e devolve o foco ao botão que o abriu.
6. Endpoints usados (todos autenticados, gate `predictionCenter`/PREMIUM):
   `GET /api/predictions`, `GET /api/predictions/[id]`,
   `GET /api/predictions/match/[matchId]`,
   `GET /api/predictions/match/[matchId]/latest`,
   `POST /api/predictions` (geração + persistência explícita).

## 7. Checklist pós-deploy

```
[ ] /api/health responde 200
[ ] railway deployment list mostra status SUCCESS
[ ] npx prisma migrate status: sem pendências/falhas
[ ] Login funciona
[ ] /prediction/history carrega e mostra dados existentes
[ ] Timeline abre corretamente
[ ] POST /api/predictions cria um registro (usar identificador railway-validation-<timestamp>)
[ ] GET list/detail/history/latest retornam o registro criado
[ ] Nenhum erro novo em `railway logs --filter "@level:error"` nos últimos minutos
[ ] LEONIDAS_TECH e modest-analysis inalterados (railway list --json)
```

Ver também `PRODUCTION_CHECKLIST.md` para a versão expandida (checklist
formal por item, a ser usado a cada deploy).
