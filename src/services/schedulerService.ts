import { prisma } from "@/lib/prisma";
import { redactSecrets } from "./securityService";

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
const intervalMinutes = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 1 ? value : fallback;
};

export const schedulerFrequencies = {
  odds: intervalMinutes("ODDS_SYNC_INTERVAL_MINUTES", 15) * minute,
  results: intervalMinutes("RESULTS_SYNC_INTERVAL_MINUTES", 15) * minute,
  performance: hour,
  dataset: day,
  dataQuality: hour,
  backup: day,
};

type JobName = "ODDS_SYNC" | "RESULT_SYNC" | "RESULTS_SYNC" | "SETTLEMENT_SYNC" | "PERFORMANCE_UPDATE" | "TRAINING_DATASET" | "ML_TRAINING" | "AUTO_DISCOVERY" | "BANKROLL_RECALCULATION" | "RISK_MONITORING" | "PERFORMANCE_ATTRIBUTION" | "ADAPTIVE_STRATEGY" | "DATA_QUALITY_AUDIT" | "BACKUP";
const running = new Set<JobName>();
const schedulerOwnerId = globalThis.crypto?.randomUUID?.() ?? `scheduler-${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function acquireLease(name: JobName, leaseMs: number) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseMs);
  await prisma.schedulerLease.upsert({ where: { id: name }, update: {}, create: { id: name, ownerId: schedulerOwnerId, expiresAt: new Date(0) } }).catch(() => undefined);
  const acquired = await prisma.schedulerLease.updateMany({ where: { id: name, OR: [{ expiresAt: { lt: now } }, { ownerId: schedulerOwnerId }] }, data: { ownerId: schedulerOwnerId, expiresAt } });
  return acquired.count === 1;
}

async function releaseLease(name: JobName) {
  await prisma.schedulerLease.updateMany({ where: { id: name, ownerId: schedulerOwnerId }, data: { expiresAt: new Date() } }).catch(() => undefined);
}

async function runJob(name: JobName, task: () => Promise<unknown>) {
  if (running.has(name)) return;
  if (!(await acquireLease(name, 30 * minute))) return;
  running.add(name);
  const job = await prisma.jobRun.create({ data: { name, status: "PENDING" } });
  const startedAt = new Date();
  await prisma.jobRun.update({ where: { id: job.id }, data: { status: "RUNNING", startedAt } });
  try {
    const result = await task();
    const completedAt = new Date();
    await prisma.jobRun.update({ where: { id: job.id }, data: { status: "SUCCESS", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), message: `${name} concluido.`, metadata: JSON.stringify(result) } });
  } catch (error) {
    const completedAt = new Date();
    const message = redactSecrets(error instanceof Error ? error.message : "Falha desconhecida");
    await prisma.jobRun.update({ where: { id: job.id }, data: { status: "FAILED", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), message } }).catch(() => undefined);
    await prisma.auditLog.create({ data: { category: "SCHEDULER", status: "FAILED", message: `${name}: ${message}` } }).catch(() => undefined);
  } finally {
    running.delete(name);
    await releaseLease(name);
  }
}

function schedule(name: JobName, interval: number, task: () => Promise<unknown>) {
  setTimeout(() => void runJob(name, task), 5_000).unref();
  setInterval(() => void runJob(name, task), interval).unref();
}

export function startScheduler() {
  const globalScheduler = globalThis as typeof globalThis & { productionSchedulerStarted?: boolean };
  if (process.env.SCHEDULER_ENABLED?.trim().toLowerCase() !== "true") {
    console.log("[startup] scheduler disabled by SCHEDULER_ENABLED");
    return;
  }
  if (globalScheduler.productionSchedulerStarted) return;
  globalScheduler.productionSchedulerStarted = true;
  console.log("[startup] scheduler enabled");

  schedule("ODDS_SYNC", schedulerFrequencies.odds, async () => {
    const { syncOddsAndTips } = await import("./syncService");
    const result = await syncOddsAndTips();
    if (!result.ok) throw new Error(result.warning ?? "Sincronizacao real indisponivel");
    return result;
  });
  schedule("RESULT_SYNC", schedulerFrequencies.results, async () => (await import("./resultCollectorEngine")).syncFinishedMatches());
  schedule("PERFORMANCE_UPDATE", schedulerFrequencies.performance, async () => (await import("./operationalService")).getPerformance());
  schedule("TRAINING_DATASET", schedulerFrequencies.dataset, async () => {
    const pipeline = await import("./trainingPipeline");
    const training = await import("./modelTrainingService");
    return { build: await pipeline.buildTrainingDataset(), validation: await pipeline.validateDataset(), metrics: await pipeline.generateTrainingMetrics(), training: await training.trainModelIfEligible() };
  });
  schedule("ML_TRAINING", schedulerFrequencies.dataset, async () => (await import("./mlEngine")).trainBaselineModel());
  schedule("AUTO_DISCOVERY", schedulerFrequencies.dataset, async () => (await import("./autoDiscoveryEngine")).runAutoDiscovery());
  schedule("BANKROLL_RECALCULATION", schedulerFrequencies.performance, async () => (await import("./bankrollEngine")).recalculateBankrollRecommendations());
  schedule("RISK_MONITORING", schedulerFrequencies.performance, async () => (await import("./riskShieldEngine")).runRiskMonitoring());
  schedule("PERFORMANCE_ATTRIBUTION", schedulerFrequencies.performance, async () => (await import("./performanceAttributionEngine")).runPerformanceAttribution());
  schedule("ADAPTIVE_STRATEGY", schedulerFrequencies.performance, async () => (await import("./adaptiveStrategyEngine")).runAdaptiveStrategy());
  schedule("DATA_QUALITY_AUDIT", schedulerFrequencies.dataQuality, async () => (await import("./dataQualityService")).runDataQualityChecks());
}

export function isSchedulerEnabled() {
  return process.env.SCHEDULER_ENABLED?.trim().toLowerCase() === "true";
}

export async function getJobMonitor() {
  const [runs, pending, failed, latestSync] = await Promise.all([
    prisma.jobRun.findMany({ orderBy: { scheduledAt: "desc" }, take: 100 }),
    prisma.jobRun.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    prisma.jobRun.count({ where: { status: "FAILED" } }),
    prisma.jobRun.findFirst({ where: { name: "ODDS_SYNC", status: "SUCCESS" }, orderBy: { completedAt: "desc" } }),
  ]);
  return { summary: { executed: runs.filter((run) => ["SUCCESS", "FAILED"].includes(run.status)).length, pending, failed, averageDurationMs: runs.filter((run) => run.durationMs != null).length ? Math.round(runs.reduce((sum, run) => sum + (run.durationMs ?? 0), 0) / runs.filter((run) => run.durationMs != null).length) : 0, lastSync: latestSync?.completedAt?.toISOString() ?? null }, frequenciesMinutes: { odds: schedulerFrequencies.odds / minute, results: schedulerFrequencies.results / minute }, runs: runs.map((run) => ({ ...run, scheduledAt: run.scheduledAt.toISOString(), startedAt: run.startedAt?.toISOString() ?? null, completedAt: run.completedAt?.toISOString() ?? null })) };
}
