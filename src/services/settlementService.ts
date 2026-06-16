import { prisma } from "@/lib/prisma";
import { trainModelIfEligible } from "./modelTrainingService";

type TipResult = "WON" | "LOST" | "VOID";

function parseThreshold(selection: string) {
  const match = selection.match(/(?:mais de|over|menos de|under)\s*(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : null;
}

export function evaluateTip(market: string, selection: string, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number): TipResult {
  const normalizedMarket = market.toLowerCase();
  const normalizedSelection = selection.toLowerCase();
  const totalGoals = homeScore + awayScore;
  if (normalizedMarket.includes("total de gols") || normalizedMarket.includes("over") || normalizedMarket.includes("under") || normalizedMarket.includes("totals") || normalizedMarket.includes("goals")) {
    const threshold = parseThreshold(selection);
    if (threshold === null || totalGoals === threshold) return "VOID";
    const isOver = normalizedSelection.includes("mais de") || normalizedSelection.includes("over");
    return (isOver ? totalGoals > threshold : totalGoals < threshold) ? "WON" : "LOST";
  }
  if (normalizedMarket.includes("ambas marcam") || normalizedMarket.includes("both teams") || normalizedMarket.includes("btts")) {
    const bothScored = homeScore > 0 && awayScore > 0;
    const wantsYes = normalizedSelection.includes("sim") || normalizedSelection.includes("yes");
    return bothScored === wantsYes ? "WON" : "LOST";
  }
  if (normalizedMarket.includes("dupla chance") || normalizedMarket.includes("double chance")) {
    const wins = (normalizedSelection.includes(homeTeam.toLowerCase()) && homeScore > awayScore) || (normalizedSelection.includes(awayTeam.toLowerCase()) && awayScore > homeScore) || (normalizedSelection.includes("empate") && homeScore === awayScore);
    return wins ? "WON" : "LOST";
  }
  if (normalizedMarket.includes("handicap") || normalizedMarket.includes("spreads")) {
    const pointMatch = selection.match(/([+-]?\d+(?:\.\d+)?)\s*$/);
    if (!pointMatch) return "VOID";
    const point = Number(pointMatch[1]);
    const isHome = normalizedSelection.includes(homeTeam.toLowerCase());
    const isAway = normalizedSelection.includes(awayTeam.toLowerCase());
    if (!isHome && !isAway) return "VOID";
    const adjusted = (isHome ? homeScore - awayScore : awayScore - homeScore) + point;
    return adjusted > 0 ? "WON" : adjusted < 0 ? "LOST" : "VOID";
  }
  if (normalizedMarket.includes("vitória") || normalizedMarket === "1x2" || normalizedMarket.includes("match winner") || normalizedMarket === "h2h") {
    const wins = (normalizedSelection.includes(homeTeam.toLowerCase()) && homeScore > awayScore) || (normalizedSelection.includes(awayTeam.toLowerCase()) && awayScore > homeScore) || (normalizedSelection.includes("empate") && homeScore === awayScore);
    return wins ? "WON" : "LOST";
  }
  return "VOID";
}

export async function settlePendingTips() {
  const tips = await prisma.tip.findMany({ where: { status: "PENDING", OR: [{ match: { status: "CANCELLED" } }, { match: { status: "FINISHED", homeScore: { not: null }, awayScore: { not: null } } }] }, include: { match: true } });
  let greens = 0;
  let reds = 0;
  let voids = 0;
  for (const tip of tips) {
    const result = tip.match.status === "CANCELLED" ? "VOID" : evaluateTip(tip.market, tip.selection, tip.match.homeTeam, tip.match.awayTeam, tip.match.homeScore!, tip.match.awayScore!);
    const profit = result === "WON" ? tip.stake * (tip.odd - 1) : result === "LOST" ? -tip.stake : 0;
    await prisma.tip.update({ where: { id: tip.id }, data: { status: result, profitLoss: profit, settledAt: new Date() } });
    await prisma.trainingDataset.upsert({
      where: { tipId: tip.id },
      update: { matchId: tip.matchId, market: tip.market, odd: tip.odd, impliedProbability: tip.impliedProbability, estimatedProbability: tip.estimatedProbability, score: tip.confidenceScore, ev: tip.expectedValue, edge: tip.edge, risk: tip.risk, result, profit, generatedAt: tip.createdAt, settledAt: new Date() },
      create: { tipId: tip.id, matchId: tip.matchId, market: tip.market, odd: tip.odd, impliedProbability: tip.impliedProbability, estimatedProbability: tip.estimatedProbability, score: tip.confidenceScore, ev: tip.expectedValue, edge: tip.edge, risk: tip.risk, result, profit, generatedAt: tip.createdAt, settledAt: new Date() },
    });
    if (result === "WON") greens += 1; else if (result === "LOST") reds += 1; else voids += 1;
  }
  const allTips = await prisma.tip.findMany();
  const settled = allTips.filter((tip) => ["WON", "LOST", "VOID"].includes(tip.status));
  const decided = settled.filter((tip) => tip.status === "WON" || tip.status === "LOST");
  const totalStake = decided.reduce((sum, tip) => sum + tip.stake, 0);
  const accumulatedProfit = settled.reduce((sum, tip) => sum + (tip.profitLoss ?? 0), 0);
  const totalGreens = settled.filter((tip) => tip.status === "WON").length;
  const totalReds = settled.filter((tip) => tip.status === "LOST").length;
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  await prisma.performance.upsert({ where: { periodStart_periodEnd: { periodStart, periodEnd } }, update: { totalEntries: allTips.length, greens: totalGreens, reds: totalReds, pending: allTips.length - settled.length, totalStake, accumulatedProfit, roi: totalStake ? (accumulatedProfit / totalStake) * 100 : 0, hitRate: decided.length ? (totalGreens / decided.length) * 100 : 0 }, create: { periodStart, periodEnd, totalEntries: allTips.length, greens: totalGreens, reds: totalReds, pending: allTips.length - settled.length, totalStake, accumulatedProfit, roi: totalStake ? (accumulatedProfit / totalStake) * 100 : 0, hitRate: decided.length ? (totalGreens / decided.length) * 100 : 0 } });
  await prisma.auditLog.create({ data: { category: "SETTLEMENT", status: "SUCCESS", message: `${greens + reds + voids} tips liquidadas: ${greens} WON, ${reds} LOST e ${voids} VOID.`, metadata: JSON.stringify({ processed: greens + reds + voids, won: greens, lost: reds, void: voids }) } });
  const training = await trainModelIfEligible();
  return { processed: greens + reds + voids, greens, reds, voids, totalEntries: allTips.length, accumulatedProfit, roi: totalStake ? (accumulatedProfit / totalStake) * 100 : 0, training };
}
