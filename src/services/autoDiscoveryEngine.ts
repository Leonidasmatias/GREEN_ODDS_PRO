import { prisma } from "@/lib/prisma";
import type { AutoDiscoveryReport, DiscoveryPatternResult, DiscoveryPatternType, DiscoveryRecommendationResult, DiscoveryStatus } from "@/lib/discoveryTypes";
import { oddRange } from "./settlementEngine";

export const MIN_DISCOVERY_SAMPLE = 30;
const DISCOVERY_MODEL_VERSION = "auto-discovery-v1";

type SettledRow = Awaited<ReturnType<typeof loadRealSettledTips>>[number];

async function loadRealSettledTips() {
  return prisma.tipResult.findMany({
    where: {
      status: { in: ["WON", "LOST", "VOID"] },
      tip: { match: { providerId: { not: { startsWith: "mock" } } } },
    },
    include: { tip: { include: { match: true } } },
    orderBy: { settledAt: "asc" },
  });
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

function groupBy(rows: SettledRow[], keyFn: (row: SettledRow) => string) {
  const groups = new Map<string, SettledRow[]>();
  for (const row of rows) {
    const key = keyFn(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

async function confidenceFor(pattern: DiscoveryPatternResult) {
  if (pattern.patternType === "MARKET" && pattern.market && pattern.provider && pattern.bookmaker) {
    const row = await prisma.marketConfidence.findUnique({ where: { market_provider_bookmaker: { market: pattern.market, provider: pattern.provider, bookmaker: pattern.bookmaker } } }).catch(() => null);
    return row?.confidenceScore ?? 0;
  }
  if (pattern.patternType === "COMPETITION" && pattern.competition && pattern.provider) {
    const row = await prisma.competitionConfidence.findUnique({ where: { competition_provider: { competition: pattern.competition, provider: pattern.provider } } }).catch(() => null);
    return row?.confidenceScore ?? 0;
  }
  if (pattern.patternType === "BOOKMAKER" && pattern.bookmaker && pattern.provider) {
    const row = await prisma.bookmakerConfidence.findUnique({ where: { bookmaker_provider: { bookmaker: pattern.bookmaker, provider: pattern.provider } } }).catch(() => null);
    return row?.confidenceScore ?? 0;
  }
  if (pattern.patternType === "ODD_RANGE" && pattern.oddRange && pattern.provider) {
    const row = await prisma.oddRangeConfidence.findUnique({ where: { oddRange_provider: { oddRange: pattern.oddRange, provider: pattern.provider } } }).catch(() => null);
    return row?.confidenceScore ?? 0;
  }
  return 0;
}

async function mlScoreFor(pattern: DiscoveryPatternResult) {
  const rows = await prisma.mlPrediction.findMany({
    where: {
      status: "READY",
      market: pattern.market ?? undefined,
      provider: pattern.provider ?? undefined,
      bookmaker: pattern.bookmaker ?? undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  }).catch(() => []);
  return rows.length ? rows.reduce((sum, row) => sum + row.confidenceScore, 0) / rows.length : 0;
}

export function calculatePatternScore(input: { sampleSize: number; winRate: number; roi: number; drawdown: number; confidenceScore: number; mlScore: number }) {
  if (input.sampleSize < MIN_DISCOVERY_SAMPLE) return 0;
  const sampleScore = Math.min(30, input.sampleSize / 200 * 30);
  const winRateScore = input.winRate * 25;
  const roiScore = Math.max(0, Math.min(25, input.roi * 0.35));
  const drawdownPenalty = Math.min(20, input.drawdown * 2);
  const confidenceScore = input.confidenceScore * 0.15;
  const mlScore = input.mlScore * 0.05;
  return Math.max(0, Math.min(100, Math.round(sampleScore + winRateScore + roiScore + confidenceScore + mlScore - drawdownPenalty)));
}

function statusFor(input: { sampleSize: number; winRate: number; roi: number; drawdown: number; confidenceScore: number }): DiscoveryStatus {
  if (input.sampleSize < MIN_DISCOVERY_SAMPLE) return "INSUFFICIENT_REAL_DATA";
  if (input.roi <= 0) return "AVOID_OR_WATCH";
  if (input.sampleSize >= 200 && input.roi > 0 && input.confidenceScore >= 90) return "ELITE_PATTERN";
  if (input.sampleSize >= 100 && input.roi > 0 && input.drawdown <= Math.max(3, Math.abs(input.roi) * 0.25 + 1)) return "STRONG_PATTERN";
  if (input.sampleSize >= 50 && input.roi > 0) return "PROMISING";
  return "WATCH";
}

async function buildPattern(patternType: DiscoveryPatternType, rows: SettledRow[], dimensions: Partial<DiscoveryPatternResult>): Promise<DiscoveryPatternResult> {
  const decided = rows.filter((row) => row.status === "WON" || row.status === "LOST");
  const wins = decided.filter((row) => row.status === "WON").length;
  const totalStake = decided.reduce((sum, row) => sum + row.tip.stakeSuggested, 0);
  const profit = rows.reduce((sum, row) => sum + row.profit, 0);
  const roi = totalStake ? profit / totalStake * 100 : 0;
  const winRate = decided.length ? wins / decided.length : 0;
  const drawdown = maxDrawdown(rows.map((row) => row.profit));
  const base: DiscoveryPatternResult = { patternType, sampleSize: rows.length, winRate, roi, profit, drawdown, confidenceScore: 0, mlScore: 0, status: "INSUFFICIENT_REAL_DATA", ...dimensions };
  base.confidenceScore = await confidenceFor(base);
  base.mlScore = await mlScoreFor(base);
  base.status = statusFor(base);
  return base;
}

async function discoverGroupedPatterns(patternType: DiscoveryPatternType, rows: SettledRow[], groups: Map<string, SettledRow[]>, dimensionFn: (key: string, group: SettledRow[]) => Partial<DiscoveryPatternResult>) {
  const patterns: DiscoveryPatternResult[] = [];
  for (const [key, group] of groups.entries()) {
    patterns.push(await buildPattern(patternType, group, dimensionFn(key, group)));
  }
  return patterns.sort((a, b) => calculatePatternScore(b) - calculatePatternScore(a) || b.roi - a.roi);
}

export async function discoverMarketPatterns(rows: SettledRow[]) {
  return discoverGroupedPatterns("MARKET", rows, groupBy(rows, (row) => [row.market, row.provider, row.bookmaker, oddRange(row.tip.odd)].join("||")), (key) => {
    const [market, provider, bookmaker, range] = key.split("||");
    return { market, provider, bookmaker, oddRange: range };
  });
}

export async function discoverCompetitionPatterns(rows: SettledRow[]) {
  return discoverGroupedPatterns("COMPETITION", rows, groupBy(rows, (row) => [row.tip.match.competition, row.provider].join("||")), (key) => {
    const [competition, provider] = key.split("||");
    return { competition, provider };
  });
}

export async function discoverBookmakerPatterns(rows: SettledRow[]) {
  return discoverGroupedPatterns("BOOKMAKER", rows, groupBy(rows, (row) => [row.bookmaker, row.provider].join("||")), (key) => {
    const [bookmaker, provider] = key.split("||");
    return { bookmaker, provider };
  });
}

export async function discoverOddRangePatterns(rows: SettledRow[]) {
  return discoverGroupedPatterns("ODD_RANGE", rows, groupBy(rows, (row) => [oddRange(row.tip.odd), row.provider].join("||")), (key) => {
    const [range, provider] = key.split("||");
    return { oddRange: range, provider };
  });
}

export function detectNegativePatterns(patterns: DiscoveryPatternResult[]) {
  return patterns.filter((pattern) => pattern.status === "AVOID_OR_WATCH").sort((a, b) => a.roi - b.roi || b.sampleSize - a.sampleSize);
}

export function generateRecommendations(patterns: DiscoveryPatternResult[]): DiscoveryRecommendationResult[] {
  return patterns.slice(0, 60).map((pattern) => {
    const label = pattern.market ?? pattern.competition ?? pattern.bookmaker ?? pattern.oddRange ?? "padrao";
    if (pattern.status === "ELITE_PATTERN" || pattern.status === "STRONG_PATTERN") {
      return { patternId: pattern.id, title: `Priorizar ${label}`, description: `${label} tem ROI positivo, amostra real suficiente e drawdown controlado.`, recommendationType: "PRIORITIZE_MARKET", priority: pattern.status === "ELITE_PATTERN" ? "HIGH" : "MEDIUM", status: pattern.status, reason: "REAL_SETTLED_PATTERN_POSITIVE" };
    }
    if (pattern.status === "PROMISING") {
      return { patternId: pattern.id, title: `Observar ${label}`, description: `${label} tem sinal promissor, mas ainda precisa de mais amostra real para liberacao forte.`, recommendationType: "WATCH_MARKET", priority: "MEDIUM", status: pattern.status, reason: "PROMISING_REAL_SAMPLE" };
    }
    if (pattern.status === "AVOID_OR_WATCH") {
      return { patternId: pattern.id, title: `Reduzir exposicao em ${label}`, description: `${label} apresenta ROI real nao positivo no historico liquidado.`, recommendationType: "REDUCE_EXPOSURE", priority: "HIGH", status: pattern.status, reason: "NON_POSITIVE_REAL_ROI" };
    }
    return { patternId: pattern.id, title: `Aguardar ${label}`, description: `${label} ainda nao tem amostra real suficiente para recomendacao forte.`, recommendationType: "WATCH_MARKET", priority: "LOW", status: pattern.status, reason: "INSUFFICIENT_REAL_DATA" };
  });
}

async function persistPatterns(runId: string, patterns: DiscoveryPatternResult[]) {
  const saved: DiscoveryPatternResult[] = [];
  for (const pattern of patterns) {
    const created = await prisma.discoveryPattern.create({ data: { runId, ...pattern } });
    saved.push({ ...pattern, id: created.id });
  }
  return saved;
}

async function persistRecommendations(runId: string, recommendations: DiscoveryRecommendationResult[]) {
  const saved: DiscoveryRecommendationResult[] = [];
  for (const recommendation of recommendations) {
    const created = await prisma.discoveryRecommendation.create({ data: { runId, ...recommendation } });
    saved.push({ ...recommendation, id: created.id });
  }
  return saved;
}

export async function runAutoDiscovery(): Promise<AutoDiscoveryReport> {
  const startedAt = new Date();
  const job = await prisma.jobRun.create({ data: { name: "AUTO_DISCOVERY", status: "RUNNING", startedAt } }).catch(() => null);
  const rows = await loadRealSettledTips();
  const run = await prisma.discoveryRun.create({ data: { startedAt, status: rows.length >= MIN_DISCOVERY_SAMPLE ? "RUNNING" : "INSUFFICIENT_REAL_DATA", totalTipsAnalyzed: rows.length, modelVersion: DISCOVERY_MODEL_VERSION, notes: rows.length < MIN_DISCOVERY_SAMPLE ? "MINIMUM_REAL_SETTLED_SAMPLE_NOT_REACHED" : undefined } });
  if (rows.length < MIN_DISCOVERY_SAMPLE) {
    const finishedAt = new Date();
    await prisma.discoveryRun.update({ where: { id: run.id }, data: { finishedAt, status: "INSUFFICIENT_REAL_DATA" } });
    await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: "AUTO_DISCOVERY bloqueado por amostra real insuficiente.", metadata: JSON.stringify({ patternsFound: 0, recommendationsGenerated: 0, errors: [] }) } }).catch(() => undefined);
    return { status: "INSUFFICIENT_REAL_DATA", runId: run.id, modelVersion: DISCOVERY_MODEL_VERSION, totalTipsAnalyzed: rows.length, minimumSample: MIN_DISCOVERY_SAMPLE, patternsFound: 0, recommendationsGenerated: 0, positivePatterns: [], negativePatterns: [], recommendations: [], generatedAt: finishedAt.toISOString(), blockReason: "MINIMUM_REAL_SETTLED_SAMPLE_NOT_REACHED" };
  }
  const [markets, competitions, bookmakers, odds] = await Promise.all([discoverMarketPatterns(rows), discoverCompetitionPatterns(rows), discoverBookmakerPatterns(rows), discoverOddRangePatterns(rows)]);
  const allPatterns = [...markets, ...competitions, ...bookmakers, ...odds].filter((pattern) => pattern.status !== "INSUFFICIENT_REAL_DATA").slice(0, 120);
  const savedPatterns = await persistPatterns(run.id, allPatterns);
  const recommendations = await persistRecommendations(run.id, generateRecommendations(savedPatterns));
  const negativePatterns = detectNegativePatterns(savedPatterns);
  const positivePatterns = savedPatterns.filter((pattern) => ["WATCH", "PROMISING", "STRONG_PATTERN", "ELITE_PATTERN"].includes(pattern.status)).sort((a, b) => calculatePatternScore(b) - calculatePatternScore(a)).slice(0, 20);
  const finishedAt = new Date();
  await prisma.discoveryRun.update({ where: { id: run.id }, data: { finishedAt, status: "READY", patternsFound: savedPatterns.length, recommendationsGenerated: recommendations.length } });
  await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: "AUTO_DISCOVERY concluido com resultados reais liquidados.", metadata: JSON.stringify({ patternsFound: savedPatterns.length, recommendationsGenerated: recommendations.length, errors: [] }) } }).catch(() => undefined);
  return { status: "READY", runId: run.id, modelVersion: DISCOVERY_MODEL_VERSION, totalTipsAnalyzed: rows.length, minimumSample: MIN_DISCOVERY_SAMPLE, patternsFound: savedPatterns.length, recommendationsGenerated: recommendations.length, positivePatterns, negativePatterns: negativePatterns.slice(0, 20), recommendations: recommendations.slice(0, 20), generatedAt: finishedAt.toISOString() };
}

export async function getAutoDiscoveryReport(): Promise<AutoDiscoveryReport> {
  const latest = await prisma.discoveryRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null);
  if (!latest) return runAutoDiscovery();
  const [patterns, recommendations] = await Promise.all([
    prisma.discoveryPattern.findMany({ where: { runId: latest.id }, orderBy: [{ confidenceScore: "desc" }, { roi: "desc" }], take: 100 }).catch(() => []),
    prisma.discoveryRecommendation.findMany({ where: { runId: latest.id }, orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []),
  ]);
  const mapped = patterns.map((pattern) => ({ ...pattern, patternType: pattern.patternType as DiscoveryPatternType, status: pattern.status as DiscoveryStatus }));
  const negativePatterns = detectNegativePatterns(mapped).slice(0, 20);
  const positivePatterns = mapped.filter((pattern) => ["WATCH", "PROMISING", "STRONG_PATTERN", "ELITE_PATTERN"].includes(pattern.status)).sort((a, b) => calculatePatternScore(b) - calculatePatternScore(a)).slice(0, 20);
  return { status: latest.status === "READY" ? "READY" : "INSUFFICIENT_REAL_DATA", runId: latest.id, modelVersion: latest.modelVersion, totalTipsAnalyzed: latest.totalTipsAnalyzed, minimumSample: MIN_DISCOVERY_SAMPLE, patternsFound: latest.patternsFound, recommendationsGenerated: latest.recommendationsGenerated, positivePatterns, negativePatterns, recommendations: recommendations.map((item) => ({ ...item, recommendationType: item.recommendationType as DiscoveryRecommendationResult["recommendationType"], priority: item.priority as DiscoveryRecommendationResult["priority"], status: item.status as DiscoveryStatus })), generatedAt: (latest.finishedAt ?? latest.startedAt).toISOString(), blockReason: latest.notes ?? undefined };
}

export async function getDiscoveryBlock(input: { market: string; provider: string; bookmaker: string; oddRange: string }) {
  const pattern = await prisma.discoveryPattern.findFirst({
    where: {
      status: "AVOID_OR_WATCH",
      OR: [
        { patternType: "MARKET", market: input.market, provider: input.provider, bookmaker: input.bookmaker, oddRange: input.oddRange },
        { patternType: "BOOKMAKER", provider: input.provider, bookmaker: input.bookmaker },
        { patternType: "ODD_RANGE", provider: input.provider, oddRange: input.oddRange },
      ],
    },
    orderBy: { createdAt: "desc" },
  }).catch(() => null);
  return pattern ? { blocked: true, reason: `DISCOVERY_NEGATIVE_PATTERN:${pattern.patternType}`, status: pattern.status } : { blocked: false, reason: undefined, status: undefined };
}
