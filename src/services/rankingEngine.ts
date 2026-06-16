import { prisma } from "@/lib/prisma";
import { oddRange } from "./settlementEngine";

const MIN_REAL_SAMPLE = 30;

type RankingKind = "market" | "competition" | "bookmaker";

type TipResultRow = Awaited<ReturnType<typeof loadSettledResults>>[number];

interface RankingMetrics {
  totalTips: number;
  wins: number;
  losses: number;
  voids: number;
  winRate: number;
  roi: number;
  profit: number;
  drawdown: number;
  confidenceScore: number;
  status: string;
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

async function loadSettledResults() {
  return prisma.tipResult.findMany({
    where: { status: { in: ["WON", "LOST", "VOID"] }, tip: { match: { providerId: { not: { startsWith: "mock" } } } } },
    include: { tip: { include: { match: true } } },
    orderBy: { settledAt: "asc" },
  });
}

function calculateMetrics(rows: TipResultRow[]): RankingMetrics {
  const decided = rows.filter((row) => row.status === "WON" || row.status === "LOST");
  const wins = decided.filter((row) => row.status === "WON").length;
  const losses = decided.filter((row) => row.status === "LOST").length;
  const voids = rows.filter((row) => row.status === "VOID").length;
  const totalStake = decided.reduce((sum, row) => sum + row.tip.stakeSuggested, 0);
  const profit = rows.reduce((sum, row) => sum + row.profit, 0);
  const roi = totalStake ? profit / totalStake * 100 : 0;
  const winRate = decided.length ? wins / decided.length : 0;
  const drawdown = maxDrawdown(rows.map((row) => row.profit));
  const sampleScore = Math.min(70, rows.length / MIN_REAL_SAMPLE * 70);
  const performanceScore = Math.max(0, roi) * 0.25 + winRate * 20;
  const confidenceScore = Math.min(100, Math.round(sampleScore + performanceScore));
  return {
    totalTips: rows.length,
    wins,
    losses,
    voids,
    winRate,
    roi,
    profit,
    drawdown,
    confidenceScore,
    status: rows.length >= MIN_REAL_SAMPLE ? "READY" : "INSUFFICIENT_REAL_DATA",
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

async function persistMarketRankings(rows: TipResultRow[]) {
  const groups = groupBy(rows, (row) => [row.market, row.tip.match.competition, row.provider, row.bookmaker, oddRange(row.tip.odd)].join("||"));
  const rankings = [];
  for (const [key, group] of groups.entries()) {
    const [market, competition, provider, bookmaker, range] = key.split("||");
    const metrics = calculateMetrics(group);
    const data = { market, competition, provider, bookmaker, oddRange: range, ...metrics };
    rankings.push(data);
    await prisma.marketRanking.upsert({
      where: { market_competition_provider_bookmaker_oddRange: { market, competition, provider, bookmaker, oddRange: range } },
      update: data,
      create: data,
    });
  }
  return rankings;
}

async function persistCompetitionRankings(rows: TipResultRow[]) {
  const groups = groupBy(rows, (row) => [row.tip.match.competition, row.provider, oddRange(row.tip.odd)].join("||"));
  const rankings = [];
  for (const [key, group] of groups.entries()) {
    const [competition, provider, range] = key.split("||");
    const metrics = calculateMetrics(group);
    const data = { competition, provider, oddRange: range, ...metrics };
    rankings.push(data);
    await prisma.competitionRanking.upsert({
      where: { competition_provider_oddRange: { competition, provider, oddRange: range } },
      update: data,
      create: data,
    });
  }
  return rankings;
}

async function persistBookmakerRankings(rows: TipResultRow[]) {
  const groups = groupBy(rows, (row) => [row.bookmaker, row.provider, oddRange(row.tip.odd)].join("||"));
  const rankings = [];
  for (const [key, group] of groups.entries()) {
    const [bookmaker, provider, range] = key.split("||");
    const metrics = calculateMetrics(group);
    const data = { bookmaker, provider, oddRange: range, ...metrics };
    rankings.push(data);
    await prisma.bookmakerRanking.upsert({
      where: { bookmaker_provider_oddRange: { bookmaker, provider, oddRange: range } },
      update: data,
      create: data,
    });
  }
  return rankings;
}

function sortReady<T extends RankingMetrics>(rows: T[], metric: "roi" | "winRate" | "confidenceScore") {
  return [...rows]
    .filter((row) => row.status === "READY")
    .sort((a, b) => b[metric] - a[metric] || b.totalTips - a.totalTips || b.profit - a.profit);
}

async function readPersistedRankings() {
  const [markets, competitions, bookmakers] = await Promise.all([
    prisma.marketRanking.findMany({ orderBy: [{ confidenceScore: "desc" }, { roi: "desc" }], take: 100 }).catch(() => []),
    prisma.competitionRanking.findMany({ orderBy: [{ confidenceScore: "desc" }, { roi: "desc" }], take: 100 }).catch(() => []),
    prisma.bookmakerRanking.findMany({ orderBy: [{ confidenceScore: "desc" }, { roi: "desc" }], take: 100 }).catch(() => []),
  ]);
  return { markets, competitions, bookmakers };
}

export async function refreshSmartRankings() {
  const rows = await loadSettledResults();
  const [markets, competitions, bookmakers] = await Promise.all([
    persistMarketRankings(rows),
    persistCompetitionRankings(rows),
    persistBookmakerRankings(rows),
  ]);
  await prisma.auditLog.create({
    data: {
      category: "SMART_RANKING",
      status: rows.length >= MIN_REAL_SAMPLE ? "SUCCESS" : "INSUFFICIENT_REAL_DATA",
      message: `${rows.length} resultados reais liquidados processados para rankings.`,
      metadata: JSON.stringify({ markets: markets.length, competitions: competitions.length, bookmakers: bookmakers.length, minimum: MIN_REAL_SAMPLE }),
    },
  }).catch(() => undefined);
  return { refreshedAt: new Date().toISOString(), sourceRows: rows.length, minimumSample: MIN_REAL_SAMPLE, markets, competitions, bookmakers };
}

export async function getSmartRankingReport() {
  const refreshed = await refreshSmartRankings();
  const persisted = await readPersistedRankings();
  const topMarkets = sortReady(persisted.markets, "confidenceScore").slice(0, 8);
  const topCompetitions = sortReady(persisted.competitions, "confidenceScore").slice(0, 8);
  const topBookmakers = sortReady(persisted.bookmakers, "confidenceScore").slice(0, 8);
  const allReady = [...persisted.markets, ...persisted.competitions, ...persisted.bookmakers].filter((row) => row.status === "READY");
  return {
    status: refreshed.sourceRows >= MIN_REAL_SAMPLE ? "READY" : "INSUFFICIENT_REAL_DATA",
    minimumSample: MIN_REAL_SAMPLE,
    sourceRows: refreshed.sourceRows,
    topMarkets,
    topCompetitions,
    topBookmakers,
    topRoi: sortReady(allReady, "roi").slice(0, 8),
    topWinRate: sortReady(allReady, "winRate").slice(0, 8),
    generatedAt: new Date().toISOString(),
  };
}

export function rankingLabel(kind: RankingKind, row: { market?: string; competition?: string; bookmaker?: string; oddRange: string }) {
  if (kind === "market") return `${row.market} · ${row.oddRange}`;
  if (kind === "competition") return `${row.competition} · ${row.oddRange}`;
  return `${row.bookmaker} · ${row.oddRange}`;
}
