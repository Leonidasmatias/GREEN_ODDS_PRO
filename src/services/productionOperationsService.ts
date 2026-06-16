import { prisma } from "@/lib/prisma";
import { checkBackupStorage } from "./backupService";
import { isSchedulerEnabled, schedulerFrequencies } from "./schedulerService";
import { getProviderHealth } from "@/providers/providerManager";

type HealthStatus = "GREEN" | "YELLOW" | "RED";

export async function getHealthStatus() {
  const checks: Array<{ name: string; status: HealthStatus; detail: string }> = [];

  checks.push({
    name: "App",
    status: "GREEN",
    detail: "Next.js respondeu ao health check",
  });

  try {
    const versionRows = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    const isPostgres = versionRows[0]?.version?.toLowerCase().includes("postgresql");
    checks.push({
      name: "Banco PostgreSQL",
      status: isPostgres ? "GREEN" : "RED",
      detail: isPostgres ? "PostgreSQL conectado" : "DATABASE_URL nao aponta para PostgreSQL",
    });
  } catch {
    checks.push({ name: "Banco PostgreSQL", status: "RED", detail: "Conexao indisponivel" });
  }

  checks.push({
    name: "Prisma",
    status: checks.some((check) => check.name === "Banco PostgreSQL" && check.status === "GREEN") ? "GREEN" : "RED",
    detail: checks.some((check) => check.name === "Banco PostgreSQL" && check.status === "GREEN") ? "Query Prisma executada" : "Prisma sem conexao operacional",
  });

  const productionEnv = process.env.NODE_ENV === "production";
  checks.push({
    name: "Ambiente",
    status: productionEnv ? "GREEN" : "YELLOW",
    detail: productionEnv ? "NODE_ENV=production" : `NODE_ENV=${process.env.NODE_ENV ?? "nao definido"}`,
  });

  const mockDisabled = process.env.ALLOW_MOCK_PROVIDER?.trim().toLowerCase() !== "true";
  checks.push({
    name: "Mock provider",
    status: mockDisabled ? "GREEN" : "RED",
    detail: mockDisabled ? "ALLOW_MOCK_PROVIDER=false/ausente" : "Mock nao pode ficar ativo em producao",
  });

  const providers = await getProviderHealth();
  const configuredProviders = providers.filter((provider) => provider.licensed && provider.configured);
  const healthyProviders = configuredProviders.filter((provider) => provider.status !== "FAILED");
  checks.push({
    name: "API odds",
    status: !configuredProviders.length ? "YELLOW" : healthyProviders.length ? "GREEN" : "RED",
    detail: !configuredProviders.length ? "Nenhum provider licenciado configurado" : healthyProviders.length ? `${healthyProviders.length} provider(s) disponivel(is)` : "Todos os providers configurados falharam",
  });

  const statsProvider = providers.find((provider) => provider.id === "sportmonks" || provider.id === "api-football");
  checks.push({
    name: "API estatisticas",
    status: statsProvider?.configured ? (statsProvider.status === "FAILED" ? "RED" : "GREEN") : "YELLOW",
    detail: statsProvider?.configured ? `${statsProvider.id}: ${statsProvider.status}` : "SportMonks/API-Football nao configurado",
  });

  const latestJob = await prisma.jobRun.findFirst({ orderBy: { scheduledAt: "desc" } }).catch(() => null);
  const schedulerLate = latestJob ? Date.now() - latestJob.scheduledAt.getTime() > Math.max(schedulerFrequencies.odds, schedulerFrequencies.settlement) * 3 : true;
  checks.push({
    name: "Scheduler",
    status: !isSchedulerEnabled() ? "YELLOW" : latestJob ? (schedulerLate ? "YELLOW" : "GREEN") : "YELLOW",
    detail: !isSchedulerEnabled() ? "SCHEDULER_ENABLED nao esta true nesta instancia" : latestJob ? (schedulerLate ? "Sem execucao recente" : `Ultimo job ${latestJob.name}`) : "Aguardando primeira execucao",
  });

  const latestSettlement = await prisma.settlementRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null);
  const pendingTips = await prisma.tip.count({ where: { status: "PENDING" } }).catch(() => 0);
  checks.push({
    name: "Settlement Engine",
    status: latestSettlement?.status === "FAILED" ? "RED" : pendingTips > 0 && !latestSettlement ? "YELLOW" : "GREEN",
    detail: latestSettlement ? `Ultima execucao ${latestSettlement.status}: ${latestSettlement.tipsSettled}/${latestSettlement.tipsProcessed} liquidadas` : `${pendingTips} tips pendentes aguardando resultado real`,
  });

  const storage = await checkBackupStorage();
  const backupConfigured = Boolean(process.env.BACKUP_DIR?.trim());
  checks.push({
    name: "Backup configurado",
    status: storage.ok && backupConfigured ? "GREEN" : "YELLOW",
    detail: storage.ok ? (backupConfigured ? storage.directory : "BACKUP_DIR ausente; usando diretorio padrao local") : storage.error ?? "Indisponivel",
  });

  const overall: HealthStatus = checks.some((check) => check.status === "RED") ? "RED" : checks.some((check) => check.status === "YELLOW") ? "YELLOW" : "GREEN";
  return { status: overall, checks, checkedAt: new Date().toISOString() };
}

export async function getCoverageAnalytics() {
  const [matches, snapshots] = await Promise.all([
    prisma.match.findMany({ include: { oddsSnapshots: true } }),
    prisma.oddsSnapshot.findMany(),
  ]);
  const markets = [...new Set(snapshots.map((item) => item.market))].sort();
  const competitions = [...new Set(matches.map((item) => item.competition))].map((competition) => {
    const competitionMatches = matches.filter((item) => item.competition === competition);
    return {
      competition,
      games: competitionMatches.length,
      odds: competitionMatches.reduce((sum, item) => sum + item.oddsSnapshots.length, 0),
      markets: [...new Set(competitionMatches.flatMap((item) => item.oddsSnapshots.map((odd) => odd.market)))].length,
    };
  }).sort((a, b) => b.games - a.games);
  return { gamesMonitored: matches.length, oddsCaptured: snapshots.length, markets, competitions, generatedAt: new Date().toISOString() };
}

export async function getSeasonAnalytics() {
  const tips = await prisma.tip.findMany({ where: { status: { in: ["WON", "LOST"] } }, include: { match: true } });
  return [...new Set(tips.map((tip) => tip.match.competition))].map((competition) => {
    const rows = tips.filter((tip) => tip.match.competition === competition);
    const won = rows.filter((tip) => tip.status === "WON").length;
    const profit = rows.reduce((sum, tip) => sum + (tip.profitLoss ?? 0), 0);
    const stake = rows.reduce((sum, tip) => sum + tip.stake, 0);
    return { competition, entries: rows.length, roi: stake ? profit / stake * 100 : 0, winRate: rows.length ? won / rows.length * 100 : 0, greens: won, reds: rows.length - won, profit };
  }).sort((a, b) => b.roi - a.roi);
}
