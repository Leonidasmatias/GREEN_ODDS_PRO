# Disaster Recovery — GREEN ODDS PRO (Railway)

Sprint 8.3.2 — Production Hardening & Operations. Procedimentos para os 5
cenários de falha previstos. Nenhum procedimento aqui executa ação
destrutiva automaticamente — toda ação de escrita/alteração exige
autorização explícita no momento em que for necessária, como em todas as
sprints anteriores deste projeto.

Regra geral, válida para todos os cenários: **nunca** `prisma migrate
reset`, **nunca** `prisma db push` em produção, **nunca** editar uma
migration já aplicada, **nunca** apagar dados sem filtro exato e
autorização explícita.

---

## Cenário 1 — Banco (PostgreSQL) indisponível

### Como validar

1. `curl -s https://green-odds-pro-web-production.up.railway.app/api/health` — se a aplicação já caiu, o healthcheck falha e o Railway reinicia o container automaticamente (`restartPolicyType: ON_FAILURE`, até 3 tentativas).
2. `railway status --json` → verificar o serviço `Postgres` no mesmo projeto: instância `RUNNING`?
3. Chamar qualquer endpoint de leitura (`GET /api/predictions`) autenticado — resposta esperada em caso de banco fora do ar: **503** com corpo `{"error": "Serviço de previsões temporariamente indisponível."}` (`PredictionRepositoryUnavailableError`, mapeado em `predictionApiHandlers.ts`). **Nunca** um 200 com dado fabricado, e **nunca** fallback silencioso para `InMemoryPredictionRepository` (a seleção do Repository é feita uma única vez, por ambiente, em `predictionCenterComposition.ts` — produção nunca usa memória).
4. `railway logs --service green-odds-pro-web --filter "Prisma"` → procurar `P1001` (não foi possível alcançar o banco) ou erro de timeout de conexão.

### Como recuperar

1. Confirmar no Railway se o serviço `Postgres` está de fato fora do ar (não apenas lento) — `railway status --json`.
2. Se o serviço Postgres caiu por instabilidade transitória do Railway, normalmente ele se recupera sozinho; aguardar e reconfirmar o healthcheck da aplicação.
3. Se o serviço Postgres não voltar sozinho, abrir o dashboard (`railway open`) e verificar o painel do serviço Postgres para detalhes/erros específicos — **não recriar o serviço Postgres** sem autorização explícita (isso trocaria o banco, exigindo nova migration do zero).
4. Após o banco voltar: a aplicação já reconecta sozinha (o Prisma Client reabre conexão sob demanda) — não é necessário redeploy manual, mas um `railway restart --service green-odds-pro-web --yes` é seguro caso o processo tenha entrado em estado degradado.
5. Confirmar recuperação: `GET /api/health` → 200; `GET /api/predictions` autenticado → 200 com os dados esperados (nenhum registro perdido, nenhuma duplicata criada durante a falha).

---

## Cenário 2 — Deploy falhou

### Diagnóstico

```bash
railway deployment list --service green-odds-pro-web --json   # status do deployment mais recente
railway logs <deploymentId> --service green-odds-pro-web --build       # logs de build
railway logs <deploymentId> --service green-odds-pro-web --deployment  # logs de pre-deploy/start
```

Causas mais comuns, na ordem em que devem ser checadas:
1. Falha de build (`npm run build`) — erro de TypeScript/dependência.
2. Falha de pre-deploy (`npm run db:deploy` → `prisma migrate deploy`) — ver Cenário 3.
3. Falha de start (`npm run start`) — variável obrigatória ausente (`DATABASE_URL`).
4. Healthcheck nunca respondeu 200 dentro do timeout (300s) — aplicação subiu mas travou antes de servir `/api/health`.

### Rollback

Como o histórico de deployments do Railway preserva builds anteriores:

```bash
railway deployment list --service green-odds-pro-web --json   # localizar o ID do último deployment SAUDÁVEL
```

No dashboard (`railway open`) → serviço → aba **Deployments** → deployment
anterior saudável → **Redeploy**. Isso reativa exatamente aquele build,
sem tocar no banco (o PostgreSQL é um serviço independente, nunca é
revertido junto com a aplicação). Nenhuma migration é desfeita nesse
processo — migrations são sempre forward-only (ver Cenário 3).

Se não houver nenhum deployment saudável anterior no serviço (ex.: recém
criado): a recuperação é *forward-only* — corrigir a causa raiz no
código, criar um novo commit e reimplantar (com autorização explícita
para commit/push, conforme regra padrão deste projeto).

---

## Cenário 3 — Migration falhou

### Procedimento seguro

1. **Nunca** rodar `prisma migrate reset` ou `prisma db push` para "resolver" a falha — ambos podem apagar dados.
2. Verificar o estado exato: `npx prisma migrate status` (com `DATABASE_URL` apontando para o Postgres do Railway — ver `OBSERVABILITY.md` §6). A saída indica exatamente qual migration falhou e se o banco ficou em estado "failed migration" (P3009).
3. Se uma migration ficou marcada como falha no banco (tabela `_prisma_migrations`, coluna `finished_at IS NULL` ou `rolled_back_at` preenchido), **não editar o arquivo da migration já commitado**. O caminho correto é:
   - Investigar exatamente qual comando SQL falhou (logs do deploy mostram a instrução exata).
   - Se a migration nunca aplicou nenhuma alteração real (falhou na primeira instrução), pode ser marcada como resolvida com `prisma migrate resolve --rolled-back <nome>` **somente após confirmar visualmente no banco que nada daquela migration foi aplicado** (nenhuma tabela/coluna/índice órfão) — ação que exige autorização explícita, nunca automática.
   - Se a migration aplicou parcialmente, a correção é sempre uma **nova migration corretiva, aditiva, forward-only** — nunca alterar a migration antiga.
4. Somente depois do banco estar num estado limpo (`prisma migrate status` sem pendências/falhas) o deploy pode ser reexecutado.

---

## Cenário 4 — Variável perdida (ex.: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`)

### Como restaurar

```bash
# Confirmar quais variáveis existem hoje no serviço (nomes apenas)
railway variable list --service green-odds-pro-web --kv | cut -d= -f1
```

- **`DATABASE_URL` ausente/incorreta**: reconfigurar como referência interna ao serviço Postgres do mesmo projeto — nunca copiar um valor literal, nunca reutilizar a `DATABASE_URL` de outro projeto (`LEONIDAS_TECH`/`modest-analysis` são aplicações não relacionadas):
  ```bash
  railway variable set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' --service green-odds-pro-web --skip-deploys
  ```
- **`AUTH_SECRET`/`NEXTAUTH_SECRET` ausentes**: gerar um novo valor aleatório forte (mínimo 32 bytes, preferencialmente 64) e configurar sem nunca exibir o valor em log/terminal/relatório — mesmo procedimento usado na Sprint 8.3.1:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" | \
    railway variable set AUTH_SECRET --service green-odds-pro-web --stdin --skip-deploys
  ```
  Repetir para `NEXTAUTH_SECRET` (pode reutilizar o mesmo valor — `authService.ts` trata as duas variáveis como aliases equivalentes via cadeia `||`).
- Após restaurar qualquer variável obrigatória: `railway redeploy --service green-odds-pro-web --yes` (variáveis só entram em efeito num novo deploy/restart) e confirmar `/api/health` novamente.

**Consequência de rodar em produção sem `DATABASE_URL`**: o
`predictionCenterComposition.ts` lança `PredictionCenterMisconfiguredError`
na primeira operação real da Prediction API (nunca no import do módulo,
para não quebrar o build) — a aplicação sobe e o healthcheck geral
(`/api/health`, que não depende do Prisma) continua respondendo 200, mas
qualquer chamada à Prediction API falha alto e claro, nunca em silêncio.

---

## Cenário 5 — Build quebrado

### Procedimento

1. Reproduzir localmente antes de qualquer ação em produção:
   ```bash
   npm ci
   npx prisma generate
   npx tsc --noEmit
   npm run build
   ```
2. Se o build falha localmente com o mesmo erro do Railway: a causa é no código — corrigir, validar localmente de novo (`tsc`/`test`/`build`), e só então propor um novo commit (autorização explícita necessária).
3. Se o build passa localmente mas falha no Railway: comparar versões (ver `RUNBOOK.md`/tabela de ambiente) — Node/npm/Prisma divergentes entre local e Railway são a causa mais comum. Conferir `.nvmrc` (`20`) e `package.json engines.node` (`>=20`) contra a versão que o Railway efetivamente usa (visível nos logs de build, campo `railpackInfo.resolvedPackages.node.resolvedVersion`).
4. Nunca alterar `railway.json` como tentativa de correção sem antes confirmar exatamente qual etapa (`build`/`pre-deploy`/`start`) falhou — alterar o comando errado mascara o problema real.
