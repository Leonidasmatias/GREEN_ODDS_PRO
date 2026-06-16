import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

type BackupTable = "tips" | "tip_results" | "settlement_runs" | "market_performance" | "performance" | "training_dataset" | "odds_snapshots";
type BackupFormat = "csv" | "json";

const backupDir = () => path.resolve(process.env.BACKUP_DIR?.trim() || "./backups");
const escapeCsv = (value: unknown) => { const text = value instanceof Date ? value.toISOString() : String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };

async function getRows(table: BackupTable) {
  if (table === "tips") return prisma.tip.findMany({ orderBy: { createdAt: "asc" } });
  if (table === "tip_results") return prisma.tipResult.findMany({ orderBy: { settledAt: "asc" } });
  if (table === "settlement_runs") return prisma.settlementRun.findMany({ orderBy: { startedAt: "asc" } });
  if (table === "market_performance") return prisma.marketPerformance.findMany({ orderBy: { updatedAt: "asc" } });
  if (table === "performance") return prisma.performance.findMany({ orderBy: { periodStart: "asc" } });
  if (table === "training_dataset") return prisma.trainingDataset.findMany({ orderBy: { settledAt: "asc" } });
  return prisma.oddsSnapshot.findMany({ orderBy: { capturedAt: "asc" } });
}

function serialize(rows: Array<Record<string, unknown>>, format: BackupFormat) {
  if (format === "json") return JSON.stringify(rows, null, 2);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return columns.length ? [columns.join(","), ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","))].join("\n") : "";
}

export async function exportBackup(table: BackupTable, format: BackupFormat) {
  const rows = await getRows(table) as unknown as Array<Record<string, unknown>>;
  return { content: serialize(rows, format), records: rows.length, contentType: format === "json" ? "application/json" : "text/csv; charset=utf-8", filename: `${table}.${format}` };
}

export async function runAutomaticBackup() {
  const directory = backupDir();
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const results = [];
  for (const table of ["tips", "tip_results", "settlement_runs", "market_performance", "performance", "training_dataset", "odds_snapshots"] as BackupTable[]) for (const format of ["csv", "json"] as BackupFormat[]) {
    const exported = await exportBackup(table, format);
    const filename = `${stamp}-${exported.filename}`;
    await writeFile(path.join(directory, filename), exported.content, "utf8");
    results.push({ table, format, filename, records: exported.records });
  }
  await prisma.auditLog.create({ data: { category: "BACKUP", status: "SUCCESS", message: `${results.length} arquivos de backup gerados.`, metadata: JSON.stringify({ directory, results }) } });
  return { directory, files: results };
}

export async function checkBackupStorage() {
  try { await mkdir(backupDir(), { recursive: true }); await access(backupDir()); return { ok: true, directory: backupDir() }; }
  catch (error) { return { ok: false, directory: backupDir(), error: error instanceof Error ? error.message : "Armazenamento indisponível" }; }
}
