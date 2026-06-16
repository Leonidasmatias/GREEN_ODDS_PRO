import { prisma } from "@/lib/prisma";
import type { BankrollExposure, BankrollReport, BankrollRiskProfile, StakeRecommendationInput, StakeRecommendationResult, StakeStrategy } from "@/lib/bankrollTypes";

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

async function getActiveProfile() {
  return prisma.bankrollProfile.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } }).catch(() => null);
}

function percentOfBankroll(value: number, bankroll: number) {
  return bankroll > 0 ? value / bankroll * 100 : 0;
}

export function calculateKellyStake(input: { bankroll: number; odd: number; modelProbability: number; maxStakePercent: number; fraction?: "FULL" | "HALF" | "QUARTER" }) {
  const b = input.odd - 1;
  if (b <= 0 || input.modelProbability <= 0 || input.modelProbability >= 1) return 0;
  const q = 1 - input.modelProbability;
  const fullKellyPercent = Math.max(0, (b * input.modelProbability - q) / b * 100);
  const fraction = input.fraction === "FULL" ? 1 : input.fraction === "HALF" ? 0.5 : 0.25;
  const cappedPercent = Math.min(fullKellyPercent * fraction, input.maxStakePercent);
  return round(input.bankroll * cappedPercent / 100);
}

export function calculateFlatStake(input: { bankroll: number; riskProfile: string; maxStakePercent: number }) {
  const profile = input.riskProfile.toUpperCase() as BankrollRiskProfile;
  const basePercent = profile === "AGRESSIVO" ? 1 : profile === "MODERADO" ? 0.5 : 0.25;
  const stakePercent = Math.min(basePercent, input.maxStakePercent);
  return round(input.bankroll * stakePercent / 100);
}

export async function calculateExposure(profileId?: string): Promise<BankrollExposure> {
  const profile = profileId ? await prisma.bankrollProfile.findUnique({ where: { id: profileId } }).catch(() => null) : await getActiveProfile();
  if (!profile) return { openExposure: 0, openExposurePercent: 0, dailyRiskUsed: 0, dailyRiskUsedPercent: 0, marketExposure: {}, competitionExposure: {}, bookmakerExposure: {} };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [pending, dailyRecommendations] = await Promise.all([
    prisma.tip.findMany({ where: { status: "PENDING" }, include: { match: true } }).catch(() => []),
    prisma.stakeRecommendation.findMany({ where: { createdAt: { gte: start }, status: "READY" } }).catch(() => []),
  ]);
  const openExposure = pending.reduce((sum, tip) => sum + tip.stakeSuggested, 0);
  const dailyRiskUsed = dailyRecommendations.reduce((sum, item) => sum + item.recommendedStake, 0);
  const marketExposure: Record<string, number> = {};
  const competitionExposure: Record<string, number> = {};
  const bookmakerExposure: Record<string, number> = {};
  for (const tip of pending) {
    marketExposure[tip.market] = (marketExposure[tip.market] ?? 0) + tip.stakeSuggested;
    competitionExposure[tip.match.competition] = (competitionExposure[tip.match.competition] ?? 0) + tip.stakeSuggested;
    bookmakerExposure[tip.bookmaker] = (bookmakerExposure[tip.bookmaker] ?? 0) + tip.stakeSuggested;
  }
  return { openExposure, openExposurePercent: percentOfBankroll(openExposure, profile.currentBankroll), dailyRiskUsed, dailyRiskUsedPercent: percentOfBankroll(dailyRiskUsed, profile.currentBankroll), marketExposure, competitionExposure, bookmakerExposure };
}

function strategyFor(profile: { riskProfile: string }, input: StakeRecommendationInput): StakeStrategy {
  if ((input.modelProbability ?? 0) > 0 && (input.edge ?? 0) > 0) {
    if (profile.riskProfile === "AGRESSIVO") return "KELLY_HALF";
    if (profile.riskProfile === "MODERADO") return "KELLY_QUARTER";
    return "KELLY_CAPPED";
  }
  if (profile.riskProfile === "AGRESSIVO") return "FLAT_AGGRESSIVE";
  if (profile.riskProfile === "MODERADO") return "FLAT_MODERATE";
  return "FLAT_CONSERVATIVE";
}

export function applyRiskControls(input: { profile: { currentBankroll: number; maxDailyRiskPercent: number; maxStakePercent: number; maxOpenExposurePercent: number; riskProfile: string }; exposure: BankrollExposure; recommendation: StakeRecommendationInput; rawStake: number; strategy: StakeStrategy }): StakeRecommendationResult {
  if (input.recommendation.discoveryStatus === "AVOID_OR_WATCH" || input.recommendation.discoveryStatus === "NEGATIVE") return { status: "BLOCKED", recommendedStake: 0, stakePercent: 0, strategy: "NO_STAKE", reason: "AUTO_DISCOVERY_NEGATIVE_PATTERN" };
  if (input.recommendation.risk === "ALTO" && input.recommendation.confidenceScore < 80) return { status: "BLOCKED", recommendedStake: 0, stakePercent: 0, strategy: "NO_STAKE", reason: "HIGH_RISK_LOW_CONFIDENCE" };
  if (input.recommendation.confidenceScore < 60) return { status: "CONSERVATIVE_ONLY", recommendedStake: 0, stakePercent: 0, strategy: "NO_STAKE", reason: "CONFIDENCE_BELOW_MINIMUM" };
  if ((input.recommendation.drawdown ?? 0) > Math.max(3, input.profile.currentBankroll * 0.03)) return { status: "CONSERVATIVE_ONLY", recommendedStake: 0, stakePercent: 0, strategy: "NO_STAKE", reason: "DRAWDOWN_HIGH" };
  if (input.exposure.dailyRiskUsedPercent >= input.profile.maxDailyRiskPercent) return { status: "BLOCKED", recommendedStake: 0, stakePercent: 0, strategy: "NO_STAKE", reason: "DAILY_RISK_LIMIT_REACHED" };
  if (input.exposure.openExposurePercent >= input.profile.maxOpenExposurePercent) return { status: "BLOCKED", recommendedStake: 0, stakePercent: 0, strategy: "NO_STAKE", reason: "OPEN_EXPOSURE_LIMIT_REACHED" };
  const maxStake = input.profile.currentBankroll * input.profile.maxStakePercent / 100;
  const dailyRemaining = input.profile.currentBankroll * Math.max(0, input.profile.maxDailyRiskPercent - input.exposure.dailyRiskUsedPercent) / 100;
  const exposureRemaining = input.profile.currentBankroll * Math.max(0, input.profile.maxOpenExposurePercent - input.exposure.openExposurePercent) / 100;
  const cappedStake = round(Math.max(0, Math.min(input.rawStake, maxStake, dailyRemaining, exposureRemaining)));
  if (cappedStake <= 0) return { status: "BLOCKED", recommendedStake: 0, stakePercent: 0, strategy: "NO_STAKE", reason: "STAKE_REDUCED_TO_ZERO_BY_LIMITS" };
  return { status: "READY", recommendedStake: cappedStake, stakePercent: round(percentOfBankroll(cappedStake, input.profile.currentBankroll), 4), strategy: input.strategy, reason: cappedStake < input.rawStake ? "STAKE_CAPPED_BY_RISK_LIMITS" : "STAKE_ALLOWED_BY_RISK_CONTROLS" };
}

export async function recommendStake(input: StakeRecommendationInput): Promise<StakeRecommendationResult> {
  const profile = await getActiveProfile();
  if (!profile) return { status: "BANKROLL_NOT_CONFIGURED", recommendedStake: 0, stakePercent: 0, strategy: "NO_STAKE", reason: "BANKROLL_NOT_CONFIGURED" };
  const exposure = await calculateExposure(profile.id);
  const strategy = strategyFor(profile, input);
  const rawStake = strategy.startsWith("KELLY") && input.modelProbability != null
    ? calculateKellyStake({ bankroll: profile.currentBankroll, odd: input.odd, modelProbability: input.modelProbability, maxStakePercent: profile.maxStakePercent, fraction: strategy === "KELLY_HALF" ? "HALF" : "QUARTER" })
    : calculateFlatStake({ bankroll: profile.currentBankroll, riskProfile: profile.riskProfile, maxStakePercent: profile.maxStakePercent });
  const result = applyRiskControls({ profile, exposure, recommendation: input, rawStake, strategy });
  await prisma.stakeRecommendation.create({
    data: {
      tipId: input.tipId ?? undefined,
      matchId: input.matchId,
      market: input.market,
      selection: input.selection,
      odd: input.odd,
      confidenceScore: input.confidenceScore,
      modelProbability: input.modelProbability ?? undefined,
      edge: input.edge ?? undefined,
      expectedValue: input.expectedValue ?? undefined,
      risk: input.risk,
      recommendedStake: result.recommendedStake,
      stakePercent: result.stakePercent,
      strategy: result.strategy,
      status: result.status,
      reason: result.reason,
    },
  }).catch(() => undefined);
  return result;
}

export async function recalculateBankrollRecommendations() {
  const startedAt = new Date();
  const job = await prisma.jobRun.create({ data: { name: "BANKROLL_RECALCULATION", status: "RUNNING", startedAt } }).catch(() => null);
  const profile = await getActiveProfile();
  if (!profile) {
    const finishedAt = new Date();
    await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: "BANKROLL_NOT_CONFIGURED", metadata: JSON.stringify({ recommendationsGenerated: 0, blockedRecommendations: 0, errors: [] }) } }).catch(() => undefined);
    return { status: "BANKROLL_NOT_CONFIGURED", recommendationsGenerated: 0, blockedRecommendations: 0 };
  }
  const tips = await prisma.tip.findMany({ where: { status: "PENDING" }, include: { match: true }, take: 200 }).catch(() => []);
  let generated = 0;
  let blocked = 0;
  for (const tip of tips) {
    const recommendation = await recommendStake({ tipId: tip.id, matchId: tip.matchId, market: tip.market, selection: tip.selection, competition: tip.match.competition, bookmaker: tip.bookmaker, odd: tip.odd, confidenceScore: tip.confidenceScore, impliedProbability: tip.impliedProbability, modelProbability: tip.estimatedProbability, edge: tip.edge, expectedValue: tip.expectedValue, risk: tip.risk });
    generated += recommendation.status === "READY" ? 1 : 0;
    blocked += recommendation.status !== "READY" ? 1 : 0;
  }
  const finishedAt = new Date();
  await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: "BANKROLL_RECALCULATION concluido.", metadata: JSON.stringify({ recommendationsGenerated: generated, blockedRecommendations: blocked, errors: [] }) } }).catch(() => undefined);
  return { status: "READY", recommendationsGenerated: generated, blockedRecommendations: blocked };
}

export async function getBankrollReport(): Promise<BankrollReport> {
  const profile = await getActiveProfile();
  if (!profile) return { status: "BANKROLL_NOT_CONFIGURED", profileName: null, currency: null, currentBankroll: null, riskProfile: null, dailyRiskUsed: 0, dailyRiskUsedPercent: 0, openExposure: 0, openExposurePercent: 0, recommendationsGenerated: 0, blockedRecommendations: 0, generatedAt: new Date().toISOString(), reason: "BANKROLL_NOT_CONFIGURED" };
  const [exposure, recommendationsGenerated, blockedRecommendations] = await Promise.all([
    calculateExposure(profile.id),
    prisma.stakeRecommendation.count({ where: { status: "READY" } }).catch(() => 0),
    prisma.stakeRecommendation.count({ where: { status: { not: "READY" } } }).catch(() => 0),
  ]);
  return { status: "READY", profileName: profile.name, currency: profile.currency, currentBankroll: profile.currentBankroll, riskProfile: profile.riskProfile, dailyRiskUsed: round(exposure.dailyRiskUsed), dailyRiskUsedPercent: round(exposure.dailyRiskUsedPercent), openExposure: round(exposure.openExposure), openExposurePercent: round(exposure.openExposurePercent), recommendationsGenerated, blockedRecommendations, generatedAt: new Date().toISOString() };
}
