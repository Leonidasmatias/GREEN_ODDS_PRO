import { prisma } from "@/lib/prisma";
import { syncOddsAndTips } from "./syncService";
import { importResultsAndSettle } from "./resultImportService";
import { getPerformance } from "./operationalService";
import { buildTrainingDataset, generateTrainingMetrics, validateDataset } from "./trainingPipeline";
import { trainModelIfEligible } from "./modelTrainingService";
import { trainBaselineModel } from "./mlEngine";
import { runAutoDiscovery } from "./autoDiscoveryEngine";
import { recalculateBankrollRecommendations } from "./bankrollEngine";
import { runRiskMonitoring } from "./riskShieldEngine";
import { runPerformanceAttribution } from "./performanceAttributionEngine";
import { runDataQualityChecks } from "./dataQualityService";
import { runAutomaticBackup } from "./backupService";
import { redactSecrets } from "./securityService";
import { randomUUID } from "node:crypto";

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
const intervalMinutes = (name: string, fallback: number) => { const value = Number(process.env[name]); return Number.isFinite(value) && value >= 1 ? value : fallback; };

export const schedulerFrequencies = {
  odds: intervalMinutes("ODDS_SYNC_INTERVAL_MINUTES", 15) * minute,
  results: intervalMinutes("RESULTS_SYNC_INTERVAL_MINUTES", 15) * minute,
  settlement: intervalMinutes("SETTLEMENT_SYNC_INTERVAL_MINUTES", 15) * minute,
  performance: hour,
  dataset: day,
  dataQuality: hour,
  backup: day,
};

type JobName = "ODDS_SYNC" | "RESULTS_SYNC" | "SETTLEMENT_SYNC" | "PERFORMANCE_UPDATE" | "TRAINING_DATASET" | "ML_TRAINING" | "AUTO_DISCOVERY" | "BANKROLL_RECALCULATION" | "RISK_MONITORING" | "PERFORMANCE_ATTRIBUTION" | "DATA_QUALITY" | "BACKUP";
const running = new Set<JobName>();
const schedulerOwnerId = randomUUID();

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
    await prisma.jobRun.update({ where: { id: job.id }, data: { status: "SUCCESS", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), message: `${name} concluído.`, metadata: JSON.stringify(result) } });
  } catch (error) {
    const completedAt = new Date();
    const message = redactSecrets(error instanceof Error ? error.message : "Falha desconhecida");
    await prisma.jobRun.update({ where: { id: job.id }, data: { status: "FAILED", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), message } }).catch(() => undefined);
    await prisma.auditLog.create({ data: { category: "SCHEDULER", status: "FAILED", message: `${name}: ${message}` } }).catch(() => undefined);
  } finally { running.delete(name); await releaseLease(name); }
}

function schedule(name: JobName, interval: number, task: () => Promise<unknown>) {
  setTimeout(() => void runJob(name, task), 5_000).unref();
  setInterval(() => void runJob(name, task), interval).unref();
}

export function startScheduler() {
  const globalScheduler = globalThis as typeof globalThis & { productionSchedulerStarted?: boolean };
  if (process.env.SCHEDULER_ENABLED?.trim().toLowerCase() !== "true") return;
  if (globalScheduler.productionSchedulerStarted) return;
  globalScheduler.productionSchedulerStarted = true;
  schedule("ODDS_SYNC", schedulerFrequencies.odds, async () => { const result = await syncOddsAndTips(); if (!result.ok) throw new Error(result.warning ?? "Sincronização real indisponível"); return result; });
  schedule("SETTLEMENT_SYNC", schedulerFrequencies.settlement, importResultsAndSettle);
  schedule("PERFORMANCE_UPDATE", schedulerFrequencies.performance, getPerformance);
  schedule("TRAINING_DATASET", schedulerFrequencies.dataset, async () => ({ build: await buildTrainingDataset(), validation: await validateDataset(), metrics: await generateTrainingMetrics(), training: await trainModelIfEligible() }));
  schedule("ML_TRAINING", schedulerFrequencies.dataset, trainBaselineModel);
  schedule("AUTO_DISCOVERY", schedulerFrequencies.dataset, runAutoDiscovery);
  schedule("BANKROLL_RECALCULATION", schedulerFrequencies.performance, recalculateBankrollRecommendations);
  schedule("RISK_MONITORING", schedulerFrequencies.performance, runRiskMonitoring);
  schedule("PERFORMANCE_ATTRIBUTION", schedulerFrequencies.performance, runPerformanceAttribution);
  schedule("DATA_QUALITY", schedulerFrequencies.dataQuality, runDataQualityChecks);
  schedule("BACKUP", schedulerFrequencies.backup, runAutomaticBackup);
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
  return { summary: { executed: runs.filter((run) => ["SUCCESS", "FAILED"].includes(run.status)).length, pending, failed, averageDurationMs: runs.filter((run) => run.durationMs != null).length ? Math.round(runs.reduce((sum, run) => sum + (run.durationMs ?? 0), 0) / runs.filter((run) => run.durationMs != null).length) : 0, lastSync: latestSync?.completedAt?.toISOString() ?? null }, frequenciesMinutes: { odds: schedulerFrequencies.odds / minute, results: schedulerFrequencies.results / minute, settlement: schedulerFrequencies.settlement / minute }, runs: runs.map((run) => ({ ...run, scheduledAt: run.scheduledAt.toISOString(), startedAt: run.startedAt?.toISOString() ?? null, completedAt: run.completedAt?.toISOString() ?? null })) };
}
