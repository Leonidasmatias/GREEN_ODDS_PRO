# GREEN ODDS PRO - Manual de Operacao

## 1. Pre-requisitos

- Node.js compativel com Next.js 15.
- Banco persistente e `DATABASE_URL` configurada.
- Pelo menos um provider licenciado: The Odds API, SportMonks ou API-Football.
- HTTPS ativo.
- Credenciais fortes para `/admin`.
- Diretorio de backup persistente e gravavel.

Nunca habilite `ALLOW_MOCK_PROVIDER=true` em producao.

## 2. Configuracao

Crie o arquivo de ambiente a partir de `.env.production.example`. Defina:

- `DATABASE_URL`
- `ODDS_API_KEY`, `SPORTMONKS_API_KEY` ou `FOOTBALL_API_KEY`
- `ODDS_PROVIDER_PRIORITY`
- `COMPETITION_FILTER`
- `ODDS_SYNC_INTERVAL_MINUTES`
- `RESULTS_SYNC_INTERVAL_MINUTES`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `BACKUP_DIR`

Nao grave chaves em codigo, commits, logs ou URLs publicas.

## 3. Preparacao

```powershell
npm ci
npx prisma generate
npx prisma migrate deploy
npm run lint
npm run build
```

Inicie com `npm run start`. Confira `/health`, `/jobs`, `/readiness` e `/go-live`.

## 4. Sincronizacao

O scheduler executa jobs de odds e resultados nos intervalos configurados. Cada execucao e registrada em `job_runs`.

- Odds: `ODDS_SYNC_INTERVAL_MINUTES`
- Resultados e liquidacao: `RESULTS_SYNC_INTERVAL_MINUTES`
- Performance e qualidade: a cada hora
- Dataset, treinamento e backup: diariamente

Falhas de provider geram failover conforme `ODDS_PROVIDER_PRIORITY`.

## 5. Monitoramento

- `/admin`: operacao consolidada, protegida por Basic Auth em producao.
- `/jobs`: execucoes, falhas e duracao.
- `/health`: banco, providers, scheduler e armazenamento.
- `/live-monitor`: partidas e odds reais ao vivo.
- `/coverage`: cobertura de jogos e mercados.
- `/model-performance`: treinamento e validacao temporal.
- `/go-live`: score final de prontidao.

Configure monitor externo para consultar `/api/health`. HTTP 503 indica status RED.

## 6. Backup

O job `BACKUP` exporta CSV e JSON de:

- `tips`
- `performance`
- `training_dataset`
- `odds_snapshots`

Os arquivos sao gravados em `BACKUP_DIR`. Copie-os para armazenamento externo com retencao e criptografia. Nao dependa apenas do disco da aplicacao.

## 7. Recuperacao

1. Interrompa o processo da aplicacao.
2. Preserve uma copia do banco danificado.
3. Restaure o snapshot nativo do banco mais recente.
4. Execute `npx prisma migrate deploy`.
5. Compare contagens com os CSV/JSON de backup.
6. Inicie a aplicacao e valide `/health`, `/audit` e `/data-quality`.

CSV/JSON sao exportacoes operacionais. Para restauracao completa, prefira backup nativo e transacional do banco.

## 8. Incidentes

- Provider RED: verifique chave, plano, rate limit e endpoint; o failover tentara o proximo provider.
- Scheduler atrasado: reinicie o processo persistente e verifique `job_runs`.
- Dataset inconsistente: execute `/api/data-quality` e suspenda treinamento ate resolver alertas RED.
- Banco indisponivel: interrompa sincronizacoes e restaure o ultimo backup valido.

## Responsabilidade

As previsoes sao probabilisticas. O sistema nao promete lucro e nao garante green. Desempenho passado nao assegura resultados futuros.
