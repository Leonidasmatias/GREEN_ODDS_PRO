import { prisma } from "@/lib/prisma";
import type { AttributionInsightResult, AttributionSegmentResult, AttributionSegmentType, AttributionStatus, PerformanceAttributionReport } from "@/lib/attributionTypes";
import { oddRange } from "./settlementEngine";

export const MIN_ATTRIBUTION_SAMPLE = 30;
const ATTRIBUTION_MODEL_VERSION = "performance-attribution-v1";
const SETTLED_STATUSES = ["WON", "LOST", "VOID"] as const;

type SettledRow = Awaited<ReturnType<typeof loadRealSettledTips>>[number];
type EnrichedRow = SettledRow & {
  oddRange: string;
  confidenceRange: string;
  mlStatus: string;
  discoveryStatus: string;
  riskShieldAction: string;
  bankrollStrategy: string;
  stakeReal: number;
};

async function loadRealSettledTips() {
  return prisma.tipResult.findMany({
    where: {
      status: { in: [...SETTLED_STATUSES] },
      tip: { match: { providerId: { not: { startsWith: "mock" } } } },
    },
    include: { tip: { include: { match: true } } },
    orderBy: { settledAt: "asc" },
  });
}

const round = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

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

function variance(values: number[]) {
  if (!values.length) return 0;
  const avg = average(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
}

function streaks(rows: EnrichedRow[]) {
  let win = 0;
  let loss = 0;
  let maxWinningStreak = 0;
  let maxLosingStreak = 0;
  for (const row of rows) {
    if (row.status === "VOID") continue;
    if (row.status === "WON") {
      win += 1;
      loss = 0;
      maxWinningStreak = Math.max(maxWinningStreak, win);
    } else {
      loss += 1;
      win = 0;
      maxLosingStreak = Math.max(maxLosingStreak, loss);
    }
  }
  return { maxLosingStreak, maxWinningStreak };
}

function confidenceRange(value: number) {
  if (value < 60) return "0-59";
  if (value < 70) return "60-69";
  if (value < 80) return "70-79";
  if (value < 90) return "80-89";
  if (value < 95) return "90-94";
  return "95-100";
}

function attributionStatus(input: { sampleSize: number; roi: number; drawdown: number; profit: number; evRealizado: number; expectedEv: number }): AttributionStatus {
  if (input.sampleSize < MIN_ATTRIBUTION_SAMPLE) return "INSUFFICIENT_REAL_DATA";
  if (input.drawdown >= Math.max(3, Math.abs(input.profit) * 0.5 + 1)) return "DRAWDOWN_ALERT";
  if (input.expectedEv > 0 && input.evRealizado < 0) return "MODEL_CALIBRATION_ALERT";
  if (input.roi > 0) return "POSITIVE_CONTRIBUTOR";
  if (input.roi < 0) return "NEGATIVE_CONTRIBUTOR";
  return "WATCH";
}

function groupBy(rows: EnrichedRow[], keyFn: (row: EnrichedRow) => string) {
  const groups = new Map<string, EnrichedRow[]>();
  for (const row of rows) {
    const key = keyFn(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

async function enrichRow(row: SettledRow): Promise<EnrichedRow> {
  const range = oddRange(row.tip.odd);
  const [ml, discovery, risk, bankroll] = await Promise.all([
    prisma.mlPrediction.findFirst({ where: { matchId: row.matchId, market: row.market, selection: row.selection, provider: row.provider, bookmaker: row.bookmaker }, orderBy: { createdAt: "desc" } }).catch(() => null),
    prisma.discoveryPattern.findFirst({
      where: {
        OR: [
          { patternType: "MARKET", market: row.market, provider: row.provider, bookmaker: row.bookmaker, oddRange: range },
          { patternType: "BOOKMAKER", provider: row.provider, bookmaker: row.bookmaker },
          { patternType: "ODD_RANGE", provider: row.provider, oddRange: range },
          { patternType: "COMPETITION", competition: row.tip.match.competition, provider: row.provider },
        ],
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => null),
    prisma.riskEvent.findFirst({ where: { tipId: row.tipId }, orderBy: { createdAt: "desc" } }).catch(() => null),
    prisma.stakeRecommendation.findFirst({ where: { tipId: row.tipId }, orderBy: { createdAt: "desc" } }).catch(() => null),
  ]);
  return {
    ...row,
    oddRange: range,
    confidenceRange: confidenceRange(row.tip.confidenceScore),
    mlStatus: ml?.status ?? "INSUFFICIENT_REAL_DATA",
    discoveryStatus: discovery?.status ?? "INSUFFICIENT_REAL_DATA",
    riskShieldAction: risk?.action ?? "ALLOW",
    bankrollStrategy: bankroll?.strategy ?? "NO_STAKE",
    stakeReal: row.tip.stake ?? row.tip.stakeSuggested ?? 0,
  };
}

async function enrichRows(rows: SettledRow[]) {
  const enriched: EnrichedRow[] = [];
  for (const row of rows) enriched.push(await enrichRow(row));
  return enriched;
}

function buildSegment(segmentType: AttributionSegmentType, segmentKey: string, rows: EnrichedRow[], dimensions: Partial<AttributionSegmentResult>): AttributionSegmentResult {
  const decided = rows.filter((row) => row.status === "WON" || row.status === "LOST");
  const wins = rows.filter((row) => row.status === "WON").length;
  const losses = rows.filter((row) => row.status === "LOST").length;
  const voids = rows.filter((row) => row.status === "VOID").length;
  const totalStake = rows.reduce((sum, row) => sum + row.stakeReal, 0);
  const profit = rows.reduce((sum, row) => sum + row.profit, 0);
  const winRate = decided.length ? wins / decided.length : 0;
  const roi = totalStake > 0 ? profit / totalStake * 100 : 0;
  const profits = rows.map((row) => row.profit);
  const avgProfit = average(profits);
  const varianceValue = variance(profits);
  const std = Math.sqrt(varianceValue);
  const implied = average(rows.map((row) => row.tip.impliedProbability));
  const expectedEv = average(rows.map((row) => row.tip.expectedValue));
  const evRealizado = totalStake > 0 ? profit / totalStake : 0;
  const streak = streaks(rows);
  const drawdown = maxDrawdown(profits);
  const status = attributionStatus({ sampleSize: rows.length, roi, drawdown, profit, evRealizado, expectedEv });
  return {
    segmentType,
    segmentKey,
    ...dimensions,
    totalTips: rows.length,
    wins,
    losses,
    voids,
    winRate: round(winRate),
    roi: round(roi, 2),
    profit: round(profit, 2),
    averageOdd: round(average(rows.map((row) => row.tip.odd)), 2),
    averageStake: round(average(rows.map((row) => row.stakeReal)), 2),
    drawdown: round(drawdown, 2),
    hitRateByOddRange: round(winRate),
    edgeRealizado: round(winRate - implied),
    evRealizado: round(evRealizado),
    variance: round(varianceValue, 4),
    sharpeLikeScore: round(std > 0 ? avgProfit / std : 0, 4),
    maxLosingStreak: streak.maxLosingStreak,
    maxWinningStreak: streak.maxWinningStreak,
    status,
  };
}

async function segmentGrouped(segmentType: AttributionSegmentType, rows: EnrichedRow[], groups: Map<string, EnrichedRow[]>, dimensionFn: (key: string, group: EnrichedRow[]) => Partial<AttributionSegmentResult>) {
  return [...groups.entries()]
    .map(([key, group]) => buildSegment(segmentType, key, group, dimensionFn(key, group)))
    .sort((a, b) => b.totalTips - a.totalTips || b.roi - a.roi);
}

export async function segmentByMarket(rows: EnrichedRow[]) {
  return segmentGrouped("MARKET", rows, groupBy(rows, (row) => [row.market, row.provider, row.bookmaker, row.oddRange].join("||")), (key) => {
    const [market, provider, bookmaker, range] = key.split("||");
    return { market, provider, bookmaker, oddRange: range };
  });
}

export async function segmentByCompetition(rows: EnrichedRow[]) {
  return segmentGrouped("COMPETITION", rows, groupBy(rows, (row) => [row.tip.match.competition, row.provider].join("||")), (key) => {
    const [competition, provider] = key.split("||");
    return { competition, provider };
  });
}

export async function segmentByBookmaker(rows: EnrichedRow[]) {
  return segmentGrouped("BOOKMAKER", rows, groupBy(rows, (row) => [row.bookmaker, row.provider].join("||")), (key) => {
    const [bookmaker, provider] = key.split("||");
    return { bookmaker, provider };
  });
}

export async function segmentByOddRange(rows: EnrichedRow[]) {
  return segmentGrouped("ODD_RANGE", rows, groupBy(rows, (row) => [row.oddRange, row.provider].join("||")), (key) => {
    const [range, provider] = key.split("||");
    return { oddRange: range, provider };
  });
}

export async function segmentByRisk(rows: EnrichedRow[]) {
  return segmentGrouped("RISK", rows, groupBy(rows, (row) => row.tip.risk), (key) => ({ risk: key }));
}

export async function segmentByConfidence(rows: EnrichedRow[]) {
  return segmentGrouped("CONFIDENCE", rows, groupBy(rows, (row) => row.confidenceRange), (key) => ({ confidenceRange: key }));
}

export async function segmentByMlStatus(rows: EnrichedRow[]) {
  return segmentGrouped("ML_STATUS", rows, groupBy(rows, (row) => row.mlStatus), (key) => ({ mlStatus: key }));
}

export async function segmentByDiscoveryStatus(rows: EnrichedRow[]) {
  return segmentGrouped("DISCOVERY_STATUS", rows, groupBy(rows, (row) => row.discoveryStatus), (key) => ({ discoveryStatus: key }));
}

export async function segmentByRiskShieldAction(rows: EnrichedRow[]) {
  return segmentGrouped("RISK_SHIELD_ACTION", rows, groupBy(rows, (row) => row.riskShieldAction), (key) => ({ riskShieldAction: key }));
}

async function segmentByProvider(rows: EnrichedRow[]) {
  return segmentGrouped("PROVIDER", rows, groupBy(rows, (row) => row.provider), (key) => ({ provider: key }));
}

async function segmentByClassification(rows: EnrichedRow[]) {
  return segmentGrouped("CLASSIFICATION", rows, groupBy(rows, (row) => row.tip.classification), (key) => ({ classification: key }));
}

async function segmentByBankrollStrategy(rows: EnrichedRow[]) {
  return segmentGrouped("BANKROLL_STRATEGY", rows, groupBy(rows, (row) => row.bankrollStrategy), (key) => ({ bankrollStrategy: key }));
}

export function generateAttributionInsights(segments: AttributionSegmentResult[]): AttributionInsightResult[] {
  const sufficient = segments.filter((segment) => segment.totalTips >= MIN_ATTRIBUTION_SAMPLE);
  const insights: AttributionInsightResult[] = [];
  const topRoi = [...sufficient].sort((a, b) => b.roi - a.roi)[0];
  const worstProfit = [...sufficient].sort((a, b) => a.profit - b.profit)[0];
  const bestOddRange = sufficient.filter((segment) => segment.segmentType === "ODD_RANGE").sort((a, b) => b.roi - a.roi)[0];
  const worstOddRange = sufficient.filter((segment) => segment.segmentType === "ODD_RANGE").sort((a, b) => a.roi - b.roi)[0];
  const drawdownSource = [...sufficient].sort((a, b) => b.drawdown - a.drawdown)[0];
  const calibration = sufficient.find((segment) => segment.status === "MODEL_CALIBRATION_ALERT");
  if (topRoi) insights.push({ insightType: "BEST_ROI_SOURCE", title: "Melhor fonte de ROI", description: `${topRoi.segmentKey} concentra ROI real positivo em amostra liquidada suficiente.`, severity: "INFO", status: topRoi.status, segmentType: topRoi.segmentType, segmentKey: topRoi.segmentKey, metricValue: topRoi.roi });
  if (worstProfit) insights.push({ insightType: "WORST_PROFIT_SOURCE", title: "Maior fonte de prejuizo", description: `${worstProfit.segmentKey} concentra o pior lucro real observado e deve ser revisado antes de aumentar exposicao.`, severity: worstProfit.profit < 0 ? "HIGH" : "LOW", status: worstProfit.status, segmentType: worstProfit.segmentType, segmentKey: worstProfit.segmentKey, metricValue: worstProfit.profit });
  if (bestOddRange) insights.push({ insightType: "BEST_ODD_RANGE", title: "Melhor faixa de odds", description: `${bestOddRange.segmentKey} apresenta melhor combinacao de ROI e win rate real.`, severity: "INFO", status: bestOddRange.status, segmentType: bestOddRange.segmentType, segmentKey: bestOddRange.segmentKey, metricValue: bestOddRange.roi });
  if (worstOddRange) insights.push({ insightType: "WORST_ODD_RANGE", title: "Pior faixa de odds", description: `${worstOddRange.segmentKey} tem desempenho inferior no historico liquidado.`, severity: worstOddRange.roi < 0 ? "MEDIUM" : "LOW", status: worstOddRange.status, segmentType: worstOddRange.segmentType, segmentKey: worstOddRange.segmentKey, metricValue: worstOddRange.roi });
  if (drawdownSource && drawdownSource.drawdown > 0) insights.push({ insightType: "DRAWDOWN_SOURCE", title: "Maior fonte de drawdown", description: `${drawdownSource.segmentKey} gerou o maior drawdown realizado entre os segmentos.`, severity: drawdownSource.status === "DRAWDOWN_ALERT" ? "CRITICAL" : "MEDIUM", status: drawdownSource.status, segmentType: drawdownSource.segmentType, segmentKey: drawdownSource.segmentKey, metricValue: drawdownSource.drawdown });
  for (const segment of sufficient.filter((item) => item.status === "NEGATIVE_CONTRIBUTOR" || item.status === "DRAWDOWN_ALERT").slice(0, 8)) {
    insights.push({ insightType: "BLOCK_CANDIDATE", title: `Revisar bloqueio de ${segment.segmentKey}`, description: "Segmento com ROI real negativo ou drawdown alto. Risk Shield e Auto Discovery devem considerar reducao ou bloqueio.", severity: segment.status === "DRAWDOWN_ALERT" ? "CRITICAL" : "HIGH", status: segment.status, segmentType: segment.segmentType, segmentKey: segment.segmentKey, metricValue: segment.roi });
  }
  for (const segment of sufficient.filter((item) => item.status === "POSITIVE_CONTRIBUTOR").sort((a, b) => b.roi - a.roi).slice(0, 5)) {
    insights.push({ insightType: "CONTROLLED_STAKE_INCREASE", title: `Aumento controlado em ${segment.segmentKey}`, description: "Segmento positivo com amostra real suficiente. Qualquer aumento precisa respeitar Bankroll Engine e Risk Shield.", severity: "LOW", status: segment.status, segmentType: segment.segmentType, segmentKey: segment.segmentKey, metricValue: segment.roi });
  }
  if (calibration) insights.push({ insightType: "EV_CALIBRATION_GAP", title: "EV estimado diverge do EV realizado", description: `${calibration.segmentKey} teve EV estimado positivo, mas EV realizado negativo. Recalibrar pesos do Value Engine/ML antes de ampliar exposicao.`, severity: "HIGH", status: "MODEL_CALIBRATION_ALERT", segmentType: calibration.segmentType, segmentKey: calibration.segmentKey, metricValue: calibration.evRealizado });
  return insights.slice(0, 40);
}

async function persistSegments(runId: string, segments: AttributionSegmentResult[]) {
  const saved: AttributionSegmentResult[] = [];
  for (const segment of segments) {
    const created = await prisma.performanceAttributionSegment.create({ data: { runId, ...segment } });
    saved.push({ ...segment, id: created.id });
  }
  return saved;
}

async function persistInsights(runId: string, insights: AttributionInsightResult[]) {
  const saved: AttributionInsightResult[] = [];
  for (const insight of insights) {
    const created = await prisma.performanceAttributionInsight.create({ data: { runId, ...insight } });
    saved.push({ ...insight, id: created.id });
  }
  return saved;
}

function reportFromRun(input: { runId: string | null; status: "READY" | "INSUFFICIENT_REAL_DATA"; totalTipsAnalyzed: number; segments: AttributionSegmentResult[]; insights: AttributionInsightResult[]; generatedAt: Date; blockReason?: string }): PerformanceAttributionReport {
  return {
    status: input.status,
    runId: input.runId,
    modelVersion: ATTRIBUTION_MODEL_VERSION,
    totalTipsAnalyzed: input.totalTipsAnalyzed,
    minimumSample: MIN_ATTRIBUTION_SAMPLE,
    segmentsAnalyzed: input.segments.length,
    insightsGenerated: input.insights.length,
    topPositiveSegments: input.segments.filter((segment) => segment.status === "POSITIVE_CONTRIBUTOR").sort((a, b) => b.roi - a.roi).slice(0, 20),
    negativeSegments: input.segments.filter((segment) => segment.status === "NEGATIVE_CONTRIBUTOR").sort((a, b) => a.roi - b.roi).slice(0, 20),
    drawdownAlerts: input.segments.filter((segment) => segment.status === "DRAWDOWN_ALERT").sort((a, b) => b.drawdown - a.drawdown).slice(0, 20),
    calibrationAlerts: input.segments.filter((segment) => segment.status === "MODEL_CALIBRATION_ALERT").sort((a, b) => a.evRealizado - b.evRealizado).slice(0, 20),
    insights: input.insights,
    generatedAt: input.generatedAt.toISOString(),
    blockReason: input.blockReason,
  };
}

export async function runPerformanceAttribution(): Promise<PerformanceAttributionReport> {
  const startedAt = new Date();
  const job = await prisma.jobRun.create({ data: { name: "PERFORMANCE_ATTRIBUTION", status: "RUNNING", startedAt } }).catch(() => null);
  const rows = await loadRealSettledTips();
  const run = await prisma.performanceAttributionRun.create({ data: { startedAt, status: rows.length >= MIN_ATTRIBUTION_SAMPLE ? "RUNNING" : "INSUFFICIENT_REAL_DATA", totalTipsAnalyzed: rows.length, modelVersion: ATTRIBUTION_MODEL_VERSION, notes: rows.length < MIN_ATTRIBUTION_SAMPLE ? "MINIMUM_REAL_SETTLED_SAMPLE_NOT_REACHED" : undefined } });
  if (rows.length < MIN_ATTRIBUTION_SAMPLE) {
    const finishedAt = new Date();
    await prisma.performanceAttributionRun.update({ where: { id: run.id }, data: { finishedAt, status: "INSUFFICIENT_REAL_DATA" } });
    await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: "PERFORMANCE_ATTRIBUTION bloqueado por amostra real insuficiente.", metadata: JSON.stringify({ segmentsAnalyzed: 0, insightsGenerated: 0, errors: [] }) } }).catch(() => undefined);
    return reportFromRun({ runId: run.id, status: "INSUFFICIENT_REAL_DATA", totalTipsAnalyzed: rows.length, segments: [], insights: [], generatedAt: finishedAt, blockReason: "MINIMUM_REAL_SETTLED_SAMPLE_NOT_REACHED" });
  }
  const enriched = await enrichRows(rows);
  const segmentGroups = await Promise.all([
    segmentByMarket(enriched),
    segmentByCompetition(enriched),
    segmentByBookmaker(enriched),
    segmentByProvider(enriched),
    segmentByOddRange(enriched),
    segmentByClassification(enriched),
    segmentByRisk(enriched),
    segmentByConfidence(enriched),
    segmentByMlStatus(enriched),
    segmentByDiscoveryStatus(enriched),
    segmentByRiskShieldAction(enriched),
    segmentByBankrollStrategy(enriched),
  ]);
  const savedSegments = await persistSegments(run.id, segmentGroups.flat().slice(0, 240));
  const savedInsights = await persistInsights(run.id, generateAttributionInsights(savedSegments));
  const finishedAt = new Date();
  await prisma.performanceAttributionRun.update({ where: { id: run.id }, data: { finishedAt, status: "READY", segmentsAnalyzed: savedSegments.length, insightsGenerated: savedInsights.length } });
  await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: "PERFORMANCE_ATTRIBUTION concluido com resultados reais liquidados.", metadata: JSON.stringify({ segmentsAnalyzed: savedSegments.length, insightsGenerated: savedInsights.length, errors: [] }) } }).catch(() => undefined);
  return reportFromRun({ runId: run.id, status: "READY", totalTipsAnalyzed: rows.length, segments: savedSegments, insights: savedInsights, generatedAt: finishedAt });
}

export async function getPerformanceAttributionReport(): Promise<PerformanceAttributionReport> {
  const latest = await prisma.performanceAttributionRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null);
  if (!latest) return runPerformanceAttribution();
  const [segments, insights] = await Promise.all([
    prisma.performanceAttributionSegment.findMany({ where: { runId: latest.id }, orderBy: [{ totalTips: "desc" }, { roi: "desc" }], take: 240 }).catch(() => []),
    prisma.performanceAttributionInsight.findMany({ where: { runId: latest.id }, orderBy: { createdAt: "desc" }, take: 60 }).catch(() => []),
  ]);
  return reportFromRun({
    runId: latest.id,
    status: latest.status === "READY" ? "READY" : "INSUFFICIENT_REAL_DATA",
    totalTipsAnalyzed: latest.totalTipsAnalyzed,
    segments: segments.map((segment) => ({ ...segment, segmentType: segment.segmentType as AttributionSegmentType, status: segment.status as AttributionStatus })),
    insights: insights.map((insight) => ({ ...insight, severity: insight.severity as AttributionInsightResult["severity"], status: insight.status as AttributionStatus, segmentType: insight.segmentType as AttributionSegmentType | null })),
    generatedAt: latest.finishedAt ?? latest.startedAt,
    blockReason: latest.notes ?? undefined,
  });
}
