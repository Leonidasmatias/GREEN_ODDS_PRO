# Variáveis de Ambiente — GREEN ODDS PRO

Sprint 8.3.2.1 — Finalização da Documentação Operacional. Este documento
lista **nomes e finalidade** de todas as variáveis de ambiente usadas
pela aplicação. **Nenhum valor real é registrado aqui** — apenas nomes,
obrigatoriedade, estado em produção (configurada ou não) e descrição.

Estado em produção verificado por leitura de nomes apenas
(`railway variable list --service green-odds-pro-web --kv | cut -d= -f1`),
nunca por exibição de valor.

## 1. Persistência e segurança (núcleo — Sprint 7.x/8.x)

| Variável | Obrigatória | Produção | Descrição |
|---|---|---|---|
| `DATABASE_URL` | **Sim** | ✅ Configurada (referência interna `${{Postgres.DATABASE_URL}}`) | Connection string do PostgreSQL. Sem ela, `predictionCenterComposition.ts` falha alto e claro na primeira operação real da Prediction API em produção (`PredictionCenterMisconfiguredError`) — nunca cai para memória. |
| `AUTH_SECRET` | Recomendada | ✅ Configurada (Sprint 8.3.1) | Segredo usado para derivar o hash da sessão (`sessionDigest`, `src/services/authService.ts`). Sem ela, `authService.ts` usa um fallback fixo `"development-only-auth-secret"` — funciona, mas é inseguro em produção real. |
| `NEXTAUTH_SECRET` | Recomendada (alias) | ✅ Configurada (Sprint 8.3.1) | Alias equivalente a `AUTH_SECRET` na cadeia `process.env.AUTH_SECRET \|\| process.env.NEXTAUTH_SECRET \|\| process.env.NEXTAUTH_URL \|\| fallback`. Este projeto **não usa a biblioteca NextAuth** — o nome é mantido por convenção histórica. |
| `NODE_ENV` | Implícita | ✅ Forçada por `scripts/railway-start.mjs` (`process.env.NODE_ENV ||= "production"`) | Controla a seleção de Repository em produção (`PrismaPredictionRepository` vs `InMemoryPredictionRepository`) e o flag `secure` do cookie de sessão. |

## 2. Provedores de dados externos (opcionais)

| Variável | Obrigatória | Produção | Descrição |
|---|---|---|---|
| `ODDS_API_KEY` | Não | ❌ Ausente | Chave da The Odds API. Sem ela, o provider correspondente simplesmente não retorna dados reais — nenhuma funcionalidade do Prediction Center depende disso. |
| `FOOTBALL_API_KEY` | Não | ❌ Ausente | Chave da API de estatísticas de futebol (`footballStatsApi.ts`, `api-football`). Mesmo impacto: provider inativo, sem erro. |
| `SPORTMONKS_API_KEY` | Não | ❌ Ausente | Chave da Sportmonks. Mesmo impacto. |
| `SPORTMONKS_BASE_URL` | Não | ❌ Ausente | URL base alternativa da Sportmonks. Valor padrão de código: `https://api.sportmonks.com/v3/football`. |
| `API_FOOTBALL_BASE_URL` | Não | ❌ Ausente | URL base alternativa da API-Football. Valor padrão de código: `https://v3.football.api-sports.io`. |
| `ODDS_SPORT_KEY` | Não | ❌ Ausente | Chave do esporte consultado na The Odds API. Padrão: `soccer_fifa_world_cup`. |
| `ODDS_REGIONS` | Não | ❌ Ausente | Regiões de odds consultadas. Padrão: `eu`. |
| `ODDS_PROVIDER_PRIORITY` | Não | ❌ Ausente | Ordem de prioridade entre providers. Padrão: `the-odds-api,sportmonks,api-football`. |
| `COMPETITION_FILTER` | Não | ❌ Ausente | Filtro de competições monitoradas. Padrão: `ALL`. |
| `ALLOW_MOCK_PROVIDER` | Não | ❌ Ausente (padrão `false`) | Habilita provider mock (nunca deve ser `true` em produção real — usado apenas em desenvolvimento/teste). |

## 3. Sincronização e operação (opcionais)

| Variável | Obrigatória | Produção | Descrição |
|---|---|---|---|
| `SCHEDULER_ENABLED` | Não | ❌ Ausente (padrão desabilitado) | Liga o scheduler interno de sincronização (`schedulerService.ts`, `instrumentation.ts`). Sem ela, nenhum job automático roda — não afeta a Prediction API/Dashboard, que são sob demanda. |
| `SCHEDULER_PROCESS` | Não | ❌ Ausente | Marca o processo atual como responsável pelo scheduler (usado em `instrumentation.ts` para evitar scheduler duplicado em múltiplas instâncias). |
| `ODDS_SYNC_INTERVAL_MINUTES` | Não | ❌ Ausente | Intervalo do job de sincronização de odds. Padrão de exemplo: `15`. |
| `RESULTS_SYNC_INTERVAL_MINUTES` | Não | ❌ Ausente | Intervalo do job de sincronização de resultados. Padrão de exemplo: `60`. |
| `PROVIDER_ECONOMY_MODE` | Não | ❌ Ausente | Ativa modo de economia de chamadas a providers externos. |
| `OPERATION_MONITORING` | Não | ❌ Ausente | Ativa monitoramento operacional adicional (`productionOperationsService.ts`, `productionCertificationService.ts`). |
| `BACKUP_DIR` | Não | ❌ Ausente | Diretório de backups locais (`backupService.ts`). Padrão de exemplo: `./backups`. Não relacionado ao PostgreSQL do Railway (esse é gerenciado pelo próprio Railway). |

## 4. Administração (opcional, fail-closed)

| Variável | Obrigatória | Produção | Descrição |
|---|---|---|---|
| `ADMIN_USERNAME` | Não (mas sem ela `/admin` fica inacessível) | ❌ Ausente | Usuário do HTTP Basic Auth que protege `/admin` e `/api/admin` (`middleware.ts`). |
| `ADMIN_PASSWORD` | Não (idem) | ❌ Ausente | Senha correspondente. **Sem nenhuma das duas, `/admin`/`/api/admin` retornam 503 — nunca abrem sem autenticação** (fail-closed, comportamento seguro confirmado em auditoria). |

## 5. BetsAPI — integração real (Fase 3, opcional, desabilitada por padrão)

| Variável | Obrigatória | Produção | Descrição |
|---|---|---|---|
| `BETSAPI_ENABLED` | Não | ❌ Ausente (padrão `false`) | Liga/desliga toda a integração real com a BetsAPI. |
| `BETSAPI_MODE` | Não | ❌ Ausente (padrão `fixture`) | Modo de operação (`fixture` = dados de demonstração, nunca reais, quando desabilitada). |
| `BETSAPI_TOKEN` | Somente se `BETSAPI_ENABLED=true` | ❌ Ausente | Token de autenticação da BetsAPI. **Nunca deve ir para `.env.example`/repositório** (já documentado como regra no próprio `.env.example`). |
| `BETSAPI_BASE_URL` | Não | ❌ Ausente | URL base primária. Padrão: `https://api.b365api.com`. |
| `BETSAPI_FALLBACK_BASE_URL` | Não | ❌ Ausente | URL base de fallback. Padrão: `https://api.betsapi.com`. |
| `BETSAPI_TIMEOUT_MS` | Não | ❌ Ausente | Timeout de requisição. Padrão: `10000`. |
| `BETSAPI_MAX_RETRIES` | Não | ❌ Ausente | Tentativas em caso de falha. Padrão: `3`. |
| `BETSAPI_RETRY_BASE_DELAY_MS` | Não | ❌ Ausente | Delay base entre tentativas. Padrão: `500`. |
| `BETSAPI_RATE_LIMIT_RESERVE` | Não | ❌ Ausente | Reserva de rate limit. Padrão: `20`. |
| `BETSAPI_SPORT_ID` | Não | ❌ Ausente | ID do esporte na BetsAPI. Padrão: `1`. |
| `BETSAPI_PERSIST_ENABLED` | Não | ❌ Ausente (padrão `false`) | Habilita persistência dos dados sincronizados. |
| `BETSAPI_AGGREGATION_ENABLED` | Não | ❌ Ausente (padrão `false`) | Habilita agregação dos dados sincronizados. |
| `BETSAPI_ESOCCER_ALLOWLIST` | Não | ❌ Ausente | Lista de permissão de ligas/eventos eSoccer. |
| `BETSAPI_ESOCCER_DENYLIST` | Não | ❌ Ausente | Lista de bloqueio de ligas/eventos eSoccer. |
| `BETSAPI_MAX_PAGES_PER_SYNC` | Não | ❌ Ausente | Limite de páginas por sincronização. Padrão: `3`. |
| `BETSAPI_MAX_EVENTS_PER_SYNC` | Não | ❌ Ausente | Limite de eventos por sincronização. Padrão: `200`. |

Impacto de todas ausentes: **nenhum** para o Prediction Center — a
integração BetsAPI é uma feature independente (Fase 3), desligada por
padrão (`BETSAPI_ENABLED` ausente ⇒ tratado como `false`).

## 6. Observabilidade (Fase 3.5, opcional, desabilitada por padrão)

| Variável | Obrigatória | Produção | Descrição |
|---|---|---|---|
| `OBSERVABILITY_ENABLED` | Não | ❌ Ausente (padrão `false`) | Liga a camada de observabilidade de qualidade de dados (`src/services/observability/`). |
| `OBSERVABILITY_RETENTION_DAYS` | Não | ❌ Ausente | Retenção de amostras. Padrão de exemplo: `30`. |
| `OBSERVABILITY_SAMPLE_SIZE_MAX` | Não | ❌ Ausente | Tamanho máximo de amostra. Padrão de exemplo: `500`. |
| `OBSERVABILITY_ALERTS_ENABLED` | Não | ❌ Ausente (padrão `false`) | Liga o motor de alertas (`AlertRuleEngine`). |
| `OBSERVABILITY_ALERT_MIN_SEVERITY` | Não | ❌ Ausente | Severidade mínima para gerar alerta. Padrão de exemplo: `warning`. |
| `OBSERVABILITY_STORAGE_MODE` | Não | ❌ Ausente | Backend de armazenamento das métricas. Padrão de exemplo: `memory`. |
| `OBSERVABILITY_COMPLETENESS_WEIGHT` | Não | ❌ Ausente | Peso do sub-score de completude (0..1). Padrão de exemplo: `0.25`. |
| `OBSERVABILITY_CONSISTENCY_WEIGHT` | Não | ❌ Ausente | Peso do sub-score de consistência. Padrão de exemplo: `0.20`. |
| `OBSERVABILITY_CLASSIFICATION_WEIGHT` | Não | ❌ Ausente | Peso do sub-score de classificação. Padrão de exemplo: `0.20`. |
| `OBSERVABILITY_DUPLICATE_WEIGHT` | Não | ❌ Ausente | Peso do sub-score de duplicação. Padrão de exemplo: `0.15`. |
| `OBSERVABILITY_FRESHNESS_WEIGHT` | Não | ❌ Ausente | Peso do sub-score de atualidade. Padrão de exemplo: `0.10`. |
| `OBSERVABILITY_PROVIDER_RELIABILITY_WEIGHT` | Não | ❌ Ausente | Peso do sub-score de confiabilidade de provider. Padrão de exemplo: `0.10`. |
| `OBSERVABILITY_READINESS_MIN_SAMPLE_SIZE` | Não | ❌ Ausente | Amostra mínima para avaliar prontidão. Padrão de exemplo: `30`. |
| `OBSERVABILITY_READINESS_MIN_SCORE` | Não | ❌ Ausente | Score mínimo (escala 0..100) para considerar pronto. Padrão de exemplo: `75`. |
| `OBSERVABILITY_LATENCY_P95_THRESHOLD_MS` | Não | ❌ Ausente | Limite de latência p95. Padrão de exemplo: `5000`. |
| `OBSERVABILITY_ERROR_RATE_THRESHOLD` | Não | ❌ Ausente | Limite de taxa de erro (0..1). Padrão de exemplo: `0.1`. |
| `OBSERVABILITY_DUPLICATE_RATE_THRESHOLD` | Não | ❌ Ausente | Limite de taxa de duplicação. Padrão de exemplo: `0.05`. |
| `OBSERVABILITY_STALE_DATA_MINUTES` | Não | ❌ Ausente | Minutos para considerar um dado obsoleto. Padrão de exemplo: `60`. |

Impacto de todas ausentes: **nenhum** para o Prediction Center — camada
independente (Fase 3.5), desligada por padrão.

## 7. Variáveis automáticas do Railway (nunca configuradas manualmente)

`RAILWAY_ENVIRONMENT`, `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_ENVIRONMENT_NAME`,
`RAILWAY_PRIVATE_DOMAIN`, `RAILWAY_PROJECT_ID`, `RAILWAY_PROJECT_NAME`,
`RAILWAY_SERVICE_ID`, `RAILWAY_SERVICE_NAME`, `PORT` — injetadas
automaticamente pelo Railway em todo serviço; `scripts/railway-start.mjs`
já usa `process.env.PORT` corretamente (nunca uma porta fixa).

## 8. Regra permanente

Nenhum valor real de nenhuma variável desta lista deve ser registrado em
código, commit, log, relatório ou documentação — apenas o nome, conforme
seguido em todas as sprints deste projeto até aqui.
