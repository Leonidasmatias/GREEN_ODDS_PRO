import { prisma } from "@/lib/prisma";
import type { ValueAudit, ValueClassification, ValueOpportunity, ValueReport, ValueRisk } from "@/lib/valueTypes";
import { oddRange } from "./settlementEngine";
import { classifyBySmartConfidence } from "./smartConfidenceEngine";
import { predictOutcomeProbability } from "./mlEngine";
import { getDiscoveryBlock } from "./autoDiscoveryEngine";
import { recommendStake } from "./bankrollEngine";
import { getAdaptiveStrategySignal } from "./adaptiveStrategyEngine";

export const MINIMUM_REAL_HISTORY = 30;
export const ENTRY_EDGE = 0.03;
export const ENTRY_EV = 0.05;
export const ENTRY_CONFIDENCE = 60;

type PersistedOdd = {
  id: string;
  matchId: string;
  market: string;
  selection: string;
  odd: number;
  provider: string;
  capturedAt: Date;
  match: {
    providerId: string | null;
    competition: string;
    homeTeam: string;
    awayTeam: string;
    startsAt: Date;
    status: string;
  };
};

const round = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;
const pctScore = (value: number | null) => value == null ? 0 : Math.max(0, Math.min(100, value * 100));
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const isRealProvider = (provider: string | null | undefined) => Boolean(provider && provider !== "none" && !provider.startsWith("mock"));

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function classifyRisk(edge: number | null, margin: number, sample: number): ValueRisk {
  if (edge == null || sample < MINIMUM_REAL_HISTORY) return "INDEFINIDO";
  if (edge >= 0.08 && margin <= 0.08) return "BAIXO";
  if (edge >= 0.03 && margin <= 0.14) return "MEDIO";
  return "ALTO";
}

function classifyValue(edge: number | null, sample: number, smart: { confidenceScore: number; roi: number; sampleSize: number; status: string }): ValueClassification {
  if (edge == null || sample < MINIMUM_REAL_HISTORY) return "WATCH";
  if (edge <= 0) return "NO BET";
  const smartClass = classifyBySmartConfidence(smart);
  if (smartClass === "DIAMANTE") return "DIAMANTE";
  if (smartClass === "ELITE GREEN") return "ELITE GREEN";
  if (smartClass === "GREEN FORTE") return "GREEN FORTE";
  return "WATCH";
}

function statusFor(item: { edge: number | null; ev: number | null; confidence: number; risk: ValueRisk; sample: number; classification: ValueClassification; discoveryBlockReason?: string | null; adaptiveBlockReason?: string | null }) {
  const rejectionReasons: string[] = [];
  if (item.sample < MINIMUM_REAL_HISTORY) rejectionReasons.push("INSUFFICIENT_REAL_DATA");
  if (item.edge == null || item.edge <= ENTRY_EDGE) rejectionReasons.push("EDGE_BELOW_THRESHOLD");
  if (item.ev == null || item.ev <= ENTRY_EV) rejectionReasons.push("EV_BELOW_THRESHOLD");
  if (item.confidence < ENTRY_CONFIDENCE) rejectionReasons.push("CONFIDENCE_BELOW_MINIMUM");
  if (item.risk === "ALTO") rejectionReasons.push("HIGH_RISK");
  if (item.discoveryBlockReason) rejectionReasons.push(item.discoveryBlockReason);
  if (item.adaptiveBlockReason) rejectionReasons.push(item.adaptiveBlockReason);
  if (item.classification === "NO BET") rejectionReasons.push("NO_POSITIVE_EDGE");
  if (item.classification === "WATCH") {
    return { status: item.sample < MINIMUM_REAL_HISTORY ? "INSUFFICIENT_REAL_DATA" as const : "WATCH" as const, rejectionReasons };
  }
  if (!rejectionReasons.length) return { status: "APPROVED" as const, rejectionReasons };
  return { status: "REJECTED" as const, rejectionReasons };
}

async function getActiveRealProvider() {
  const latest = await prisma.syncRun.findFirst({ where: { status: "SUCCESS", provider: { not: "mock" } }, orderBy: { completedAt: "desc" } }).catch(() => null);
  return isRealProvider(latest?.provider) ? latest?.provider ?? "none" : "none";
}

async function getLatestPersistedOdds(provider: string): Promise<PersistedOdd[]> {
  if (!isRealProvider(provider)) return [];
  const rows = await prisma.oddsSnapshot.findMany({
    where: {
      odd: { gt: 1 },
      provider: { startsWith: provider },
      match: { providerId: { not: { startsWith: "mock" } }, status: { in: ["PRE_GAME", "LIVE"] } },
    },
    include: { match: true },
    orderBy: { capturedAt: "desc" },
    take: 1500,
  });

  const latest = new Map<string, PersistedOdd>();
  for (const row of rows) {
    const key = `${row.matchId}:${row.market}:${row.selection}:${row.provider}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()];
}

async function estimateProbability(market: string, selection: string) {
  const rows = await prisma.tip.findMany({
    where: { market, status: { in: ["WON", "LOST"] } },
    orderBy: { settledAt: "desc" },
    take: 500,
    select: { selection: true, status: true },
  }).catch(() => []);
  const normalizedSelection = normalize(selection);
  const exactRows = rows.filter((row) => normalize(row.selection) === normalizedSelection);
  const usableRows = exactRows.length >= MINIMUM_REAL_HISTORY ? exactRows : rows;
  const source: "SELECTION" | "MARKET" = exactRows.length >= MINIMUM_REAL_HISTORY ? "SELECTION" : "MARKET";
  if (usableRows.length < MINIMUM_REAL_HISTORY) {
    return { estimatedProbability: null, sample: usableRows.length, confidence: 0, source };
  }
  const wins = usableRows.filter((row) => row.status === "WON").length;
  const estimatedProbability = wins / usableRows.length;
  const confidence = Math.min(100, 60 + Math.log10(usableRows.length / MINIMUM_REAL_HISTORY) * 20);
  return { estimatedProbability, sample: usableRows.length, confidence, source };
}

async function getMarketPerformance(input: { market: string; selection: string; provider: string; bookmaker: string; competition: string; odd: number; impliedProbability: number }) {
  const row = await prisma.marketPerformance.findUnique({
    where: {
      market_selection_sport_provider_bookmaker_oddRange: {
        market: input.market,
        selection: input.selection,
        sport: input.competition,
        provider: input.provider,
        bookmaker: input.bookmaker,
        oddRange: oddRange(input.odd),
      },
    },
  }).catch(() => null);
  if (!row) return { sample: 0, winRate: null, roi: null, maxDrawdown: null, eliteEligible: false, blockReason: "INSUFFICIENT_REAL_MARKET_SAMPLE" };
  const drawdownControlled = row.maxDrawdown <= Math.max(3, Math.abs(row.profit) * 0.5 + 1);
  const eliteEligible = row.totalEntries >= 30 && row.winRate > input.impliedProbability && row.roi > 0 && drawdownControlled && isRealProvider(input.provider);
  const blockReason = eliteEligible ? undefined : row.totalEntries < 30 ? "INSUFFICIENT_REAL_MARKET_SAMPLE" : row.winRate <= input.impliedProbability ? "WINRATE_BELOW_IMPLIED_PROBABILITY" : row.roi <= 0 ? "REAL_ROI_NOT_POSITIVE" : !drawdownControlled ? "DRAWDOWN_NOT_CONTROLLED" : "NO_ACTIVE_REAL_PROVIDER";
  return { sample: row.totalEntries, winRate: row.winRate, roi: row.roi, maxDrawdown: row.maxDrawdown, eliteEligible, blockReason };
}

async function getSmartConfidence(input: { market: string; provider: string; bookmaker: string }) {
  const row = await prisma.marketConfidence.findUnique({
    where: { market_provider_bookmaker: { market: input.market, provider: input.provider, bookmaker: input.bookmaker } },
  }).catch(() => null);
  if (!row) return { sampleSize: 0, confidenceScore: 0, roi: 0, status: "INSUFFICIENT_REAL_DATA" };
  return { sampleSize: row.sampleSize, confidenceScore: row.confidenceScore, roi: row.roi, status: row.status };
}

function latestMarketMargins(odds: PersistedOdd[]) {
  const byMarket = new Map<string, PersistedOdd[]>();
  for (const odd of odds) byMarket.set(`${odd.matchId}:${odd.market}`, [...(byMarket.get(`${odd.matchId}:${odd.market}`) ?? []), odd]);
  const margins = new Map<string, { overround: number; bookmakerMargin: number }>();
  for (const [key, marketOdds] of byMarket.entries()) {
    const overround = marketOdds.reduce((sum, item) => sum + 1 / item.odd, 0);
    margins.set(key, { overround, bookmakerMargin: Math.max(0, overround - 1) });
  }
  return margins;
}

async function persistAnalysis(items: ValueOpportunity[]) {
  if (!items.length) return;
  await prisma.valueAnalysis.createMany({
    data: items.map((item) => ({
      matchId: item.matchId,
      oddsSnapshotId: item.oddsSnapshotId,
      provider: item.provider,
      market: item.market,
      selection: item.selection,
      odd: item.odd,
      impliedProbability: item.impliedProbability,
      bookmakerMargin: item.bookmakerMargin,
      fairOdd: item.fairOdd,
      estimatedProbability: item.estimatedProbability,
      edge: item.edge,
      expectedValue: item.expectedValue,
      risk: item.risk,
      classification: item.classification,
      status: item.status,
      rejectionReasons: item.rejectionReasons.join(","),
      historicalSample: item.historicalSample,
      confidence: item.confidence,
      score: item.score,
      analyzedAt: new Date(item.analyzedAt),
    })),
  }).catch(() => undefined);
}

async function createPendingTips(items: ValueOpportunity[]) {
  let created = 0;
  for (const item of items) {
    const existing = await prisma.tip.findFirst({
      where: {
        matchId: item.matchId,
        market: item.market,
        selection: item.selection,
        provider: item.provider,
        bookmaker: item.bookmaker,
        status: "PENDING",
      },
      select: { id: true },
    }).catch(() => null);
    if (existing) continue;
    await prisma.tip.create({
      data: {
        matchId: item.matchId,
        gameLabel: item.game,
        market: item.market,
        selection: item.selection,
        odd: item.odd,
        provider: item.provider,
        bookmaker: item.bookmaker,
        impliedProbability: item.impliedProbability,
        estimatedProbability: item.estimatedProbability ?? 0,
        edge: item.edge ?? 0,
        expectedValue: item.expectedValue ?? 0,
        confidenceScore: item.confidence,
        score: item.score,
        classification: item.classification,
        risk: item.risk,
        status: "PENDING",
        stakeSuggested: item.bankrollStatus === "READY" ? item.recommendedStake ?? 0 : 0,
        stake: item.bankrollStatus === "READY" ? item.recommendedStake ?? 0 : 0,
        rejectionReason: item.bankrollReason ?? item.settlementBlockReason,
      },
    });
    created += 1;
  }
  return created;
}

export async function buildValueReport(): Promise<ValueReport> {
  const analyzedAt = new Date().toISOString();
  const provider = await getActiveRealProvider();
  const odds = await getLatestPersistedOdds(provider);
  const margins = latestMarketMargins(odds);
  const opportunities: ValueOpportunity[] = [];
  const rejectionReasons: Record<string, number> = {};

  if (!isRealProvider(provider)) increment(rejectionReasons, "NO_ACTIVE_REAL_PROVIDER");
  if (!odds.length) increment(rejectionReasons, "NO_REAL_PERSISTED_ODDS");

  for (const snapshot of odds) {
    const margin = margins.get(`${snapshot.matchId}:${snapshot.market}`) ?? { overround: 1, bookmakerMargin: 0 };
    const impliedProbability = 1 / snapshot.odd;
    const denominator = margin.overround > 0 ? margin.overround : 1;
    const fairProbability = impliedProbability / denominator;
    const fairOdd = fairProbability > 0 ? 1 / fairProbability : 0;
    const history = await estimateProbability(snapshot.market, snapshot.selection);
    const performance = await getMarketPerformance({ market: snapshot.market, selection: snapshot.selection, provider, bookmaker: snapshot.provider, competition: snapshot.match.competition, odd: snapshot.odd, impliedProbability });
    const smartConfidence = await getSmartConfidence({ market: snapshot.market, provider, bookmaker: snapshot.provider });
    const model = await predictOutcomeProbability({
      matchId: snapshot.matchId,
      market: snapshot.market,
      selection: snapshot.selection,
      competition: snapshot.match.competition,
      provider,
      bookmaker: snapshot.provider,
      odd: snapshot.odd,
      impliedProbability,
    });
    const estimatedProbability = model.status === "READY" && model.modelProbability != null ? model.modelProbability : history.estimatedProbability;
    const probabilitySample = model.status === "READY" ? MINIMUM_REAL_HISTORY : history.sample;
    const confidence = model.status === "READY" ? Math.max(history.confidence, model.confidenceScore) : history.confidence;
    const edge = estimatedProbability == null ? null : estimatedProbability - fairProbability;
    const ev = estimatedProbability == null ? null : estimatedProbability * snapshot.odd - 1;
    const risk = classifyRisk(edge, margin.bookmakerMargin, probabilitySample);
    const range = oddRange(snapshot.odd);
    const discovery = await getDiscoveryBlock({ market: snapshot.market, provider, bookmaker: snapshot.provider, oddRange: range });
    const adaptive = await getAdaptiveStrategySignal({ market: snapshot.market, competition: snapshot.match.competition, provider, bookmaker: snapshot.provider, oddRange: range });
    const rawClassification = classifyValue(edge, probabilitySample, smartConfidence);
    const classification = (discovery.blocked || adaptive.blocked) && (rawClassification === "GREEN FORTE" || rawClassification === "ELITE GREEN" || rawClassification === "DIAMANTE") ? "WATCH" : rawClassification;
    const adaptiveReason = adaptive.blocked ? `ADAPTIVE_STRATEGY_BLOCK:${adaptive.reason ?? "BLOCK_SEGMENT"}` : adaptive.confidenceThresholdDelta > 0 && confidence < ENTRY_CONFIDENCE + adaptive.confidenceThresholdDelta ? `ADAPTIVE_CONFIDENCE_THRESHOLD:${adaptive.confidenceThresholdDelta}` : undefined;
    const status = statusFor({ edge, ev, confidence, risk, sample: probabilitySample, classification, discoveryBlockReason: discovery.reason, adaptiveBlockReason: adaptiveReason });
    const bankroll = await recommendStake({
      matchId: snapshot.matchId,
      market: snapshot.market,
      selection: snapshot.selection,
      competition: snapshot.match.competition,
      bookmaker: snapshot.provider,
      odd: snapshot.odd,
      confidenceScore: Math.round(confidence),
      impliedProbability,
      modelProbability: model.modelProbability,
      edge,
      expectedValue: ev,
      risk,
      drawdown: performance.maxDrawdown,
      discoveryStatus: adaptive.blocked ? "AVOID_OR_WATCH" : discovery.status,
    });
    for (const reason of status.rejectionReasons) increment(rejectionReasons, reason);
    const score = Math.round(Math.min(100, Math.max(0, pctScore(edge) * 4 + pctScore(ev) * 2 + history.confidence * 0.35 - margin.bookmakerMargin * 100)));

    opportunities.push({
      id: `${snapshot.id}-${analyzedAt}`,
      matchId: snapshot.matchId,
      oddsSnapshotId: snapshot.id,
      provider,
      bookmaker: snapshot.provider,
      providerEventId: snapshot.match.providerId ?? "",
      competition: snapshot.match.competition,
      game: `${snapshot.match.homeTeam} x ${snapshot.match.awayTeam}`,
      startsAt: snapshot.match.startsAt.toISOString(),
      matchStatus: snapshot.match.status,
      market: snapshot.market,
      selection: snapshot.selection,
      odd: snapshot.odd,
      impliedProbability: round(impliedProbability),
      bookmakerMargin: round(margin.bookmakerMargin),
      fairProbability: round(fairProbability),
      fairOdd: round(fairOdd, 2),
      estimatedProbability: estimatedProbability == null ? null : round(estimatedProbability),
      probabilityModelVersion: model.modelVersion,
      modelProbability: model.modelProbability,
      modelConfidenceScore: model.confidenceScore,
      modelStatus: model.status,
      edge: edge == null ? null : round(edge),
      expectedValue: ev == null ? null : round(ev),
      confidence: Math.round(confidence),
      risk,
      score,
      classification,
      status: status.status,
      rejectionReasons: status.rejectionReasons,
      historicalSample: history.sample,
      marketSample: performance.sample,
      marketWinRate: performance.winRate,
      marketRoi: performance.roi,
      marketMaxDrawdown: performance.maxDrawdown,
      smartConfidenceScore: smartConfidence.confidenceScore,
      smartConfidenceStatus: smartConfidence.status,
      smartConfidenceSampleSize: smartConfidence.sampleSize,
      discoveryStatus: discovery.status,
      discoveryBlockReason: discovery.reason,
      bankrollStatus: bankroll.status,
      bankrollReason: bankroll.reason,
      recommendedStake: bankroll.recommendedStake,
      stakePercent: bankroll.stakePercent,
      stakeStrategy: bankroll.strategy,
      settlementBlockReason: performance.blockReason,
      probabilitySource: history.source,
      analyzedAt,
    });
  }

  const entries = opportunities.filter((item) => item.status === "APPROVED");
  const watchlist = opportunities.filter((item) => item.status === "WATCH" || item.status === "INSUFFICIENT_REAL_DATA");
  const tipsCreated = await createPendingTips(entries);
  const audit: ValueAudit = {
    provider,
    analyzed: opportunities.length,
    rejected: opportunities.filter((item) => item.status === "REJECTED").length,
    approved: entries.length,
    watch: watchlist.length,
    insufficientRealData: opportunities.filter((item) => item.status === "INSUFFICIENT_REAL_DATA").length,
    tipsCreated,
    rejectionReasons,
    generatedAt: analyzedAt,
  };

  await persistAnalysis(opportunities);
  await prisma.auditLog.create({
    data: {
      category: "VALUE_ENGINE",
      status: entries.length ? "APPROVED" : "WATCH",
      message: `${audit.analyzed} odds reais persistidas analisadas, ${audit.approved} aprovadas, ${tipsCreated} tips PENDING criadas e ${audit.rejected} rejeitadas.`,
      metadata: JSON.stringify({ audit, sample: opportunities.slice(0, 50) }),
    },
  }).catch(() => undefined);

  return {
    provider,
    updatedAt: analyzedAt,
    gamesLoaded: new Set(odds.map((item) => item.matchId)).size,
    opportunities,
    entries,
    watchlist,
    audit,
    warning: opportunities.length ? undefined : "Nenhuma entrada green validada no momento.",
  };
}

export function valueToDisplayStatus(value: ValueOpportunity): { risk: string; classification: string } {
  const risk = value.risk === "BAIXO" ? "Baixo" : value.risk === "MEDIO" ? "Medio" : value.risk === "ALTO" ? "Alto" : "Indefinido";
  return { risk, classification: value.classification };
}
