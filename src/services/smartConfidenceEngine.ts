import { prisma } from "@/lib/prisma";
import { oddRange } from "./settlementEngine";

const MIN_CONFIDENCE_SAMPLE = 30;

type ConfidenceStatus = "READY" | "INSUFFICIENT_REAL_DATA";
type TipResultRow = Awaited<ReturnType<typeof loadRealSettledResults>>[number];

export interface ConfidenceMetrics {
  sampleSize: number;
  totalTips: number;
  wins: number;
  losses: number;
  voids: number;
  winRate: number;
  roi: number;
  profit: number;
  drawdown: number;
  confidenceScore: number;
  status: ConfidenceStatus;
}

function maxDrawdown(profits: number[]) {
  let balance = 0;
  let peak = 0;
  let drawdown = 0;
  for (const profit of profits) {
    balance += profit;
    peak = Math.max(peak, balance);
    drawdown = Math.max(drawdown, peak - balance);
  }
  return drawdown;
}

async function loadRealSettledResults() {
  return prisma.tipResult.findMany({
    where: {
      status: { in: ["WON", "LOST", "VOID"] },
      tip: { match: { providerId: { not: { startsWith: "mock" } } } },
    },
    include: { tip: { include: { match: true } } },
    orderBy: { settledAt: "asc" },
  });
}

function calculateConfidence(rows: TipResultRow[]): ConfidenceMetrics {
  const decided = rows.filter((row) => row.status === "WON" || row.status === "LOST");
  const wins = decided.filter((row) => row.status === "WON").length;
  const losses = decided.filter((row) => row.status === "LOST").length;
  const voids = rows.filter((row) => row.status === "VOID").length;
  const totalStake = decided.reduce((sum, row) => sum + row.tip.stakeSuggested, 0);
  const profit = rows.reduce((sum, row) => sum + row.profit, 0);
  const roi = totalStake ? profit / totalStake * 100 : 0;
  const winRate = decided.length ? wins / decided.length : 0;
  const drawdown = maxDrawdown(rows.map((row) => row.profit));
  const sampleScore = Math.min(45, rows.length / MIN_CONFIDENCE_SAMPLE * 45);
  const winRateScore = winRate * 35;
  const roiScore = Math.max(0, Math.min(25, roi * 0.5));
  const drawdownPenalty = Math.min(20, drawdown * 2);
  const confidenceScore = rows.length >= MIN_CONFIDENCE_SAMPLE ? Math.max(0, Math.min(100, Math.round(sampleScore + winRateScore + roiScore - drawdownPenalty))) : 0;
  return {
    sampleSize: rows.length,
    totalTips: rows.length,
    wins,
    losses,
    voids,
    winRate,
    roi,
    profit,
    drawdown,
    confidenceScore,
    status: rows.length >= MIN_CONFIDENCE_SAMPLE ? "READY" : "INSUFFICIENT_REAL_DATA",
  };
}

function groupBy(rows: TipResultRow[], keyFn: (row: TipResultRow) => string) {
  const groups = new Map<string, TipResultRow[]>();
  for (const row of rows) {
    const key = keyFn(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

async function persistMarketConfidence(rows: TipResultRow[]) {
  const groups = groupBy(rows, (row) => [row.market, row.provider, row.bookmaker].join("||"));
  const output = [];
  for (const [key, group] of groups.entries()) {
    const [market, provider, bookmaker] = key.split("||");
    const data = { market, provider, bookmaker, ...calculateConfidence(group) };
    output.push(data);
    await prisma.marketConfidence.upsert({
      where: { market_provider_bookmaker: { market, provider, bookmaker } },
      update: data,
      create: data,
    });
  }
  return output;
}

async function persistCompetitionConfidence(rows: TipResultRow[]) {
  const groups = groupBy(rows, (row) => [row.tip.match.competition, row.provider].join("||"));
  const output = [];
  for (const [key, group] of groups.entries()) {
    const [competition, provider] = key.split("||");
    const data = { competition, provider, ...calculateConfidence(group) };
    output.push(data);
    await prisma.competitionConfidence.upsert({
      where: { competition_provider: { competition, provider } },
      update: data,
      create: data,
    });
  }
  return output;
}

async function persistBookmakerConfidence(rows: TipResultRow[]) {
  const groups = groupBy(rows, (row) => [row.bookmaker, row.provider].join("||"));
  const output = [];
  for (const [key, group] of groups.entries()) {
    const [bookmaker, provider] = key.split("||");
    const data = { bookmaker, provider, ...calculateConfidence(group) };
    output.push(data);
    await prisma.bookmakerConfidence.upsert({
      where: { bookmaker_provider: { bookmaker, provider } },
      update: data,
      create: data,
    });
  }
  return output;
}

async function persistOddRangeConfidence(rows: TipResultRow[]) {
  const groups = groupBy(rows, (row) => [oddRange(row.tip.odd), row.provider].join("||"));
  const output = [];
  for (const [key, group] of groups.entries()) {
    const [range, provider] = key.split("||");
    const data = { oddRange: range, provider, ...calculateConfidence(group) };
    output.push(data);
    await prisma.oddRangeConfidence.upsert({
      where: { oddRange_provider: { oddRange: range, provider } },
      update: data,
      create: data,
    });
  }
  return output;
}

function sortReady<T extends { status: string; confidenceScore: number; totalTips: number; roi: number }>(rows: T[]) {
  return [...rows]
    .filter((row) => row.status === "READY")
    .sort((a, b) => b.confidenceScore - a.confidenceScore || b.roi - a.roi || b.totalTips - a.totalTips);
}

export async function refreshSmartConfidence() {
  const rows = await loadRealSettledResults();
  const [markets, competitions, bookmakers, oddRanges] = await Promise.all([
    persistMarketConfidence(rows),
    persistCompetitionConfidence(rows),
    persistBookmakerConfidence(rows),
    persistOddRangeConfidence(rows),
  ]);
  await prisma.auditLog.create({
    data: {
      category: "SMART_CONFIDENCE",
      status: rows.length >= MIN_CONFIDENCE_SAMPLE ? "SUCCESS" : "INSUFFICIENT_REAL_DATA",
      message: `${rows.length} resultados reais liquidados processados para confidence.`,
      metadata: JSON.stringify({ minimum: MIN_CONFIDENCE_SAMPLE, markets: markets.length, competitions: competitions.length, bookmakers: bookmakers.length, oddRanges: oddRanges.length }),
    },
  }).catch(() => undefined);
  return { sourceRows: rows.length, minimumSample: MIN_CONFIDENCE_SAMPLE, markets, competitions, bookmakers, oddRanges, refreshedAt: new Date().toISOString() };
}

export async function getSmartConfidenceReport() {
  const refreshed = await refreshSmartConfidence();
  const [markets, competitions, bookmakers, oddRanges] = await Promise.all([
    prisma.marketConfidence.findMany({ orderBy: [{ confidenceScore: "desc" }, { roi: "desc" }], take: 100 }).catch(() => []),
    prisma.competitionConfidence.findMany({ orderBy: [{ confidenceScore: "desc" }, { roi: "desc" }], take: 100 }).catch(() => []),
    prisma.bookmakerConfidence.findMany({ orderBy: [{ confidenceScore: "desc" }, { roi: "desc" }], take: 100 }).catch(() => []),
    prisma.oddRangeConfidence.findMany({ orderBy: [{ confidenceScore: "desc" }, { roi: "desc" }], take: 100 }).catch(() => []),
  ]);
  return {
    status: refreshed.sourceRows >= MIN_CONFIDENCE_SAMPLE ? "READY" : "INSUFFICIENT_REAL_DATA",
    minimumSample: MIN_CONFIDENCE_SAMPLE,
    sourceRows: refreshed.sourceRows,
    topMarkets: sortReady(markets).slice(0, 6),
    topCompetitions: sortReady(competitions).slice(0, 6),
    topBookmakers: sortReady(bookmakers).slice(0, 6),
    topOddRanges: sortReady(oddRanges).slice(0, 6),
    generatedAt: new Date().toISOString(),
  };
}

export function classifyBySmartConfidence(input: { confidenceScore: number; roi: number; sampleSize: number; status: string }) {
  if (input.sampleSize < MIN_CONFIDENCE_SAMPLE || input.status !== "READY") return "INSUFFICIENT_REAL_DATA";
  if (input.confidenceScore >= 95 && input.roi > 0) return "DIAMANTE";
  if (input.confidenceScore >= 90) return "ELITE GREEN";
  if (input.confidenceScore >= 80) return "GREEN FORTE";
  return "WATCH";
}
