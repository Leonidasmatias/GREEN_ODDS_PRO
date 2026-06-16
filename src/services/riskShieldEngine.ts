import { prisma } from "@/lib/prisma";
import type { RiskCheckResult, RiskEvaluationInput, RiskShieldReport } from "@/lib/riskTypes";

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

async function getActiveProfile() {
  return prisma.bankrollProfile.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } }).catch(() => null);
}

async function getExposureState() {
  const profile = await getActiveProfile();
  if (!profile) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [pending, dailyRecommendations, dailyResults] = await Promise.all([
    prisma.tip.findMany({ where: { status: "PENDING" }, include: { match: true } }).catch(() => []),
    prisma.stakeRecommendation.findMany({ where: { createdAt: { gte: start }, status: "READY" } }).catch(() => []),
    prisma.tipResult.findMany({ where: { settledAt: { gte: start }, status: { in: ["WON", "LOST", "VOID"] } } }).catch(() => []),
  ]);
  const market: Record<string, number> = {};
  const competition: Record<string, number> = {};
  const bookmaker: Record<string, number> = {};
  for (const tip of pending) {
    market[tip.market] = (market[tip.market] ?? 0) + tip.stakeSuggested;
    competition[tip.match.competition] = (competition[tip.match.competition] ?? 0) + tip.stakeSuggested;
    bookmaker[tip.bookmaker] = (bookmaker[tip.bookmaker] ?? 0) + tip.stakeSuggested;
  }
  const totalExposure = pending.reduce((sum, tip) => sum + tip.stakeSuggested, 0);
  const dailyRiskUsed = dailyRecommendations.reduce((sum, item) => sum + item.recommendedStake, 0);
  const dailyDrawdown = Math.abs(Math.min(0, dailyResults.reduce((sum, item) => sum + item.profit, 0)));
  return { profile, pending, totalExposure, dailyRiskUsed, dailyDrawdown, market, competition, bookmaker };
}

function pct(value: number, bankroll: number) {
  return bankroll > 0 ? value / bankroll * 100 : 0;
}

export async function checkDailyExposure(requestedStake = 0): Promise<RiskCheckResult> {
  const state = await getExposureState();
  if (!state) return { action: "BLOCK", severity: "CRITICAL", reason: "BANKROLL_NOT_CONFIGURED" };
  const next = pct(state.dailyRiskUsed + requestedStake, state.profile.currentBankroll);
  if (next > state.profile.maxDailyRiskPercent) return { action: "BLOCK", severity: "CRITICAL", reason: "DAILY_EXPOSURE_LIMIT_EXCEEDED" };
  return { action: "ALLOW", severity: "LOW", reason: "DAILY_EXPOSURE_OK" };
}

export async function checkOpenExposure(requestedStake = 0): Promise<RiskCheckResult> {
  const state = await getExposureState();
  if (!state) return { action: "BLOCK", severity: "CRITICAL", reason: "BANKROLL_NOT_CONFIGURED" };
  const next = pct(state.totalExposure + requestedStake, state.profile.currentBankroll);
  if (next > state.profile.maxOpenExposurePercent) return { action: "BLOCK", severity: "CRITICAL", reason: "OPEN_EXPOSURE_LIMIT_EXCEEDED" };
  return { action: "ALLOW", severity: "LOW", reason: "OPEN_EXPOSURE_OK" };
}

export async function checkMarketConcentration(market: string, requestedStake = 0): Promise<RiskCheckResult> {
  const state = await getExposureState();
  if (!state) return { action: "BLOCK", severity: "CRITICAL", reason: "BANKROLL_NOT_CONFIGURED" };
  const concentration = pct((state.market[market] ?? 0) + requestedStake, state.profile.currentBankroll);
  if (concentration > Math.max(1, state.profile.maxOpenExposurePercent * 0.4)) return { action: "WATCH_ONLY", severity: "HIGH", reason: "MARKET_CONCENTRATION_LIMIT" };
  return { action: "ALLOW", severity: "LOW", reason: "MARKET_CONCENTRATION_OK" };
}

export async function checkCompetitionConcentration(competition: string, requestedStake = 0): Promise<RiskCheckResult> {
  const state = await getExposureState();
  if (!state) return { action: "BLOCK", severity: "CRITICAL", reason: "BANKROLL_NOT_CONFIGURED" };
  const concentration = pct((state.competition[competition] ?? 0) + requestedStake, state.profile.currentBankroll);
  if (concentration > Math.max(1.5, state.profile.maxOpenExposurePercent * 0.5)) return { action: "WATCH_ONLY", severity: "HIGH", reason: "COMPETITION_CONCENTRATION_LIMIT" };
  return { action: "ALLOW", severity: "LOW", reason: "COMPETITION_CONCENTRATION_OK" };
}

export async function checkBookmakerConcentration(bookmaker: string, requestedStake = 0): Promise<RiskCheckResult> {
  const state = await getExposureState();
  if (!state) return { action: "BLOCK", severity: "CRITICAL", reason: "BANKROLL_NOT_CONFIGURED" };
  const concentration = pct((state.bookmaker[bookmaker] ?? 0) + requestedStake, state.profile.currentBankroll);
  if (concentration > Math.max(2, state.profile.maxOpenExposurePercent * 0.6)) return { action: "REDUCE_STAKE", severity: "MEDIUM", reason: "BOOKMAKER_CONCENTRATION_LIMIT", reducedStake: Math.max(0, requestedStake * 0.5) };
  return { action: "ALLOW", severity: "LOW", reason: "BOOKMAKER_CONCENTRATION_OK" };
}

export async function checkDrawdownProtection(): Promise<RiskCheckResult> {
  const state = await getExposureState();
  if (!state) return { action: "BLOCK", severity: "CRITICAL", reason: "BANKROLL_NOT_CONFIGURED" };
  const drawdownPct = pct(state.dailyDrawdown, state.profile.currentBankroll);
  if (drawdownPct >= state.profile.stopLossDailyPercent) return { action: "BLOCK", severity: "CRITICAL", reason: "DAILY_DRAWDOWN_LIMIT_EXCEEDED" };
  return { action: "ALLOW", severity: "LOW", reason: "DRAWDOWN_OK" };
}

export async function checkCorrelation(input: RiskEvaluationInput): Promise<RiskCheckResult> {
  const correlated = await prisma.tip.findMany({ where: { status: "PENDING", matchId: input.matchId }, take: 10 }).catch(() => []);
  const sameMarket = correlated.some((tip) => tip.market === input.market);
  if (sameMarket || correlated.length >= 2) {
    await prisma.correlationBlock.create({ data: { matchId: input.matchId, market: input.market, competition: input.competition, reason: sameMarket ? "SAME_MATCH_MARKET_CORRELATION" : "MULTIPLE_ENTRIES_SAME_EVENT", status: "ACTIVE" } }).catch(() => undefined);
    return { action: "BLOCK", severity: "HIGH", reason: sameMarket ? "SAME_MATCH_MARKET_CORRELATION" : "MULTIPLE_ENTRIES_SAME_EVENT" };
  }
  return { action: "ALLOW", severity: "LOW", reason: "CORRELATION_OK" };
}

export function applyRiskAction(results: RiskCheckResult[], requestedStake: number): RiskCheckResult {
  const block = results.find((result) => result.action === "BLOCK");
  if (block) return { ...block, reducedStake: 0 };
  const watch = results.find((result) => result.action === "WATCH_ONLY");
  if (watch) return { ...watch, reducedStake: 0 };
  const reducers = results.filter((result) => result.action === "REDUCE_STAKE");
  if (reducers.length) return { action: "REDUCE_STAKE", severity: "MEDIUM", reason: reducers.map((item) => item.reason).join(","), reducedStake: Math.min(...reducers.map((item) => item.reducedStake ?? requestedStake)) };
  return { action: "ALLOW", severity: "LOW", reason: "RISK_SHIELD_ALLOW", reducedStake: requestedStake };
}

export async function evaluateRiskBeforeTip(input: RiskEvaluationInput): Promise<RiskCheckResult> {
  const discoveryBlock = input.discoveryStatus === "AVOID_OR_WATCH" || input.discoveryStatus === "NEGATIVE"
    ? { action: "BLOCK", severity: "CRITICAL", reason: "AUTO_DISCOVERY_NEGATIVE_PATTERN" } as RiskCheckResult
    : { action: "ALLOW", severity: "LOW", reason: "DISCOVERY_OK" } as RiskCheckResult;
  const highRisk = input.risk === "ALTO" && input.confidenceScore < 80
    ? { action: "BLOCK", severity: "HIGH", reason: "HIGH_RISK_LOW_CONFIDENCE" } as RiskCheckResult
    : { action: "ALLOW", severity: "LOW", reason: "RISK_CONFIDENCE_OK" } as RiskCheckResult;
  const results = await Promise.all([
    checkDailyExposure(input.requestedStake),
    checkOpenExposure(input.requestedStake),
    checkMarketConcentration(input.market, input.requestedStake),
    checkCompetitionConcentration(input.competition, input.requestedStake),
    checkBookmakerConcentration(input.bookmaker, input.requestedStake),
    checkDrawdownProtection(),
    checkCorrelation(input),
  ]);
  const final = applyRiskAction([discoveryBlock, highRisk, ...results], input.requestedStake);
  if (final.action !== "ALLOW") {
    await prisma.riskEvent.create({ data: { tipId: input.tipId ?? undefined, eventType: "PRE_TIP_RISK", severity: final.severity, action: final.action, reason: final.reason } }).catch(() => undefined);
  }
  return final;
}

export async function runRiskMonitoring() {
  const startedAt = new Date();
  const job = await prisma.jobRun.create({ data: { name: "RISK_MONITORING", status: "RUNNING", startedAt } }).catch(() => null);
  const state = await getExposureState();
  if (!state) {
    const finishedAt = new Date();
    await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: "BANKROLL_NOT_CONFIGURED", metadata: JSON.stringify({ risksDetected: 1, tipsBlocked: 0, stakesReduced: 0, errors: [] }) } }).catch(() => undefined);
    return { status: "BANKROLL_NOT_CONFIGURED", risksDetected: 1, tipsBlocked: 0, stakesReduced: 0 };
  }
  await prisma.exposureSnapshot.create({ data: { bankrollProfileId: state.profile.id, date: new Date(), totalExposure: state.totalExposure, dailyRiskUsed: state.dailyRiskUsed, openTips: state.pending.length, marketExposure: JSON.stringify(state.market), competitionExposure: JSON.stringify(state.competition), bookmakerExposure: JSON.stringify(state.bookmaker) } }).catch(() => undefined);
  const [risksDetected, tipsBlocked, stakesReduced] = await Promise.all([
    prisma.riskEvent.count().catch(() => 0),
    prisma.riskEvent.count({ where: { action: "BLOCK" } }).catch(() => 0),
    prisma.riskEvent.count({ where: { action: "REDUCE_STAKE" } }).catch(() => 0),
  ]);
  const finishedAt = new Date();
  await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: "RISK_MONITORING concluido.", metadata: JSON.stringify({ risksDetected, tipsBlocked, stakesReduced, errors: [] }) } }).catch(() => undefined);
  return { status: "READY", risksDetected, tipsBlocked, stakesReduced };
}

export async function getRiskShieldReport(): Promise<RiskShieldReport> {
  const state = await getExposureState();
  if (!state) return { status: "BANKROLL_NOT_CONFIGURED", dailyRiskUsed: 0, openExposure: 0, risksDetected: 0, tipsBlocked: 0, stakesReduced: 0, marketConcentration: {}, competitionConcentration: {}, bookmakerConcentration: {}, correlationAlerts: 0, generatedAt: new Date().toISOString(), reason: "BANKROLL_NOT_CONFIGURED" };
  const [risksDetected, tipsBlocked, stakesReduced, correlationAlerts] = await Promise.all([
    prisma.riskEvent.count().catch(() => 0),
    prisma.riskEvent.count({ where: { action: "BLOCK" } }).catch(() => 0),
    prisma.riskEvent.count({ where: { action: "REDUCE_STAKE" } }).catch(() => 0),
    prisma.correlationBlock.count({ where: { status: "ACTIVE" } }).catch(() => 0),
  ]);
  return { status: "READY", dailyRiskUsed: round(state.dailyRiskUsed), openExposure: round(state.totalExposure), risksDetected, tipsBlocked, stakesReduced, marketConcentration: state.market, competitionConcentration: state.competition, bookmakerConcentration: state.bookmaker, correlationAlerts, generatedAt: new Date().toISOString() };
}
