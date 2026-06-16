import { prisma } from "@/lib/prisma";
import { trainModelIfEligible } from "./modelTrainingService";
import { redactSecrets } from "./securityService";

export type SettledTipStatus = "WON" | "LOST" | "VOID";
export type TipSettlementStatus = SettledTipStatus | "PENDING";

const MIN_ELITE_MARKET_SAMPLE = 30;

function parseThreshold(selection: string) {
  const match = selection.match(/(?:mais de|over|menos de|under)\s*([+-]?\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : null;
}

export function oddRange(odd: number) {
  if (odd < 1.5) return "1.00-1.49";
  if (odd < 2) return "1.50-1.99";
  if (odd < 3) return "2.00-2.99";
  if (odd < 5) return "3.00-4.99";
  return "5.00+";
}

export function calculateTipResult(input: { market: string; selection: string; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null; matchStatus: string }): TipSettlementStatus {
  if (input.matchStatus === "CANCELLED") return "VOID";
  if (input.matchStatus !== "FINISHED" || input.homeScore == null || input.awayScore == null) return "PENDING";

  const normalizedMarket = input.market.toLowerCase();
  const normalizedSelection = input.selection.toLowerCase();
  const homeTeam = input.homeTeam.toLowerCase();
  const awayTeam = input.awayTeam.toLowerCase();
  const totalGoals = input.homeScore + input.awayScore;

  if (normalizedMarket.includes("total") || normalizedMarket.includes("over") || normalizedMarket.includes("under") || normalizedMarket.includes("goals")) {
    const threshold = parseThreshold(input.selection);
    if (threshold === null || totalGoals === threshold) return "VOID";
    const isOver = normalizedSelection.includes("mais de") || normalizedSelection.includes("over");
    return (isOver ? totalGoals > threshold : totalGoals < threshold) ? "WON" : "LOST";
  }

  if (normalizedMarket.includes("ambas marcam") || normalizedMarket.includes("both teams") || normalizedMarket.includes("btts")) {
    const bothScored = input.homeScore > 0 && input.awayScore > 0;
    const wantsYes = normalizedSelection.includes("sim") || normalizedSelection.includes("yes");
    return bothScored === wantsYes ? "WON" : "LOST";
  }

  if (normalizedMarket.includes("dupla chance") || normalizedMarket.includes("double chance")) {
    const wins = (normalizedSelection.includes(homeTeam) && input.homeScore > input.awayScore) || (normalizedSelection.includes(awayTeam) && input.awayScore > input.homeScore) || ((normalizedSelection.includes("empate") || normalizedSelection.includes("draw")) && input.homeScore === input.awayScore);
    return wins ? "WON" : "LOST";
  }

  if (normalizedMarket.includes("handicap") || normalizedMarket.includes("spreads")) {
    const pointMatch = input.selection.match(/([+-]?\d+(?:\.\d+)?)\s*$/);
    if (!pointMatch) return "VOID";
    const point = Number(pointMatch[1]);
    const isHome = normalizedSelection.includes(homeTeam);
    const isAway = normalizedSelection.includes(awayTeam);
    if (!isHome && !isAway) return "VOID";
    const adjusted = (isHome ? input.homeScore - input.awayScore : input.awayScore - input.homeScore) + point;
    return adjusted > 0 ? "WON" : adjusted < 0 ? "LOST" : "VOID";
  }

  if (normalizedMarket.includes("vitoria") || normalizedMarket.includes("vitória") || normalizedMarket === "1x2" || normalizedMarket.includes("match winner") || normalizedMarket === "h2h") {
    const wins = (normalizedSelection.includes(homeTeam) && input.homeScore > input.awayScore) || (normalizedSelection.includes(awayTeam) && input.awayScore > input.homeScore) || ((normalizedSelection.includes("empate") || normalizedSelection.includes("draw")) && input.homeScore === input.awayScore);
    return wins ? "WON" : "LOST";
  }

  return "VOID";
}

function calculateProfit(status: SettledTipStatus, odd: number, stake: number) {
  if (status === "WON") return stake * (odd - 1);
  if (status === "LOST") return -stake;
  return 0;
}

function maxDrawdownFromProfits(profits: number[]) {
  let balance = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const profit of profits) {
    balance += profit;
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, peak - balance);
  }
  return maxDrawdown;
}

export async function updateMarketPerformance() {
  const tips = await prisma.tip.findMany({
    where: { status: { in: ["WON", "LOST", "VOID"] }, settledAt: { not: null }, match: { providerId: { not: { startsWith: "mock" } } } },
    include: { match: true },
    orderBy: { settledAt: "asc" },
  });
  const groups = new Map<string, typeof tips>();
  for (const tip of tips) {
    const key = [tip.market, tip.selection, tip.match.competition, tip.provider, tip.bookmaker, oddRange(tip.odd)].join("||");
    groups.set(key, [...(groups.get(key) ?? []), tip]);
  }

  const rows = [];
  for (const [key, group] of groups.entries()) {
    const [market, selection, sport, provider, bookmaker, range] = key.split("||");
    const decided = group.filter((tip) => tip.status === "WON" || tip.status === "LOST");
    const wins = decided.filter((tip) => tip.status === "WON").length;
    const losses = decided.filter((tip) => tip.status === "LOST").length;
    const voids = group.filter((tip) => tip.status === "VOID").length;
    const totalStake = decided.reduce((sum, tip) => sum + tip.stakeSuggested, 0);
    const profit = group.reduce((sum, tip) => sum + (tip.profit ?? tip.profitLoss ?? 0), 0);
    const averageOdd = group.reduce((sum, tip) => sum + tip.odd, 0) / group.length;
    const roi = totalStake ? profit / totalStake * 100 : 0;
    const winRate = decided.length ? wins / decided.length : 0;
    const maxDrawdown = maxDrawdownFromProfits(group.map((tip) => tip.profit ?? tip.profitLoss ?? 0));
    const confidenceScore = Math.min(100, Math.round(Math.min(70, group.length / MIN_ELITE_MARKET_SAMPLE * 70) + Math.max(0, roi) * 0.3 + winRate * 20));
    const data = { market, selection, sport, provider, bookmaker, oddRange: range, totalEntries: group.length, wins, losses, voids, winRate, averageOdd, roi, profit, maxDrawdown, confidenceScore };
    rows.push(data);
    await prisma.marketPerformance.upsert({
      where: { market_selection_sport_provider_bookmaker_oddRange: { market, selection, sport, provider, bookmaker, oddRange: range } },
      update: data,
      create: data,
    });
  }
  return rows;
}

export async function recalculateROI() {
  const tips = await prisma.tip.findMany({ where: { status: { in: ["WON", "LOST", "VOID"] } } });
  const decided = tips.filter((tip) => tip.status === "WON" || tip.status === "LOST");
  const totalStake = decided.reduce((sum, tip) => sum + tip.stakeSuggested, 0);
  const profit = tips.reduce((sum, tip) => sum + (tip.profit ?? tip.profitLoss ?? 0), 0);
  const wins = decided.filter((tip) => tip.status === "WON").length;
  const losses = decided.filter((tip) => tip.status === "LOST").length;
  const voids = tips.filter((tip) => tip.status === "VOID").length;
  return { totalEntries: tips.length, wins, losses, voids, profit, roi: totalStake ? profit / totalStake * 100 : 0, winRate: decided.length ? wins / decided.length : 0 };
}

async function upsertTrainingRow(tip: Awaited<ReturnType<typeof prisma.tip.findMany>>[number], result: SettledTipStatus, profit: number, settledAt: Date) {
  await prisma.trainingDataset.upsert({
    where: { tipId: tip.id },
    update: { matchId: tip.matchId, market: tip.market, odd: tip.odd, impliedProbability: tip.impliedProbability, estimatedProbability: tip.estimatedProbability, score: tip.score || tip.confidenceScore, ev: tip.expectedValue, edge: tip.edge, risk: tip.risk, result, profit, generatedAt: tip.createdAt, settledAt },
    create: { tipId: tip.id, matchId: tip.matchId, market: tip.market, odd: tip.odd, impliedProbability: tip.impliedProbability, estimatedProbability: tip.estimatedProbability, score: tip.score || tip.confidenceScore, ev: tip.expectedValue, edge: tip.edge, risk: tip.risk, result, profit, generatedAt: tip.createdAt, settledAt },
  });
}

export async function settlePendingTips(provider = "system") {
  const startedAt = new Date();
  const run = await prisma.settlementRun.create({ data: { provider, status: "RUNNING", startedAt } });
  const errors: string[] = [];
  let tipsProcessed = 0;
  let tipsSettled = 0;
  let won = 0;
  let lost = 0;
  let voids = 0;

  try {
    const tips = await prisma.tip.findMany({
      where: { status: "PENDING", match: { providerId: { not: { startsWith: "mock" } } } },
      include: { match: true },
      orderBy: { createdAt: "asc" },
    });
    tipsProcessed = tips.length;

    for (const tip of tips) {
      const result = calculateTipResult({ market: tip.market, selection: tip.selection, homeTeam: tip.match.homeTeam, awayTeam: tip.match.awayTeam, homeScore: tip.match.homeScore, awayScore: tip.match.awayScore, matchStatus: tip.match.status });
      if (result === "PENDING") continue;
      const settledAt = new Date();
      const profit = calculateProfit(result, tip.odd, tip.stakeSuggested);
      const roi = tip.stakeSuggested > 0 ? profit / tip.stakeSuggested * 100 : 0;
      await prisma.tip.update({ where: { id: tip.id }, data: { status: result, profit, profitLoss: profit, roi, settledAt } });
      await prisma.tipResult.upsert({
        where: { tipId: tip.id },
        update: { matchId: tip.matchId, market: tip.market, selection: tip.selection, status: result, homeScore: tip.match.homeScore, awayScore: tip.match.awayScore, profit, roi, provider: tip.provider, bookmaker: tip.bookmaker, settledAt },
        create: { tipId: tip.id, matchId: tip.matchId, market: tip.market, selection: tip.selection, status: result, homeScore: tip.match.homeScore, awayScore: tip.match.awayScore, profit, roi, provider: tip.provider, bookmaker: tip.bookmaker, settledAt },
      });
      await upsertTrainingRow(tip, result, profit, settledAt);
      tipsSettled += 1;
      if (result === "WON") won += 1;
      else if (result === "LOST") lost += 1;
      else voids += 1;
    }

    await updateMarketPerformance();
    const roi = await recalculateROI();
    const finishedAt = new Date();
    await prisma.settlementRun.update({ where: { id: run.id }, data: { status: "SUCCESS", tipsProcessed, tipsSettled, finishedAt } });
    await prisma.auditLog.create({ data: { category: "SETTLEMENT", status: "SUCCESS", message: `${tipsSettled} tips liquidadas com resultados reais: ${won} WON, ${lost} LOST e ${voids} VOID.`, metadata: JSON.stringify({ runId: run.id, tipsProcessed, tipsSettled, won, lost, voids, roi }) } });
    const training = await trainModelIfEligible();
    return { runId: run.id, tipsProcessed, tipsSettled, processed: tipsSettled, won, lost, voids, greens: won, reds: lost, roi: roi.roi, profit: roi.profit, training, errors };
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : "Falha desconhecida");
    errors.push(message);
    await prisma.settlementRun.update({ where: { id: run.id }, data: { status: "FAILED", tipsProcessed, tipsSettled, errors: errors.join(" | "), finishedAt: new Date() } }).catch(() => undefined);
    throw error;
  }
}

export async function generateSettlementReport() {
  const [pending, settled, won, lost, voids, latestRun, performance, totals] = await Promise.all([
    prisma.tip.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.tip.count({ where: { status: { in: ["WON", "LOST", "VOID"] } } }).catch(() => 0),
    prisma.tip.count({ where: { status: "WON" } }).catch(() => 0),
    prisma.tip.count({ where: { status: "LOST" } }).catch(() => 0),
    prisma.tip.count({ where: { status: "VOID" } }).catch(() => 0),
    prisma.settlementRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null),
    prisma.marketPerformance.findMany({ orderBy: [{ roi: "desc" }, { winRate: "desc" }], take: 12 }).catch(() => []),
    recalculateROI().catch(() => ({ totalEntries: 0, wins: 0, losses: 0, voids: 0, profit: 0, roi: 0, winRate: 0 })),
  ]);
  return {
    pending,
    settled,
    won,
    lost,
    voids,
    winRate: totals.winRate,
    roi: totals.roi,
    profit: totals.profit,
    latestRun: latestRun ? { ...latestRun, startedAt: latestRun.startedAt.toISOString(), finishedAt: latestRun.finishedAt?.toISOString() ?? null, createdAt: latestRun.createdAt.toISOString() } : null,
    performance: performance.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })),
    generatedAt: new Date().toISOString(),
  };
}
