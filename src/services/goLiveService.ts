import { prisma } from "@/lib/prisma";
import { getProviderHealth } from "@/providers/providerManager";
import { getHealthStatus } from "./productionOperationsService";
import { getTrainingStatus } from "./modelTrainingService";
import { checkBackupStorage } from "./backupService";
import { auditEnvironment } from "./securityService";
import { schedulerFrequencies, isSchedulerEnabled } from "./schedulerService";
import { generateSettlementReport } from "./settlementEngine";
import { getResultCollectorReport } from "./resultCollectorEngine";

const clamp = (value: number, max = 20) => Math.max(0, Math.min(max, value));

export function classifyReadiness(score: number) {
  if (score >= 95) return "PRONTO PARA PRODUCAO";
  if (score >= 80) return "QUASE PRONTO";
  if (score >= 50) return "EM PREPARACAO";
  return "NAO PRONTO";
}

async function countAppliedMigrations() {
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function runProductionAudit() {
  let databaseConnected = false;
  let databasePlatform = "UNKNOWN";
  try {
    const versionRows = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    databaseConnected = true;
    databasePlatform = versionRows[0]?.version?.toLowerCase().includes("postgresql") ? "POSTGRESQL" : "OTHER";
  } catch {
    databaseConnected = false;
  }

  const [providers, health, training, storage, latestJob, jobs, datasetSize, settledTips, qualityAlerts, performanceRows, environment, migrationsApplied, settlement, resultCollector] = await Promise.all([
    getProviderHealth(),
    getHealthStatus().catch(() => ({ status: "RED" as const, checks: [], checkedAt: new Date().toISOString() })),
    getTrainingStatus().catch(() => ({ records: 0, minimum: 100, eligible: false, nextTrainingAt: 100, newRecordsSinceTraining: 0, confidence: { level: "MINIMA" as const, factor: 0, percentage: 0 }, latest: null })),
    checkBackupStorage(),
    prisma.jobRun.findFirst({ orderBy: { scheduledAt: "desc" } }).catch(() => null),
    prisma.jobRun.findMany({ orderBy: { scheduledAt: "desc" }, take: 100 }).catch(() => []),
    prisma.trainingDataset.count().catch(() => 0),
    prisma.tip.count({ where: { status: { in: ["WON", "LOST", "VOID"] } } }).catch(() => 0),
    prisma.dataQualityAlert.count({ where: { status: "OPEN", severity: "RED" } }).catch(() => 1),
    prisma.performance.count().catch(() => 0),
    Promise.resolve(auditEnvironment()),
    countAppliedMigrations(),
    generateSettlementReport().catch(() => ({ pending: 0, settled: 0, won: 0, lost: 0, voids: 0, winRate: 0, roi: 0, profit: 0, latestRun: null, performance: [], generatedAt: new Date().toISOString() })),
    getResultCollectorReport().catch(() => ({ status: "PENDING", provider: "NO_RESULT_SYNC", resultsReceived: 0, resultsPersisted: 0, matchesUpdated: 0, pendingResults: 0, tipsProcessed: 0, tipsSettled: 0, won: 0, lost: 0, voids: 0, settlementRate: 0, lastSync: null })),
  ]);

  const schedulerEnabled = isSchedulerEnabled();
  const schedulerActive = Boolean(schedulerEnabled && latestJob && Date.now() - latestJob.scheduledAt.getTime() <= Math.max(schedulerFrequencies.odds, schedulerFrequencies.results) * 3);
  const mockProviderDisabled = process.env.ALLOW_MOCK_PROVIDER?.trim().toLowerCase() !== "true";
  const configuredProviders = providers.filter((provider) => provider.licensed && provider.configured);
  const healthyProviders = configuredProviders.filter((provider) => provider.status !== "FAILED");
  const completedJobs = jobs.filter((job) => ["SUCCESS", "FAILED"].includes(job.status));
  const successfulJobs = completedJobs.filter((job) => job.status === "SUCCESS");
  const jobSuccessRate = completedJobs.length ? successfulJobs.length / completedJobs.length : 0;
  const backupConfigured = Boolean(process.env.BACKUP_DIR?.trim()) && storage.ok;
  const migrationsReady = migrationsApplied > 0;

  const infrastructure = clamp((databaseConnected && databasePlatform === "POSTGRESQL" ? 6 : 0) + (migrationsReady ? 2 : 0) + (schedulerActive ? 6 : 0) + (backupConfigured ? 2 : 0) + (environment.adminProtected ? 2 : 0) + (mockProviderDisabled ? 2 : 0));
  const data = clamp(Math.min(12, datasetSize / 100 * 12) + Math.min(8, settledTips / 100 * 8));
  const providerScore = clamp(healthyProviders.length ? 20 : configuredProviders.length ? 10 : 0);
  const performance = clamp(jobSuccessRate * 12 + (qualityAlerts === 0 ? 5 : 0) + (performanceRows > 0 ? 3 : 0));
  const trainingScore = clamp(training.latest ? 20 : Math.min(16, training.records / training.minimum * 16));
  const score = Math.round(infrastructure + data + providerScore + performance + trainingScore);
  const categories = [
    { name: "Infraestrutura", score: Math.round(infrastructure), max: 20 },
    { name: "Dados", score: Math.round(data), max: 20 },
    { name: "Providers", score: Math.round(providerScore), max: 20 },
    { name: "Performance", score: Math.round(performance), max: 20 },
    { name: "Treinamento", score: Math.round(trainingScore), max: 20 },
  ];
  const checklist = [
    { item: "Banco PostgreSQL conectado", ok: databaseConnected && databasePlatform === "POSTGRESQL", detail: databaseConnected ? `Plataforma detectada: ${databasePlatform}` : "DATABASE_URL PostgreSQL ou banco indisponivel" },
    { item: "Migrations aplicadas", ok: migrationsReady, detail: `${migrationsApplied} migrations finalizadas` },
    { item: "Mock provider desativado", ok: mockProviderDisabled, detail: mockProviderDisabled ? "ALLOW_MOCK_PROVIDER nao esta true" : "Desative ALLOW_MOCK_PROVIDER" },
    { item: "Provider licenciado configurado", ok: configuredProviders.length > 0, detail: configuredProviders.length ? configuredProviders.map((item) => item.id).join(", ") : "Configure uma API licenciada" },
    { item: "Provider saudavel", ok: healthyProviders.length > 0, detail: healthyProviders.length ? healthyProviders.map((item) => item.id).join(", ") : "Nenhum provider saudavel" },
    { item: "Scheduler habilitado", ok: schedulerEnabled, detail: schedulerEnabled ? "SCHEDULER_ENABLED=true" : "Esta instancia nao executa jobs internos" },
    { item: "Jobs funcionando", ok: schedulerActive, detail: latestJob ? `Ultimo job: ${latestJob.name} (${latestJob.status})` : "Nenhum job registrado" },
    { item: "Health sem RED", ok: health.status !== "RED", detail: health.status },
    { item: "Backup configurado", ok: backupConfigured, detail: backupConfigured ? storage.directory : "Configure BACKUP_DIR ou storage externo" },
    { item: "Admin protegido", ok: environment.adminProtected, detail: environment.adminProtected ? "Basic Auth configurado" : "ADMIN_USERNAME/ADMIN_PASSWORD ausentes" },
    { item: "Dataset minimo", ok: datasetSize >= 100, detail: `${datasetSize}/100 registros` },
    { item: "Tips liquidadas", ok: settledTips > 0, detail: `${settledTips} tips` },
    { item: "Settlement engine", ok: Boolean(settlement.latestRun) || settlement.pending === 0, detail: `${settlement.pending} pendentes, ${settlement.settled} liquidadas, ROI ${settlement.roi.toFixed(2)}%` },
    { item: "Result Sync real", ok: resultCollector.status === "SUCCESS" || resultCollector.resultsPersisted > 0, detail: `${resultCollector.resultsPersisted} resultados reais, ${resultCollector.tipsSettled} tips liquidadas, W/L/V ${resultCollector.won}/${resultCollector.lost}/${resultCollector.voids}` },
    { item: "Treinamento elegivel", ok: training.eligible, detail: `${training.records}/${training.minimum} WON/LOST` },
    { item: "Modelo treinado", ok: Boolean(training.latest), detail: training.latest?.version ?? "Nenhuma versao" },
    { item: "Sem alertas criticos de dados", ok: qualityAlerts === 0, detail: `${qualityAlerts} alertas RED abertos` },
  ];
  const criticalApproved = databaseConnected && databasePlatform === "POSTGRESQL" && migrationsReady && mockProviderDisabled && configuredProviders.length > 0 && healthyProviders.length > 0 && schedulerActive && backupConfigured && environment.adminProtected && health.status !== "RED";

  return {
    status: criticalApproved ? "APPROVED" : "PENDING",
    approved: criticalApproved,
    score,
    classification: criticalApproved ? "APPROVED" : classifyReadiness(score),
    categories,
    checklist,
    databaseConnected,
    databasePlatform,
    migrationsApplied,
    mockProviderDisabled,
    schedulerEnabled,
    schedulerActive,
    healthStatus: health.status,
    datasetSize,
    settledTips,
    settlement,
    resultCollector,
    providers,
    jobs: { total: completedJobs.length, successRate: Math.round(jobSuccessRate * 100), failed: completedJobs.length - successfulJobs.length, latest: latestJob ? { name: latestJob.name, status: latestJob.status, scheduledAt: latestJob.scheduledAt.toISOString() } : null },
    training,
    environment,
    generatedAt: new Date().toISOString(),
  };
}

export async function getAdminOverview() {
  const [audit, synchronizations, logs] = await Promise.all([
    runProductionAudit(),
    prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 25 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return { audit, synchronizations: synchronizations.map((item) => ({ ...item, startedAt: item.startedAt.toISOString(), completedAt: item.completedAt?.toISOString() ?? null })), logs: logs.map((item) => ({ id: item.id, category: item.category, status: item.status, message: item.message, createdAt: item.createdAt.toISOString() })) };
}
