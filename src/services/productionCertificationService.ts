import { prisma } from "@/lib/prisma";
import { getProviderHealth } from "@/providers/providerManager";
import { checkBackupStorage } from "./backupService";
import { auditEnvironment } from "./securityService";
import { runProductionAudit } from "./goLiveService";
import { getTrainingStatus } from "./modelTrainingService";
import { isSchedulerEnabled, schedulerFrequencies } from "./schedulerService";

type CertStatus = "REPROVADO" | "EM AJUSTE" | "APROVADO COM RESSALVAS" | "APROVADO PARA PRODUCAO";
const DAY = 24 * 60 * 60 * 1000;

function classifyProduction(score: number): CertStatus {
  if (score >= 95) return "APROVADO PARA PRODUCAO";
  if (score >= 80) return "APROVADO COM RESSALVAS";
  if (score >= 50) return "EM AJUSTE";
  return "REPROVADO";
}

function scoreBool(ok: boolean, weight: number) {
  return ok ? weight : 0;
}

async function countAppliedMigrations() {
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function countOrphanDatasetRows() {
  const rows = await prisma.trainingDataset.findMany({ select: { tipId: true } }).catch(() => []);
  if (!rows.length) return 0;
  const tips = await prisma.tip.findMany({ where: { id: { in: rows.map((row) => row.tipId) } }, select: { id: true } }).catch(() => []);
  const tipIds = new Set(tips.map((tip) => tip.id));
  return rows.filter((row) => !tipIds.has(row.tipId)).length;
}

export async function getDataAudit() {
  const [
    mockMatches,
    mockSnapshots,
    tipsOnMockMatches,
    invalidTipResults,
    settledWithoutDate,
    datasetRows,
    invalidDatasetResults,
    orphanDatasetRows,
  ] = await Promise.all([
    prisma.match.count({ where: { providerId: { startsWith: "mock" } } }).catch(() => 0),
    prisma.oddsSnapshot.count({ where: { provider: { startsWith: "mock" } } }).catch(() => 0),
    prisma.tip.count({ where: { match: { providerId: { startsWith: "mock" } } } }).catch(() => 0),
    prisma.tip.count({ where: { NOT: { status: { in: ["PENDING", "WON", "LOST", "VOID"] } } } }).catch(() => 0),
    prisma.tip.count({ where: { status: { in: ["WON", "LOST", "VOID"] }, settledAt: null } }).catch(() => 0),
    prisma.trainingDataset.count().catch(() => 0),
    prisma.trainingDataset.count({ where: { NOT: { result: { in: ["WON", "LOST", "VOID"] } } } }).catch(() => 0),
    countOrphanDatasetRows(),
  ]);

  const syntheticFindings = mockMatches + mockSnapshots + tipsOnMockMatches;
  const resultFindings = invalidTipResults + settledWithoutDate + invalidDatasetResults + orphanDatasetRows;
  const datasetOnlyReal = datasetRows === 0 ? true : orphanDatasetRows === 0 && invalidDatasetResults === 0;
  const checks = [
    { item: "Nenhum dado sintetico em producao", ok: syntheticFindings === 0, detail: `${syntheticFindings} registros vinculados a mock/sintetico` },
    { item: "Nenhuma tip ficticia", ok: tipsOnMockMatches === 0, detail: `${tipsOnMockMatches} tips vinculadas a matches mock` },
    { item: "Nenhum resultado inventado", ok: resultFindings === 0, detail: `${resultFindings} inconsistencias em status/liquidacao/dataset` },
    { item: "Dataset apenas com registros reais", ok: datasetOnlyReal, detail: `${datasetRows} registros no dataset; ${orphanDatasetRows} sem tip correspondente` },
  ];
  const status = checks.every((check) => check.ok) ? "APPROVED" : "FAILED";
  return {
    status,
    production: process.env.NODE_ENV === "production",
    summary: { mockMatches, mockSnapshots, tipsOnMockMatches, invalidTipResults, settledWithoutDate, datasetRows, invalidDatasetResults, orphanDatasetRows },
    checks,
    generatedAt: new Date().toISOString(),
  };
}

export async function getOperationMonitoring() {
  const since = new Date(Date.now() - 7 * DAY);
  const [jobs, providerCalls, syncRuns, settlements, performanceRows] = await Promise.all([
    prisma.jobRun.findMany({ where: { scheduledAt: { gte: since } }, orderBy: { scheduledAt: "desc" } }).catch(() => []),
    prisma.providerCall.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" } }).catch(() => []),
    prisma.syncRun.findMany({ where: { startedAt: { gte: since } }, orderBy: { startedAt: "desc" } }).catch(() => []),
    prisma.tip.count({ where: { settledAt: { gte: since } } }).catch(() => 0),
    prisma.performance.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" } }).catch(() => []),
  ]);
  const failedJobs = jobs.filter((job) => job.status === "FAILED");
  const failedProviders = providerCalls.filter((call) => call.status === "FAILED");
  const failedSyncs = syncRuns.filter((sync) => sync.status === "FAILED");
  const alerts = [
    ...failedJobs.slice(0, 10).map((job) => ({ level: "RED", type: "JOB", message: `${job.name}: ${job.message ?? "falha registrada"}`, timestamp: job.scheduledAt.toISOString() })),
    ...failedProviders.slice(0, 10).map((call) => ({ level: "YELLOW", type: "PROVIDER", message: `${call.provider}/${call.operation}: ${call.error ?? "falha registrada"}`, timestamp: call.createdAt.toISOString() })),
    ...failedSyncs.slice(0, 10).map((sync) => ({ level: "RED", type: "SYNC", message: `${sync.provider}/${sync.mode}: ${sync.warning ?? "falha registrada"}`, timestamp: sync.startedAt.toISOString() })),
  ];
  return {
    enabled: process.env.OPERATION_MONITORING?.trim().toLowerCase() === "true",
    windowDays: 7,
    summary: {
      jobs: jobs.length,
      failedJobs: failedJobs.length,
      providerCalls: providerCalls.length,
      failedProviderCalls: failedProviders.length,
      syncRuns: syncRuns.length,
      failedSyncs: failedSyncs.length,
      settlements,
      performanceUpdates: performanceRows.length,
    },
    alerts,
    generatedAt: new Date().toISOString(),
  };
}

export async function getProductionCertificate() {
  const [readiness, dataAudit, providers, storage, environment, training, monitoring, migrationsApplied] = await Promise.all([
    runProductionAudit(),
    getDataAudit(),
    getProviderHealth(),
    checkBackupStorage(),
    Promise.resolve(auditEnvironment()),
    getTrainingStatus().catch(() => ({ records: 0, minimum: 100, eligible: false, latest: null })),
    getOperationMonitoring(),
    countAppliedMigrations(),
  ]);

  const licensedProviders = providers.filter((provider) => provider.licensed && provider.configured);
  const healthyProviders = licensedProviders.filter((provider) => provider.status !== "FAILED");
  const latestProviderCall = providers.map((provider) => provider.lastCall).filter(Boolean).sort().at(-1) ?? null;
  const schedulerRecent = Boolean(readiness.jobs.latest && Date.now() - new Date(readiness.jobs.latest.scheduledAt).getTime() <= Math.max(schedulerFrequencies.odds, schedulerFrequencies.results) * 3);
  const backupsReady = Boolean(process.env.BACKUP_DIR?.trim()) && storage.ok;
  const dataApproved = dataAudit.checks.every((check) => check.ok) && dataAudit.summary.datasetRows > 0;
  const providerReady = licensedProviders.length > 0 && healthyProviders.length > 0;
  const securityReady = environment.adminProtected && !environment.missing.length && environment.anyProviderConfigured;
  const jobsReady = isSchedulerEnabled() && schedulerRecent && readiness.jobs.failed === 0;
  const trainingReady = Boolean("eligible" in training && training.eligible);

  const categories = [
    { name: "Infraestrutura", score: scoreBool(readiness.databaseConnected && readiness.databasePlatform === "POSTGRESQL", 6) + scoreBool(migrationsApplied > 0, 4) + scoreBool(readiness.schedulerEnabled, 3) + scoreBool(readiness.schedulerActive, 2), max: 15 },
    { name: "Dados", score: dataApproved ? 15 : dataAudit.checks.every((check) => check.ok) ? 8 : 0, max: 15 },
    { name: "Providers", score: providerReady ? 15 : licensedProviders.length ? 8 : 0, max: 15 },
    { name: "Seguranca", score: securityReady ? 15 : scoreBool(environment.adminProtected, 6) + scoreBool(!environment.missing.length, 4) + scoreBool(environment.anyProviderConfigured, 3) + 2, max: 15 },
    { name: "Jobs", score: jobsReady ? 15 : isSchedulerEnabled() ? 5 : 0, max: 15 },
    { name: "Backups", score: backupsReady ? 10 : storage.ok ? 4 : 0, max: 10 },
    { name: "Treinamento", score: trainingReady ? 15 : "records" in training ? Math.min(10, Math.floor(training.records / 10)) : 0, max: 15 },
  ];
  const productionScore = categories.reduce((sum, category) => sum + category.score, 0);
  const checklist = [
    { item: "PostgreSQL conectado", ok: readiness.databaseConnected && readiness.databasePlatform === "POSTGRESQL", detail: readiness.databasePlatform },
    { item: "Prisma operacional", ok: readiness.databaseConnected, detail: readiness.databaseConnected ? "Query de auditoria executada" : "Banco indisponivel" },
    { item: "Migrations aplicadas", ok: migrationsApplied > 0, detail: `${migrationsApplied} migrations finalizadas` },
    { item: "Scheduler ativo", ok: readiness.schedulerActive, detail: readiness.schedulerEnabled ? "SCHEDULER_ENABLED=true" : "Scheduler desligado" },
    { item: "Jobs executando", ok: jobsReady, detail: readiness.jobs.latest ? `${readiness.jobs.latest.name} ${readiness.jobs.latest.status}` : "Nenhum job recente" },
    { item: "Backup configurado", ok: backupsReady, detail: backupsReady ? storage.directory : "Configure BACKUP_DIR/storage externo" },
    { item: "Admin protegido", ok: environment.adminProtected, detail: environment.adminProtected ? "Credenciais configuradas" : "ADMIN_USERNAME/ADMIN_PASSWORD ausentes" },
    { item: "Dataset real", ok: dataApproved, detail: `${dataAudit.summary.datasetRows} registros, ${dataAudit.summary.orphanDatasetRows} orfaos` },
    { item: "Providers reais saudaveis", ok: providerReady, detail: healthyProviders.length ? healthyProviders.map((provider) => provider.id).join(", ") : "Nenhum provider real saudavel" },
    { item: "Treinamento elegivel", ok: trainingReady, detail: "records" in training ? `${training.records}/${training.minimum} registros` : "Status indisponivel" },
  ];
  const risks = checklist.filter((item) => !item.ok).map((item) => `${item.item}: ${item.detail}`);
  return {
    readinessScore: readiness.score,
    productionScore,
    classification: classifyProduction(productionScore),
    status: productionScore >= 95 ? "APPROVED" : "PENDING",
    categories,
    checklist,
    risks,
    pending: risks,
    infrastructure: {
      databaseConnected: readiness.databaseConnected,
      databasePlatform: readiness.databasePlatform,
      prismaOperational: readiness.databaseConnected,
      migrationsApplied,
      schedulerEnabled: readiness.schedulerEnabled,
      schedulerActive: readiness.schedulerActive,
      backupConfigured: backupsReady,
      adminProtected: environment.adminProtected,
    },
    dataAudit,
    providers: providers.map((provider) => ({ ...provider, lastSync: latestProviderCall })),
    security: environment,
    monitoring,
    generatedAt: new Date().toISOString(),
  };
}
