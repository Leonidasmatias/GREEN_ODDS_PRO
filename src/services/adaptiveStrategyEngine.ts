import { prisma } from "@/lib/prisma";
import type { AdaptiveAdjustmentAction, AdaptiveSegmentType, AdaptiveStrategyAdjustmentResult, AdaptiveStrategyReport, AdaptiveStrategySignal } from "@/lib/adaptiveTypes";
import type { AttributionSegmentResult } from "@/lib/attributionTypes";
import { getPerformanceAttributionReport, MIN_ATTRIBUTION_SAMPLE, runPerformanceAttribution } from "./performanceAttributionEngine";

const ADAPTIVE_MODEL_VERSION = "adaptive-strategy-v1";
const SETTLED_STATUSES = ["WON", "LOST", "VOID"] as const;

type Segment = AttributionSegmentResult;
type InternalAdjustment = AdaptiveStrategyAdjustmentResult & {
  market?: string | null;
  competition?: string | null;
  bookmaker?: string | null;
  provider?: string | null;
  oddRange?: string | null;
};

const round = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

async function countRealSettledTips() {
  return prisma.tipResult.count({
    where: {
      status: { in: [...SETTLED_STATUSES] },
      tip: { match: { providerId: { not: { startsWith: "mock" } } } },
    },
  });
}

function isAdaptiveSegment(segment: Segment): segment is Segment & { segmentType: AdaptiveSegmentType } {
  return ["MARKET", "COMPETITION", "BOOKMAKER", "PROVIDER", "ODD_RANGE", "RISK", "CONFIDENCE", "ML_STATUS", "DISCOVERY_STATUS", "RISK_SHIELD_ACTION", "BANKROLL_STRATEGY"].includes(segment.segmentType);
}

function highVariance(segment: Segment) {
  return segment.totalTips >= MIN_ATTRIBUTION_SAMPLE && segment.variance >= Math.max(1, Math.abs(segment.profit) / Math.max(1, segment.totalTips));
}

function controlledDrawdown(segment: Segment) {
  return segment.drawdown <= Math.max(3, Math.abs(segment.profit) * 0.3 + 1);
}

function persistentNegative(segment: Segment) {
  return segment.totalTips >= MIN_ATTRIBUTION_SAMPLE * 2 && segment.roi < 0 && segment.drawdown >= Math.max(3, Math.abs(segment.profit) * 0.35 + 1);
}

function actionFor(segment: Segment): AdaptiveAdjustmentAction {
  if (segment.totalTips < MIN_ATTRIBUTION_SAMPLE) return "ALLOW_OBSERVATION";
  if (persistentNegative(segment)) return "BLOCK_SEGMENT";
  if (highVariance(segment)) return "RAISE_CONFIDENCE_THRESHOLD";
  if (segment.roi < 0) return "DECREASE_WEIGHT";
  if (segment.roi > 0 && controlledDrawdown(segment)) return "INCREASE_WEIGHT";
  if (segment.drawdown > Math.max(3, Math.abs(segment.profit) * 0.3 + 1)) return "REINFORCE_RISK_SHIELD";
  return "ALLOW_OBSERVATION";
}

function adjustmentFromSegment(segment: Segment, forcedAction?: AdaptiveAdjustmentAction): InternalAdjustment | null {
  if (!isAdaptiveSegment(segment)) return null;
  if (segment.totalTips < MIN_ATTRIBUTION_SAMPLE) {
    return {
      segmentType: segment.segmentType,
      segmentKey: segment.segmentKey,
      action: "ALLOW_OBSERVATION",
      weightMultiplier: 1,
      confidenceThresholdDelta: 0,
      stakeMultiplier: 1,
      riskSensitivity: "NORMAL",
      sampleSize: segment.totalTips,
      roi: segment.roi,
      drawdown: segment.drawdown,
      variance: segment.variance,
      status: "SKIPPED",
      reason: "INSUFFICIENT_REAL_DATA",
      ...dimensions(segment),
    };
  }
  const action = forcedAction ?? actionFor(segment);
  const defensive = action === "BLOCK_SEGMENT" || action === "DECREASE_WEIGHT" || action === "RAISE_CONFIDENCE_THRESHOLD" || action === "REDUCE_STAKE" || action === "REINFORCE_RISK_SHIELD";
  return {
    segmentType: segment.segmentType,
    segmentKey: segment.segmentKey,
    action,
    weightMultiplier: action === "INCREASE_WEIGHT" ? 1.08 : action === "DECREASE_WEIGHT" || action === "BLOCK_SEGMENT" ? 0.75 : 1,
    confidenceThresholdDelta: action === "RAISE_CONFIDENCE_THRESHOLD" ? 10 : defensive ? 5 : 0,
    stakeMultiplier: action === "REDUCE_STAKE" || action === "BLOCK_SEGMENT" ? 0 : action === "DECREASE_WEIGHT" || action === "REINFORCE_RISK_SHIELD" ? 0.5 : 1,
    riskSensitivity: action === "BLOCK_SEGMENT" || action === "REINFORCE_RISK_SHIELD" ? "STRICT" : defensive ? "ELEVATED" : "NORMAL",
    sampleSize: segment.totalTips,
    roi: segment.roi,
    drawdown: segment.drawdown,
    variance: segment.variance,
    status: "PENDING",
    reason: reasonFor(action),
    ...dimensions(segment),
  };
}

function dimensions(segment: Segment) {
  return {
    market: segment.market ?? null,
    competition: segment.competition ?? null,
    bookmaker: segment.bookmaker ?? null,
    provider: segment.provider ?? null,
    oddRange: segment.oddRange ?? null,
  };
}

function reasonFor(action: AdaptiveAdjustmentAction) {
  if (action === "INCREASE_WEIGHT") return "REAL_ROI_POSITIVE_DRAWDOWN_CONTROLLED";
  if (action === "DECREASE_WEIGHT") return "REAL_ROI_NEGATIVE_SUFFICIENT_SAMPLE";
  if (action === "BLOCK_SEGMENT") return "PERSISTENT_NEGATIVE_ROI_HIGH_DRAWDOWN";
  if (action === "RAISE_CONFIDENCE_THRESHOLD") return "HIGH_REAL_VARIANCE";
  if (action === "REDUCE_STAKE") return "BAD_ODD_RANGE_OR_NEGATIVE_SEGMENT";
  if (action === "REINFORCE_RISK_SHIELD") return "HIGH_REAL_DRAWDOWN";
  return "STABLE_OR_RECOVERING_PERFORMANCE_OBSERVATION_ONLY";
}

export async function analyzePerformanceAttribution() {
  const attribution = await getPerformanceAttributionReport();
  if (attribution.status !== "READY") return attribution;
  return attribution;
}

function selectSegments(segments: Segment[], types: AdaptiveSegmentType[]) {
  return segments.filter((segment) => isAdaptiveSegment(segment) && types.includes(segment.segmentType) && segment.totalTips >= MIN_ATTRIBUTION_SAMPLE);
}

export async function adjustMarketWeights(segments: Segment[]) {
  return selectSegments(segments, ["MARKET"]).map((segment) => adjustmentFromSegment(segment)).filter(Boolean) as InternalAdjustment[];
}

export async function adjustCompetitionWeights(segments: Segment[]) {
  return selectSegments(segments, ["COMPETITION"]).map((segment) => adjustmentFromSegment(segment)).filter(Boolean) as InternalAdjustment[];
}

export async function adjustBookmakerWeights(segments: Segment[]) {
  return selectSegments(segments, ["BOOKMAKER"]).map((segment) => adjustmentFromSegment(segment)).filter(Boolean) as InternalAdjustment[];
}

export async function adjustOddRangeWeights(segments: Segment[]) {
  return selectSegments(segments, ["ODD_RANGE"]).map((segment) => adjustmentFromSegment(segment, segment.roi < 0 ? "REDUCE_STAKE" : undefined)).filter(Boolean) as InternalAdjustment[];
}

export async function adjustRiskSensitivity(segments: Segment[]) {
  return selectSegments(segments, ["RISK", "COMPETITION", "RISK_SHIELD_ACTION"])
    .filter((segment) => segment.drawdown > Math.max(3, Math.abs(segment.profit) * 0.3 + 1))
    .map((segment) => adjustmentFromSegment(segment, "REINFORCE_RISK_SHIELD"))
    .filter(Boolean) as InternalAdjustment[];
}

export async function adjustConfidenceThresholds(segments: Segment[]) {
  return selectSegments(segments, ["MARKET", "COMPETITION", "BOOKMAKER", "ODD_RANGE", "CONFIDENCE", "ML_STATUS", "DISCOVERY_STATUS"])
    .filter(highVariance)
    .map((segment) => adjustmentFromSegment(segment, "RAISE_CONFIDENCE_THRESHOLD"))
    .filter(Boolean) as InternalAdjustment[];
}

export async function generateStrategyAdjustments(segments: Segment[]) {
  const groups = await Promise.all([
    adjustMarketWeights(segments),
    adjustCompetitionWeights(segments),
    adjustBookmakerWeights(segments),
    adjustOddRangeWeights(segments),
    adjustRiskSensitivity(segments),
    adjustConfidenceThresholds(segments),
  ]);
  const deduped = new Map<string, InternalAdjustment>();
  for (const adjustment of groups.flat()) {
    const key = `${adjustment.segmentType}:${adjustment.segmentKey}:${adjustment.action}`;
    const existing = deduped.get(key);
    if (!existing || adjustment.action === "BLOCK_SEGMENT" || adjustment.sampleSize > existing.sampleSize) deduped.set(key, adjustment);
  }
  return [...deduped.values()].slice(0, 160);
}

export async function applyStrategyAdjustment(adjustment: InternalAdjustment, runId?: string): Promise<AdaptiveStrategyAdjustmentResult> {
  const isDefensive = adjustment.action !== "INCREASE_WEIGHT";
  const safeAdjustment: InternalAdjustment = {
    ...adjustment,
    weightMultiplier: adjustment.action === "INCREASE_WEIGHT" ? Math.min(1.1, adjustment.weightMultiplier) : Math.min(1, adjustment.weightMultiplier),
    stakeMultiplier: Math.max(0, Math.min(isDefensive ? 1 : 1, adjustment.stakeMultiplier)),
    confidenceThresholdDelta: Math.max(0, adjustment.confidenceThresholdDelta),
  };
  const rule = await prisma.adaptiveStrategyRule.upsert({
    where: { segmentType_segmentKey: { segmentType: safeAdjustment.segmentType, segmentKey: safeAdjustment.segmentKey } },
    update: { ...ruleData(safeAdjustment, runId), status: "ACTIVE" },
    create: ruleData(safeAdjustment, runId),
  });
  await prisma.adaptiveStrategyEvent.create({
    data: {
      runId,
      eventType: "ADAPTIVE_RULE_APPLIED",
      severity: safeAdjustment.action === "BLOCK_SEGMENT" ? "HIGH" : isDefensive ? "MEDIUM" : "LOW",
      action: safeAdjustment.action,
      reason: safeAdjustment.reason,
      metadata: JSON.stringify({ segmentType: safeAdjustment.segmentType, segmentKey: safeAdjustment.segmentKey, sampleSize: safeAdjustment.sampleSize, roi: safeAdjustment.roi, noAllIn: true, riskShieldPreserved: true }),
    },
  }).catch(() => undefined);
  return { ...safeAdjustment, ruleId: rule.id, status: "APPLIED", id: undefined };
}

function ruleData(adjustment: InternalAdjustment, sourceRunId?: string) {
  return {
    segmentType: adjustment.segmentType,
    segmentKey: adjustment.segmentKey,
    market: adjustment.market ?? undefined,
    competition: adjustment.competition ?? undefined,
    bookmaker: adjustment.bookmaker ?? undefined,
    provider: adjustment.provider ?? undefined,
    oddRange: adjustment.oddRange ?? undefined,
    action: adjustment.action,
    weightMultiplier: adjustment.weightMultiplier,
    confidenceThresholdDelta: adjustment.confidenceThresholdDelta,
    stakeMultiplier: adjustment.stakeMultiplier,
    riskSensitivity: adjustment.riskSensitivity,
    reason: adjustment.reason,
    sampleSize: adjustment.sampleSize,
    roi: adjustment.roi,
    drawdown: adjustment.drawdown,
    variance: adjustment.variance,
    sourceRunId,
  };
}

export async function runAdaptiveStrategy(): Promise<AdaptiveStrategyReport> {
  const startedAt = new Date();
  const job = await prisma.jobRun.create({ data: { name: "ADAPTIVE_STRATEGY", status: "RUNNING", startedAt } }).catch(() => null);
  const totalTipsAnalyzed = await countRealSettledTips();
  const run = await prisma.adaptiveStrategyRun.create({
    data: {
      startedAt,
      status: totalTipsAnalyzed >= MIN_ATTRIBUTION_SAMPLE ? "RUNNING" : "INSUFFICIENT_REAL_DATA",
      totalTipsAnalyzed,
      modelVersion: ADAPTIVE_MODEL_VERSION,
      notes: totalTipsAnalyzed < MIN_ATTRIBUTION_SAMPLE ? "MINIMUM_REAL_SETTLED_SAMPLE_NOT_REACHED" : undefined,
    },
  });
  if (totalTipsAnalyzed < MIN_ATTRIBUTION_SAMPLE) {
    const finishedAt = new Date();
    await prisma.adaptiveStrategyRun.update({ where: { id: run.id }, data: { finishedAt, status: "INSUFFICIENT_REAL_DATA" } });
    await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: "ADAPTIVE_STRATEGY bloqueado por amostra real insuficiente.", metadata: JSON.stringify({ adjustmentsGenerated: 0, adjustmentsApplied: 0, blockedSegments: 0, errors: [] }) } }).catch(() => undefined);
    return reportFromData({ runId: run.id, status: "INSUFFICIENT_REAL_DATA", totalTipsAnalyzed, segmentsAnalyzed: 0, adjustments: [], generatedAt: finishedAt, blockReason: "MINIMUM_REAL_SETTLED_SAMPLE_NOT_REACHED" });
  }
  const attribution = await runPerformanceAttribution();
  const persistedSegments = attribution.runId ? await prisma.performanceAttributionSegment.findMany({ where: { runId: attribution.runId }, take: 300 }).catch(() => []) : [];
  const segments = persistedSegments.map((segment) => ({ ...segment, segmentType: segment.segmentType as Segment["segmentType"], status: segment.status as Segment["status"] }));
  const adjustments = await generateStrategyAdjustments(segments);
  const saved: AdaptiveStrategyAdjustmentResult[] = [];
  for (const adjustment of adjustments) {
    const created = await prisma.adaptiveStrategyAdjustment.create({ data: { runId: run.id, ...adjustmentData(adjustment) } });
    const applied = await applyStrategyAdjustment({ ...adjustment, id: created.id }, run.id);
    await prisma.adaptiveStrategyAdjustment.update({ where: { id: created.id }, data: { ruleId: applied.ruleId ?? undefined, status: applied.status, appliedAt: new Date() } });
    saved.push({ ...applied, id: created.id });
  }
  const blockedSegments = saved.filter((item) => item.action === "BLOCK_SEGMENT").length;
  const finishedAt = new Date();
  await prisma.adaptiveStrategyRun.update({ where: { id: run.id }, data: { finishedAt, status: "READY", segmentsAnalyzed: segments.length, adjustmentsGenerated: adjustments.length, adjustmentsApplied: saved.length, blockedSegments } });
  await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: "ADAPTIVE_STRATEGY concluido com performance real liquidada.", metadata: JSON.stringify({ adjustmentsGenerated: adjustments.length, adjustmentsApplied: saved.length, blockedSegments, errors: [] }) } }).catch(() => undefined);
  return reportFromData({ runId: run.id, status: "READY", totalTipsAnalyzed, segmentsAnalyzed: segments.length, adjustments: saved, generatedAt: finishedAt });
}

function adjustmentData(adjustment: InternalAdjustment) {
  return {
    segmentType: adjustment.segmentType,
    segmentKey: adjustment.segmentKey,
    action: adjustment.action,
    weightMultiplier: adjustment.weightMultiplier,
    confidenceThresholdDelta: adjustment.confidenceThresholdDelta,
    stakeMultiplier: adjustment.stakeMultiplier,
    riskSensitivity: adjustment.riskSensitivity,
    sampleSize: adjustment.sampleSize,
    roi: adjustment.roi,
    drawdown: adjustment.drawdown,
    variance: adjustment.variance,
    status: adjustment.status,
    reason: adjustment.reason,
  };
}

function reportFromData(input: { runId: string | null; status: AdaptiveStrategyReport["status"]; totalTipsAnalyzed: number; segmentsAnalyzed: number; adjustments: AdaptiveStrategyAdjustmentResult[]; generatedAt: Date; blockReason?: string }): AdaptiveStrategyReport {
  return {
    status: input.status,
    runId: input.runId,
    modelVersion: ADAPTIVE_MODEL_VERSION,
    totalTipsAnalyzed: input.totalTipsAnalyzed,
    minimumSample: MIN_ATTRIBUTION_SAMPLE,
    segmentsAnalyzed: input.segmentsAnalyzed,
    adjustmentsGenerated: input.adjustments.length,
    adjustmentsApplied: input.adjustments.filter((item) => item.status === "APPLIED").length,
    blockedSegments: input.adjustments.filter((item) => item.action === "BLOCK_SEGMENT").length,
    topAdjustments: input.adjustments.slice(0, 30),
    generatedAt: input.generatedAt.toISOString(),
    blockReason: input.blockReason,
  };
}

export async function getAdaptiveStrategyReport(): Promise<AdaptiveStrategyReport> {
  const latest = await prisma.adaptiveStrategyRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null);
  if (!latest) return runAdaptiveStrategy();
  const adjustments = await prisma.adaptiveStrategyAdjustment.findMany({ where: { runId: latest.id }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 80 }).catch(() => []);
  return reportFromData({
    runId: latest.id,
    status: latest.status === "READY" ? "READY" : "INSUFFICIENT_REAL_DATA",
    totalTipsAnalyzed: latest.totalTipsAnalyzed,
    segmentsAnalyzed: latest.segmentsAnalyzed,
    adjustments: adjustments.map((item) => ({ ...item, action: item.action as AdaptiveAdjustmentAction, segmentType: item.segmentType as AdaptiveSegmentType, riskSensitivity: item.riskSensitivity as AdaptiveStrategyAdjustmentResult["riskSensitivity"], status: item.status as AdaptiveStrategyAdjustmentResult["status"] })),
    generatedAt: latest.finishedAt ?? latest.startedAt,
    blockReason: latest.notes ?? undefined,
  });
}

export async function getAdaptiveStrategySignal(input: { market?: string | null; competition?: string | null; bookmaker?: string | null; provider?: string | null; oddRange?: string | null }): Promise<AdaptiveStrategySignal> {
  const rules = await prisma.adaptiveStrategyRule.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        input.market ? { segmentType: "MARKET", market: input.market } : undefined,
        input.competition ? { segmentType: "COMPETITION", competition: input.competition } : undefined,
        input.bookmaker ? { segmentType: "BOOKMAKER", bookmaker: input.bookmaker } : undefined,
        input.provider ? { segmentType: "PROVIDER", provider: input.provider } : undefined,
        input.oddRange ? { segmentType: "ODD_RANGE", oddRange: input.oddRange } : undefined,
      ].filter(Boolean) as { segmentType: string; market?: string; competition?: string; bookmaker?: string; provider?: string; oddRange?: string }[],
    },
    orderBy: [{ action: "asc" }, { updatedAt: "desc" }],
    take: 20,
  }).catch(() => []);
  if (!rules.length) return { status: "READY", blocked: false, weightMultiplier: 1, confidenceThresholdDelta: 0, stakeMultiplier: 1, riskSensitivity: "NORMAL", actions: [] };
  const actions = rules.map((rule) => rule.action as AdaptiveAdjustmentAction);
  const blocked = actions.includes("BLOCK_SEGMENT");
  const strict = rules.some((rule) => rule.riskSensitivity === "STRICT");
  const elevated = rules.some((rule) => rule.riskSensitivity === "ELEVATED");
  return {
    status: "READY",
    blocked,
    reason: rules.map((rule) => `${rule.action}:${rule.reason}`).join(","),
    weightMultiplier: round(Math.min(...rules.map((rule) => rule.weightMultiplier), 1.1)),
    confidenceThresholdDelta: Math.max(...rules.map((rule) => rule.confidenceThresholdDelta), 0),
    stakeMultiplier: round(Math.min(...rules.map((rule) => rule.stakeMultiplier), 1)),
    riskSensitivity: strict ? "STRICT" : elevated ? "ELEVATED" : "NORMAL",
    actions,
  };
}
