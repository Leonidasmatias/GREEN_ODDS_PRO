import { prisma } from "@/lib/prisma";
import { generateFeatures } from "./featureEngineering";

export type DatasetExportFormat = "csv" | "json";

export async function buildTrainingDataset() {
  const tips = await prisma.tip.findMany({ where: { status: { in: ["WON", "LOST", "VOID"] }, settledAt: { not: null } }, orderBy: { settledAt: "asc" } });
  const validTipIds = new Set(tips.map((tip) => tip.id));
  const existingRows = await prisma.trainingDataset.findMany({ select: { id: true, tipId: true } });
  const staleIds = existingRows.filter((row) => !validTipIds.has(row.tipId)).map((row) => row.id);
  if (staleIds.length) await prisma.trainingDataset.deleteMany({ where: { id: { in: staleIds } } });
  let created = 0;
  let updated = 0;
  for (const tip of tips) {
    const features = await generateFeatures({ matchId: tip.matchId, market: tip.market, selection: tip.selection, score: tip.confidenceScore, impliedProbability: tip.impliedProbability, estimatedProbability: tip.estimatedProbability, gameLabel: tip.gameLabel });
    const existing = await prisma.trainingDataset.findUnique({ where: { tipId: tip.id }, select: { id: true } });
    const data = { matchId: tip.matchId, market: tip.market, odd: tip.odd, impliedProbability: tip.impliedProbability, estimatedProbability: tip.estimatedProbability, score: tip.confidenceScore, ev: tip.expectedValue, edge: features.edge, risk: tip.risk, result: tip.status, profit: tip.profitLoss ?? 0, generatedAt: tip.createdAt, settledAt: tip.settledAt!, oddsMovement: features.oddsMovement, powerRating: features.powerRating, recentForm: features.recentForm };
    await prisma.trainingDataset.upsert({ where: { tipId: tip.id }, update: data, create: { tipId: tip.id, ...data } });
    if (existing) updated += 1; else created += 1;
  }
  await prisma.auditLog.create({ data: { category: "TRAINING", status: "SUCCESS", message: `${tips.length} registros processados no dataset.`, metadata: JSON.stringify({ processed: tips.length, created, updated }) } });
  return { processed: tips.length, created, updated, removed: staleIds.length };
}

export async function validateDataset() {
  const rows = await prisma.trainingDataset.findMany();
  const issues: string[] = [];
  for (const row of rows) {
    if (row.odd <= 1) issues.push(`${row.id}: odd inválida`);
    if (row.score < 0 || row.score > 100) issues.push(`${row.id}: score fora da escala`);
    if (row.impliedProbability < 0 || row.impliedProbability > 1) issues.push(`${row.id}: probabilidade implícita inválida`);
    if (row.estimatedProbability < 0 || row.estimatedProbability > 1) issues.push(`${row.id}: probabilidade estimada inválida`);
    if (!["WON", "LOST", "VOID"].includes(row.result)) issues.push(`${row.id}: resultado inválido`);
  }
  return { valid: issues.length === 0, records: rows.length, issues };
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportTrainingDataset(format: DatasetExportFormat) {
  const rows = await prisma.trainingDataset.findMany({ orderBy: { settledAt: "asc" } });
  if (format === "json") return { content: JSON.stringify(rows, null, 2), contentType: "application/json", filename: "green-ai-training-dataset.json", records: rows.length };
  const columns = ["matchId", "market", "odd", "impliedProbability", "estimatedProbability", "score", "ev", "edge", "risk", "result", "profit", "generatedAt", "settledAt", "oddsMovement", "powerRating", "recentForm"] as const;
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","))].join("\n");
  return { content: csv, contentType: "text/csv; charset=utf-8", filename: "green-ai-training-dataset.csv", records: rows.length };
}

export async function generateTrainingMetrics() {
  const rows = await prisma.trainingDataset.findMany();
  const decided = rows.filter((row) => row.result === "WON" || row.result === "LOST");
  const greens = decided.filter((row) => row.result === "WON").length;
  const profit = rows.reduce((sum, row) => sum + row.profit, 0);
  const byMarket = [...new Set(rows.map((row) => row.market))].map((market) => {
    const marketRows = rows.filter((row) => row.market === market && row.result !== "VOID");
    const marketGreens = marketRows.filter((row) => row.result === "WON").length;
    return { market, records: marketRows.length, winRate: marketRows.length ? marketGreens / marketRows.length * 100 : 0, roi: marketRows.length ? marketRows.reduce((sum, row) => sum + row.profit, 0) / marketRows.length * 100 : 0, averageScore: marketRows.length ? marketRows.reduce((sum, row) => sum + row.score, 0) / marketRows.length : 0 };
  }).sort((a, b) => b.roi - a.roi);
  return { records: rows.length, trainingRecords: decided.length, won: greens, lost: decided.length - greens, void: rows.length - decided.length, winRate: decided.length ? greens / decided.length * 100 : 0, profit, averageScore: rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : 0, byMarket };
}
