import { prisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;
const MOVEMENT_ALERT_LIMIT = 5;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function performanceFromTips(tips: Array<{ status: string; stake: number; profitLoss: number | null }>) {
  const settled = tips.filter((tip) => tip.status === "WON" || tip.status === "LOST");
  const greens = settled.filter((tip) => tip.status === "WON").length;
  const reds = settled.filter((tip) => tip.status === "LOST").length;
  const totalStake = settled.reduce((sum, tip) => sum + tip.stake, 0);
  const profit = settled.reduce((sum, tip) => sum + (tip.profitLoss ?? 0), 0);
  return {
    roi: round(totalStake ? (profit / totalStake) * 100 : 0),
    yield: round(totalStake ? (profit / totalStake) * 100 : 0),
    winRate: round(settled.length ? (greens / settled.length) * 100 : 0),
    greens,
    reds,
    profit: round(profit),
    entries: settled.length,
  };
}

function marketGroup(market: string, selection = "") {
  const text = `${market} ${selection}`.toLowerCase();
  if (text.includes("over 1.5") || text.includes("mais de 1.5")) return "Over 1.5";
  if (text.includes("over 2.5") || text.includes("mais de 2.5")) return "Over 2.5";
  if (text.includes("over 3.5") || text.includes("mais de 3.5")) return "Over 3.5";
  if (text.includes("ambas") || text.includes("btts")) return "BTTS";
  if (text.includes("escante")) return "Escanteios";
  if (text.includes("cart")) return "Cartões";
  if (text.includes("handicap")) return "Handicap";
  return "1X2";
}

async function getMovements(limit = 20) {
  const snapshots = await prisma.oddsSnapshot.findMany({
    include: { match: true },
    orderBy: { capturedAt: "asc" },
  });
  const groups = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.matchId}:${snapshot.market}:${snapshot.selection}`;
    groups.set(key, [...(groups.get(key) ?? []), snapshot]);
  }
  return [...groups.values()].map((items) => {
    const opening = items[0];
    const current = items.at(-1)!;
    const variation = opening.odd ? ((current.odd - opening.odd) / opening.odd) * 100 : 0;
    const type = current.match.status === "FINISHED" ? "FECHAMENTO" : items.length === 1 ? "ABERTURA" : variation > 0 ? "SUBIDA" : variation < 0 ? "QUEDA" : "ESTÁVEL";
    return {
      id: `${current.matchId}-${current.market}-${current.selection}`,
      game: `${current.match.homeTeam} x ${current.match.awayTeam}`,
      market: current.market,
      selection: current.selection,
      openingOdd: opening.odd,
      currentOdd: current.odd,
      variation: round(variation),
      type,
      timestamp: current.capturedAt.toISOString(),
    };
  }).sort((a, b) => Math.abs(b.variation) - Math.abs(a.variation)).slice(0, limit);
}

async function getTopOpportunities() {
  const tips = await prisma.tip.findMany({ where: { status: "PENDING" }, orderBy: [{ expectedValue: "desc" }, { confidenceScore: "desc" }], take: 20 });
  if (!tips.length) return [];
  return tips.map((tip) => ({ id: tip.id, game: tip.gameLabel, market: tip.market, selection: tip.selection, odd: tip.odd, ev: round(tip.expectedValue * 100), score: round(tip.confidenceScore, 1), powerRating: round(tip.confidenceScore, 1), risk: tip.risk, status: tip.classification }));
}

export async function getAlerts() {
  const [opportunities, movements] = await Promise.all([getTopOpportunities(), getMovements(50)]);
  const alerts = opportunities.flatMap((item) => {
    const reasons = [];
    if (item.score > 90) reasons.push(`Score ${item.score}`);
    if (item.ev > 10) reasons.push(`EV ${item.ev}%`);
    if (!reasons.length) return [];
    return [{ id: `opportunity-${item.id}`, level: item.score > 90 && item.ev > 10 ? "ELITE" : "PREMIUM", title: item.game, detail: `${item.market} · ${item.selection}`, reason: reasons.join(" · "), timestamp: new Date().toISOString() }];
  });
  for (const movement of movements.filter((item) => Math.abs(item.variation) >= MOVEMENT_ALERT_LIMIT)) {
    alerts.push({ id: `movement-${movement.id}`, level: "ATENÇÃO", title: movement.game, detail: `${movement.market} · ${movement.selection}`, reason: `Odd em ${movement.type.toLowerCase()}: ${movement.variation > 0 ? "+" : ""}${movement.variation}%`, timestamp: movement.timestamp });
  }
  return alerts.slice(0, 30);
}

export async function getPerformance() {
  const now = Date.now();
  const [tips7, tips30, tips90, allSettled] = await Promise.all([
    prisma.tip.findMany({ where: { settledAt: { gte: new Date(now - 7 * DAY) } } }),
    prisma.tip.findMany({ where: { settledAt: { gte: new Date(now - 30 * DAY) } } }),
    prisma.tip.findMany({ where: { settledAt: { gte: new Date(now - 90 * DAY) } } }),
    prisma.tip.findMany({ where: { status: { in: ["WON", "LOST"] } } }),
  ]);
  const marketNames = ["1X2", "Over 1.5", "Over 2.5", "Over 3.5", "BTTS", "Escanteios", "Cartões", "Handicap"];
  const rankings = marketNames.map((market) => ({ market, ...performanceFromTips(allSettled.filter((tip) => marketGroup(tip.market, tip.selection) === market)) })).sort((a, b) => b.roi - a.roi || b.winRate - a.winRate || b.profit - a.profit);
  return { periods: [{ label: "Últimos 7 dias", days: 7, ...performanceFromTips(tips7) }, { label: "Últimos 30 dias", days: 30, ...performanceFromTips(tips30) }, { label: "Últimos 90 dias", days: 90, ...performanceFromTips(tips90) }], rankings };
}

export async function getCommandCenter() {
  const today = startOfToday();
  const [gamesToday, oddsToday, generatedToday, settledToday, allTips, latestSync, opportunities, movements, alerts, performance] = await Promise.all([
    prisma.match.count({ where: { startsAt: { gte: today } } }),
    prisma.oddsSnapshot.count({ where: { capturedAt: { gte: today } } }),
    prisma.tip.count({ where: { createdAt: { gte: today } } }),
    prisma.tip.count({ where: { settledAt: { gte: today } } }),
    prisma.tip.findMany(),
    prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    getTopOpportunities(), getMovements(), getAlerts(), getPerformance(),
  ]);
  const totals = performanceFromTips(allTips);
  return { summary: { gamesToday, oddsToday, generatedToday, settledToday, greens: totals.greens, reds: totals.reds, roi: totals.roi, winRate: totals.winRate, lastSync: latestSync?.completedAt?.toISOString() ?? null, syncStatus: latestSync?.status ?? "NOT_RUN" }, opportunities, movements, alerts, performance, refreshedAt: new Date().toISOString() };
}

export async function getAudit() {
  try {
    const [snapshots, settlements, failedSyncs, logs, matches, tips, datasetRows] = await Promise.all([
      prisma.oddsSnapshot.count(), prisma.tip.count({ where: { status: { in: ["WON", "LOST", "VOID"] } } }), prisma.syncRun.count({ where: { status: "FAILED" } }), prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }), prisma.match.count(), prisma.tip.count(), prisma.trainingDataset.count(),
    ]);
    const duplicatesAvoided = logs.filter((log) => log.category === "DUPLICATE").reduce((sum, log) => { try { return sum + Number(JSON.parse(log.metadata ?? "{}").count ?? 0); } catch { return sum; } }, 0);
    return { summary: { snapshots, settlements, failedSyncs, duplicatesAvoided, matches, tips, datasetRows, databaseIntegrity: "ÍNTEGRO" }, logs: logs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })), checkedAt: new Date().toISOString() };
  } catch (error) {
    return { summary: { snapshots: 0, settlements: 0, failedSyncs: 0, duplicatesAvoided: 0, matches: 0, tips: 0, datasetRows: 0, databaseIntegrity: "FALHA" }, logs: [], checkedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Falha ao auditar o banco" };
  }
}
