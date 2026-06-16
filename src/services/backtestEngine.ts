import { prisma } from "@/lib/prisma";

export interface AutomaticBacktestMetrics {
  period: string;
  entries: number;
  greens: number;
  reds: number;
  roi: number;
  yield: number;
  winRate: number;
  profit: number;
  drawdown: number;
}

function calculate(rows: Array<{ result: string; profit: number }>, period: string): AutomaticBacktestMetrics {
  let cumulative = 0;
  let peak = 0;
  let drawdown = 0;
  for (const row of rows) {
    cumulative += row.profit;
    peak = Math.max(peak, cumulative);
    drawdown = Math.max(drawdown, peak - cumulative);
  }
  const decided = rows.filter((row) => row.result === "WON" || row.result === "LOST");
  const greens = decided.filter((row) => row.result === "WON").length;
  const roi = decided.length ? cumulative / decided.length * 100 : 0;
  return { period, entries: decided.length, greens, reds: decided.length - greens, roi, yield: roi, winRate: decided.length ? greens / decided.length * 100 : 0, profit: cumulative, drawdown };
}

export async function runAutomaticBacktests() {
  const rows = await prisma.trainingDataset.findMany({ where: { result: { in: ["WON", "LOST"] } }, orderBy: { settledAt: "asc" } });
  const now = Date.now();
  return [
    calculate(rows.filter((row) => row.settledAt.getTime() >= now - 30 * 86400000), "Últimos 30 dias"),
    calculate(rows.filter((row) => row.settledAt.getTime() >= now - 90 * 86400000), "Últimos 90 dias"),
    calculate(rows, "Histórico completo"),
  ];
}

export async function getMarketBacktests() {
  const rows = await prisma.trainingDataset.findMany({ where: { result: { in: ["WON", "LOST"] } }, orderBy: { settledAt: "asc" } });
  return [...new Set(rows.map((row) => row.market))].map((market) => calculate(rows.filter((row) => row.market === market), market)).sort((a, b) => b.roi - a.roi || b.winRate - a.winRate);
}

export async function getModelEvolution() {
  const rows = await prisma.trainingDataset.findMany({ where: { result: { in: ["WON", "LOST"] } }, orderBy: { settledAt: "asc" } });
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.settledAt.toISOString().slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([month, items]) => ({ month, ...calculate(items, month) }));
}
