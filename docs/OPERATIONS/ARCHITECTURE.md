# Arquitetura Operacional — GREEN ODDS PRO (Railway)

Sprint 8.3.2.1 — Finalização da Documentação Operacional. Documento
puramente descritivo: nenhum diagrama aqui implica alteração de código —
descreve exatamente o que já está implantado em produção (Sprints
7.1–8.3.1).

## 1. Arquitetura Geral

```
GitHub
  (Leonidasmatias/GREEN_ODDS_PRO, branch main)
    │
    ▼
Railway
  (projeto GREEN_ODDS_PRO, serviço green-odds-pro-web)
    │
    ▼
Next.js
  (App Router, Route Handlers em /api/predictions*, páginas em /prediction/history)
    │
    ▼
Prediction Repository
  (contrato PredictionRepository — PrismaPredictionRepository em produção,
   InMemoryPredictionRepository em desenvolvimento/teste, selecionado
   uma única vez por predictionCenterComposition.ts)
    │
    ▼
Prisma ORM
  (Prisma Client 6.19.0, singleton único em src/lib/prisma.ts)
    │
    ▼
PostgreSQL
  (serviço Postgres, mesmo projeto Railway, rede privada
   postgres.railway.internal)
```

## 2. Fluxo de Deploy

```
GitHub (push em main)
    │
    ▼
Railway (deploy automático ou `railway redeploy`)
    │
    ▼
Build            → npm run build (Next.js build padrão, Nixpacks)
    │
    ▼
Prisma Generate  → executado no postinstall e no início do build
                    (garante que o Prisma Client reflita prisma/schema.prisma)
    │
    ▼
Pre-Deploy       → npm run db:deploy → prisma migrate deploy
                    (aplica migrations pendentes no Postgres do projeto)
    │
    ▼
Start            → npm run start → scripts/railway-start.mjs
                    → node scripts/railway-start.mjs → next start (standalone)
    │
    ▼
Healthcheck      → GET /api/health (timeout 300s, restartPolicy ON_FAILURE
                    com até 3 tentativas)
```

Configuração completa em `railway.json` (build/pre-deploy/start/healthcheck)
— nenhuma etapa manual fora deste fluxo.

## 3. Fluxo das APIs (`/api/predictions*`)

```
Browser
    │  (fetch autenticado, cookie de sessão gop_session)
    ▼
Next.js Route Handler
    (src/app/api/predictions*/route.ts — thin wrapper, getApiAccess
     para auth/autorização, nunca contém lógica de negócio)
    │
    ▼
predictionApiHandlers.ts
    (validação de transporte, mapeamento de erro para HTTP)
    │
    ▼
Query Service (leitura) / Persistence Service (escrita)
    (PredictionQueryService / PredictionPersistenceService — nunca
     recalculam, apenas orquestram)
    │
    ▼
Repository
    (PrismaPredictionRepository — único ponto que conhece o Prisma Client)
    │
    ▼
Prisma
    │
    ▼
PostgreSQL
```

GET nunca escreve; POST persiste exatamente uma vez (idempotente por
`snapshotHash`). Contratos: `PredictionSummary`/`PredictionDetail`/
`PredictionQueryPage` (Sprint 7.4), inalterados desde então.

## 4. Fluxo de Persistência

```
Prediction Engine
    (predictMatch — Sprint 4.x, matemática do motor, nunca tocada por
     nenhuma sprint de infraestrutura)
    │
    ▼
Snapshot
    (PredictionSnapshot — envelope de identidade, Sprint 4.5)
    │
    ▼
Repository
    (PredictionPersistenceService monta o PredictionRecordDraft,
     PrismaPredictionRepository.save() persiste com idempotência
     por snapshotHash único)
    │
    ▼
Database
    (tabela prediction_snapshot_records, PostgreSQL)
    │
    ▼
Prediction History
    (GET /api/predictions/match/[matchId], /prediction/history —
     leitura pura do que já foi persistido, nunca recalcula)
```

## 5. Fluxo de Login

```
Browser
    │  (POST /api/auth/login, e-mail + senha)
    ▼
authService.ts
    (loginUser — hashPassword/verifyPassword via scrypt,
     src/lib/passwordHash.ts; NÃO usa NextAuth — autenticação própria,
     por sessão em cookie httpOnly)
    │
    ▼
Prisma
    │
    ▼
User
    (tabela User — validação de credenciais)
    │
    ▼
Session
    (tabela Session — sessionToken com hash SHA-256 salgado por
     AUTH_SECRET/NEXTAUTH_SECRET, cookie gop_session setado na resposta;
     sessão sobrevive a restart pois vive no Postgres, nunca em memória
     do processo)
```

> Nota de precisão: este projeto **não usa a biblioteca NextAuth** —
> implementa autenticação própria em `src/services/authService.ts`. O
> nome das variáveis (`AUTH_SECRET`/`NEXTAUTH_SECRET`) segue a mesma
> convenção de nomes por compatibilidade histórica, mas nenhum pacote
> `next-auth` está em uso.

## 6. Fluxo do Prediction History (UI)

```
Prediction History
    (/prediction/history — Server Component mínimo, só o gate de auth;
     PredictionHistoryDashboard é Client Component)
    │
    ▼
API
    (predictionApiClient.ts — fronteira HTTP exclusiva da UI, consome
     somente GET /api/predictions*, nunca importa Repository/Query
     Service diretamente)
    │
    ▼
Repository
    (via API — a UI nunca acessa o Repository diretamente)
    │
    ▼
Database
    │
    ▼
UI
    (listagem/filtros/paginação/drawer de detalhe/Timeline — Sprint 8.2,
     sem alteração nesta sprint)
```

## 7. Dependências

| Dependência | Papel |
|---|---|
| **Railway** | Hospedagem (build + runtime), PostgreSQL gerenciado, variáveis de ambiente, logs, healthcheck, restart policy |
| **PostgreSQL** | Armazenamento persistente único da aplicação — todas as 54 tabelas do domínio, incluindo `prediction_snapshot_records` |
| **Prisma** | ORM — schema único (`prisma/schema.prisma`), migrations versionadas, client gerado em build/postinstall, singleton único em `src/lib/prisma.ts` |
| **Next.js** | Framework da aplicação inteira — App Router, Route Handlers, Server/Client Components, build `standalone` |
| **React** | Camada de UI (Server + Client Components) |
| **TypeScript** | Tipagem em todo o código-fonte; validado em build (`tsc --noEmit`) e testado via `node --test` com type-stripping nativo (Node 20+) |
