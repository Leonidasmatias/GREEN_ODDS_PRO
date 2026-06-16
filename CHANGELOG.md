# CHANGELOG

## 2026-06-16 - Salvamento oficial Phase 18

### Estado de producao

- Projeto GREEN_ODDS_PRO salvo em estado oficial.
- Railway production confirmado com deployment `success`.
- PostgreSQL Railway mantido como banco oficial via `DATABASE_URL`.
- The Odds API registrada como provider real prioritario.
- Mock desativado em producao.
- Dados simulados removidos do fluxo operacional.

### Phase 18 - Settlement Engine

- Criado `src/services/settlementEngine.ts`.
- Criadas tabelas Prisma:
  - `TipResult`
  - `SettlementRun`
  - `MarketPerformance`
- Expandido `Tip` com campos de provider, bookmaker, stake sugerida, score, profit, ROI e motivo de bloqueio.
- Criado job `SETTLEMENT_SYNC`.
- Settlement liquida apenas tips `PENDING` quando houver resultado real persistido.
- Tips sem resultado real permanecem `PENDING`.
- Training dataset recebe apenas resultados reais `WON`, `LOST` ou `VOID`.
- Performance por mercado calcula entradas, wins, losses, voids, winRate, odd media, ROI, profit, drawdown e confidenceScore.

### Phase 17 - Value Engine

- Value Engine V1 concluido e implantado.
- Criada tabela `ValueAnalysis`.
- Entradas aprovadas passam a criar `Tip` com status `PENDING`.
- `ELITE GREEN` exige amostra real minima do mercado, ROI real positivo, winRate acima da probabilidade implicita e drawdown controlado.

### Validacoes

- `npm run lint`: OK
- `npm run build`: OK
- `npm run db:generate`: OK
- `npx prisma validate`: OK
- `npx prisma migrate deploy`: executado pelo Railway no pre-deploy; deployment `success`

### Proxima fase

- Fase 19 - Smart Ranking Engine.
