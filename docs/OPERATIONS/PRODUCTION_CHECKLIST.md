# Checklist de Produção — GREEN ODDS PRO (Railway)

Sprint 8.3.2 — Production Hardening & Operations. Usar esta checklist a
cada deploy relevante em produção (`green-odds-pro-web`, projeto
`GREEN_ODDS_PRO`, ambiente `production`).

## Antes do deploy (local)

```
□ Build            — npm run build (0 erros)
□ Testes           — npm test (0 falhas; testes reais de Postgres podem
                      aparecer como "skipped" se DATABASE_URL local não
                      estiver definido — isso é esperado, não é falha)
□ Prisma Generate  — npx prisma generate (0 erros)
□ Prisma Format    — npx prisma format
□ TypeScript       — npx tsc --noEmit (0 erros)
□ Migrations       — nenhuma migration pendente de revisão; migration
                      nova (se houver) auditada: cria/altera exclusivamente
                      o que foi planejado, nenhum DROP/TRUNCATE/ALTER
                      destrutivo
□ git status        — apenas os arquivos esperados; nenhum .env, nenhuma
                      credencial, staged
```

## Durante o deploy

```
□ Railway    — deployment acompanhado via `railway logs --deployment`
               até status SUCCESS
□ Build      — etapa de build concluída sem erro nos logs
□ Pre-deploy — `npm run db:deploy` (prisma migrate deploy) concluído,
               todas as migrations aplicadas, nenhuma falha
□ Start      — `npm run start` iniciou sem erro (`[startup] database
               connected`, `[startup] server ready`)
□ Healthcheck — /api/health responde 200 dentro do timeout configurado
```

## Depois do deploy (produção real)

```
□ Login              — autenticação funciona (ver RUNBOOK.md §5)
□ Dashboard          — /dashboard carrega sem erro
□ Prediction History — /prediction/history carrega, mostra os dados
                        existentes, filtros e paginação funcionam
□ Timeline           — abre corretamente para uma partida com histórico
□ APIs               — GET/POST /api/predictions* respondem conforme o
                        contrato (usar identificador
                        railway-validation-<timestamp> se for necessário
                        criar um registro novo de teste)
□ Restart            — (apenas quando uma mudança de infraestrutura for
                        testada) o serviço reinicia e o healthcheck volta
                        a responder 200
□ Persistência       — dados criados antes do deploy continuam presentes
                        depois (nenhuma perda, nenhuma duplicata)
□ Logs               — sem erro novo/recorrente em
                        `railway logs --filter "@level:error"`
□ Encerramento       — LEONIDAS_TECH e modest-analysis permanecem
                        inalterados (railway list --json); nenhum
                        segredo apareceu em nenhum log/relatório deste
                        deploy
```

## Critério de aprovação

O deploy só pode ser considerado concluído com sucesso se **todos** os
itens acima estiverem marcados. Qualquer item pendente bloqueia a
declaração de "produção saudável" — documentar o bloqueio e seguir
`DISASTER_RECOVERY.md` conforme o cenário aplicável.
