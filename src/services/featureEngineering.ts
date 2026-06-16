import { prisma } from "@/lib/prisma";
import { worldCupOpportunities } from "@/lib/worldCupEngine";

export interface EngineeredFeatures {
  edge: number;
  historicalRoi: number;
  historicalWinRate: number;
  averageScore: number;
  oddsMovement: number;
  powerRating: number;
  recentForm: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export async function generateFeatures(input: { matchId: string; market: string; selection: string; score: number; impliedProbability: number; estimatedProbability: number; gameLabel?: string }): Promise<EngineeredFeatures> {
  const [history, snapshots] = await Promise.all([
    prisma.tip.findMany({ where: { market: input.market, status: { in: ["WON", "LOST"] } }, orderBy: { settledAt: "desc" }, take: 50 }),
    prisma.oddsSnapshot.findMany({ where: { matchId: input.matchId }, orderBy: { capturedAt: "asc" } }),
  ]);
  const profit = history.reduce((sum, tip) => sum + (tip.profitLoss ?? 0), 0);
  const totalStake = history.reduce((sum, tip) => sum + tip.stake, 0);
  const greens = history.filter((tip) => tip.status === "WON").length;
  const matchingSnapshots = snapshots.filter((item) => item.selection.toLowerCase() === input.selection.toLowerCase() || snapshots.length <= 3);
  const opening = matchingSnapshots[0]?.odd ?? 0;
  const current = matchingSnapshots.at(-1)?.odd ?? opening;
  const model = worldCupOpportunities.find((item) => item.game === input.gameLabel && item.pick === input.selection);
  return {
    edge: input.estimatedProbability - input.impliedProbability,
    historicalRoi: totalStake ? profit / totalStake : 0,
    historicalWinRate: history.length ? greens / history.length : 0.5,
    averageScore: history.length ? history.reduce((sum, tip) => sum + tip.confidenceScore, 0) / history.length : input.score,
    oddsMovement: opening ? (current - opening) / opening : 0,
    powerRating: model?.powerRating ?? input.score,
    recentForm: clamp(model ? (model.context.form + model.context.timing) / 2 : input.score / 100),
  };
}
