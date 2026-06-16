import { prisma } from "@/lib/prisma";
import { predictGreenAi } from "./greenAiEngine";
import { getProviderConfiguration, getProviderHealth } from "@/providers/providerManager";
import { getTrainingStatus } from "./modelTrainingService";
import { checkBackupStorage } from "./backupService";
import { isSchedulerEnabled } from "./schedulerService";
import { getDataConfidence } from "./confidenceEngine";

async function countAppliedMigrations() {
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function getLiveMonitor() {
  const [matches, ai] = await Promise.all([
    prisma.match.findMany({ where: { status: "LIVE", NOT: { providerId: { startsWith: "mock" } } }, include: { oddsSnapshots: { orderBy: { capturedAt: "asc" } }, tips: { where: { status: "PENDING" } } }, orderBy: { startsAt: "asc" } }),
    predictGreenAi(),
  ]);
  return {
    matches: matches.map((match) => {
      const groups = new Map<string, typeof match.oddsSnapshots>();
      for (const odd of match.oddsSnapshots) {
        const key = `${odd.market}:${odd.selection}`;
        groups.set(key, [...(groups.get(key) ?? []), odd]);
      }
      return {
        id: match.id,
        providerId: match.providerId,
        competition: match.competition,
        game: `${match.homeTeam} x ${match.awayTeam}`,
        startsAt: match.startsAt.toISOString(),
        score: match.homeScore == null ? null : `${match.homeScore} - ${match.awayScore}`,
        markets: [...groups.entries()].map(([key, values]) => ({
          key,
          market: values[0].market,
          selection: values[0].selection,
          opening: values[0].odd,
          closing: values.at(-1)!.odd,
          high: Math.max(...values.map((item) => item.odd)),
          low: Math.min(...values.map((item) => item.odd)),
          history: values.map((item) => ({ odd: item.odd, capturedAt: item.capturedAt.toISOString() })),
        })),
        tips: match.tips.map((tip) => ({
          id: tip.id,
          market: tip.market,
          selection: tip.selection,
          score: tip.confidenceScore,
          ev: tip.expectedValue * 100,
          aiScore: ai.predictions.find((item) => item.id === tip.id)?.aiScore ?? null,
        })),
      };
    }),
    providerHealth: await getProviderHealth(),
    configuration: getProviderConfiguration(),
    refreshedAt: new Date().toISOString(),
  };
}

export async function getReadinessReport() {
  let databaseReady = false;
  let databasePlatform = "UNKNOWN";
  try {
    const versionRows = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    databasePlatform = versionRows[0]?.version?.toLowerCase().includes("postgresql") ? "POSTGRESQL" : "OTHER";
    databaseReady = databasePlatform === "POSTGRESQL";
  } catch {
    databaseReady = false;
  }

  const [providers, training, latestJob, dataset, storage, migrationsApplied] = await Promise.all([
    getProviderHealth(),
    getTrainingStatus().catch(() => ({
      records: 0,
      minimum: 100,
      eligible: false,
      nextTrainingAt: 100,
      newRecordsSinceTraining: 0,
      confidence: getDataConfidence(0),
      latest: null,
    })),
    prisma.jobRun.findFirst({ orderBy: { scheduledAt: "desc" } }).catch(() => null),
    prisma.trainingDataset.count().catch(() => 0),
    checkBackupStorage(),
    countAppliedMigrations(),
  ]);

  const licensedReady = providers.some((provider) => provider.licensed && provider.configured);
  const mockDisabled = process.env.ALLOW_MOCK_PROVIDER?.trim().toLowerCase() !== "true";
  const backupConfigured = Boolean(process.env.BACKUP_DIR?.trim()) && storage.ok;
  const schedulerEnabled = isSchedulerEnabled();
  const schedulerReady = Boolean(schedulerEnabled && latestJob && Date.now() - latestJob.scheduledAt.getTime() < 60 * 60 * 1000);
  const migrationsReady = migrationsApplied > 0;
  const productionReady = databaseReady && migrationsReady && licensedReady && mockDisabled && schedulerReady && backupConfigured;

  const checks = [
    { label: "Producao pronta?", ready: productionReady, detail: productionReady ? "Infraestrutura essencial disponivel" : "Banco PostgreSQL, migrations, provider licenciado, mock desligado, scheduler recente e backup sao obrigatorios" },
    { label: "Banco pronto?", ready: databaseReady, detail: databaseReady ? "PostgreSQL conectado" : `Banco indisponivel ou plataforma invalida (${databasePlatform})` },
    { label: "Migrations aplicadas?", ready: migrationsReady, detail: `${migrationsApplied} migrations finalizadas` },
    { label: "Provider configurado?", ready: licensedReady, detail: licensedReady ? "Ao menos um provider licenciado configurado" : "Nenhum provider licenciado configurado" },
    { label: "Mock desligado?", ready: mockDisabled, detail: mockDisabled ? "ALLOW_MOCK_PROVIDER nao esta true" : "Desative mock antes do deploy real" },
    { label: "Scheduler ativo?", ready: schedulerReady, detail: !schedulerEnabled ? "SCHEDULER_ENABLED nao esta true" : latestJob ? `Ultimo job: ${latestJob.name}` : "Nenhum job recente" },
    { label: "Backup configurado?", ready: backupConfigured, detail: backupConfigured ? storage.directory : "Configure BACKUP_DIR ou storage externo" },
    { label: "Treinamento pronto?", ready: training.eligible, detail: training.eligible ? `${training.records} registros disponiveis` : `${training.records}/${training.minimum} resultados WON/LOST` },
    { label: "Dataset pronto?", ready: dataset > 0, detail: `${dataset} registros liquidados` },
  ];
  return {
    ready: productionReady,
    status: productionReady ? "GREEN" : databaseReady ? "YELLOW" : "RED",
    checks,
    providers,
    migrationsApplied,
    configuration: getProviderConfiguration(),
    generatedAt: new Date().toISOString(),
  };
}
