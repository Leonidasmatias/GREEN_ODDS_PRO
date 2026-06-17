import { prisma } from "@/lib/prisma";
import type { GreenClassification, GreenRisk, GreenScoreOpportunity, GreenScoreReport } from "@/lib/greenScoreTypes";
import type { ValueOpportunity } from "@/lib/valueTypes";
import { buildValueReport } from "./valueEngine";
import { generateModelReport } from "./mlEngine";
import { getAutoDiscoveryReport } from "./autoDiscoveryEngine";
import { getRiskShieldReport } from "./riskShieldEngine";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function isRealProvider(provider: string | null | undefined) {
  return Boolean(provider && provider !== "none" && !provider.toLowerCase().startsWith("mock"));
}

function isMockEvent(providerEventId: string | null | undefined) {
  return Boolean(providerEventId && providerEventId.toLowerCase().startsWith("mock"));
}

export function classifyGreenScore(score: number): GreenClassification {
  if (score >= 90) return "ELITE_GREEN";
  if (score >= 80) return "STRONG_GREEN";
  if (score >= 70) return "GREEN";
  if (score >= 60) return "WATCHLIST";
  return "AVOID";
}

function normalizeRisk(risk: ValueOpportunity["risk"]): GreenRisk {
  if (risk === "BAIXO") return "LOW";
  if (risk === "MEDIO") return "MEDIUM";
  if (risk === "ALTO") return "HIGH";
  return "UNDEFINED";
}

function scoreDiscovery(status?: string | null) {
  if (status === "ELITE_PATTERN") return 100;
  if (status === "STRONG_PATTERN") return 90;
  if (status === "PROMISING") return 78;
  if (status === "WATCH") return 65;
  if (status === "AVOID_OR_WATCH") return 20;
  return 50;
}

function riskScore(risk: GreenRisk) {
  if (risk === "LOW") return 100;
  if (risk === "MEDIUM") return 65;
  if (risk === "HIGH") return 15;
  return 35;
}

function buildReasons(input: {
  value: ValueOpportunity;
  risk: GreenRisk;
  mlReady: boolean;
  discoveryBlocked: boolean;
  riskShieldReady: boolean;
  score: number;
}) {
  const reasons = [...input.value.rejectionReasons];
  if (input.value.status !== "APPROVED") reasons.push(`VALUE_${input.value.status}`);
  if (input.value.confidence < 80) reasons.push("CONFIDENCE_BELOW_80");
  if (input.risk !== "LOW") reasons.push("RISK_NOT_LOW");
  if (input.score < 80) reasons.push("GREEN_SCORE_BELOW_80");
  if (!input.mlReady) reasons.push("ML_ENGINE_NOT_READY");
  if (input.discoveryBlocked) reasons.push("DISCOVERY_NEGATIVE_PATTERN");
  if (!input.riskShieldReady) reasons.push("RISK_SHIELD_NOT_READY");
  return [...new Set(reasons)];
}

export function calculateGreenScore(value: ValueOpportunity) {
  const risk = normalizeRisk(value.risk);
  const mlConfidence = value.modelStatus === "READY" ? value.modelConfidenceScore ?? 0 : 0;
  const smartConfidence = value.smartConfidenceStatus === "READY" ? value.smartConfidenceScore ?? 0 : 0;
  const sampleScore = clamp(Math.min(value.historicalSample, value.marketSample) / 30 * 100);
  const evScore = clamp(((value.expectedValue ?? 0) / 0.18) * 100);
  const edgeScore = clamp(((value.edge ?? 0) / 0.12) * 100);
  const discoveryScore = scoreDiscovery(value.discoveryStatus);
  const raw = value.score * 0.24 + value.confidence * 0.2 + smartConfidence * 0.16 + mlConfidence * 0.14 + discoveryScore * 0.1 + riskScore(risk) * 0.1 + sampleScore * 0.04 + evScore * 0.01 + edgeScore * 0.01;
  return Math.round(clamp(raw));
}

async function persistGreenScores(items: GreenScoreOpportunity[]) {
  if (!items.length) return { attempted: 0, persisted: 0, skipped: 0, status: "EMPTY" as const };
  try {
    const result = await prisma.greenScoreAnalysis.createMany({
    data: items.map((item) => ({
      matchId: item.value.matchId,
      oddsSnapshotId: item.value.oddsSnapshotId,
      provider: item.value.provider,
      bookmaker: item.value.bookmaker,
      competition: item.value.competition,
      gameLabel: item.value.game,
      market: item.value.market,
      selection: item.value.selection,
      odd: item.value.odd,
      greenScore: item.greenScore,
      confidence: item.confidence,
      risk: item.risk,
      classification: item.classification,
      qualifiesOddsOfDay: item.qualifiesOddsOfDay,
      valueScore: item.value.score,
      valueStatus: item.value.status,
      mlStatus: item.engineStatus.ml,
      mlConfidence: item.value.modelConfidenceScore ?? 0,
      discoveryStatus: item.value.discoveryStatus,
      riskShieldStatus: item.engineStatus.riskShield,
      rejectionReasons: item.reasons.join(","),
      analyzedAt: new Date(item.analyzedAt),
    })),
    });
    return { attempted: items.length, persisted: result.count, skipped: items.length - result.count, status: "READY" as const };
  } catch (error) {
    return { attempted: items.length, persisted: 0, skipped: items.length, status: "UNAVAILABLE" as const, reason: error instanceof Error ? error.message : "GREEN_SCORE_PERSISTENCE_FAILED" };
  }
}

export async function buildGreenScoreReport(): Promise<GreenScoreReport> {
  const [valueReport, ml, discovery, riskShield] = await Promise.all([
    buildValueReport(),
    generateModelReport(),
    getAutoDiscoveryReport(),
    getRiskShieldReport(),
  ]);
  const analyzedAt = new Date().toISOString();
  const rejectionReasons: Record<string, number> = {};
  const mlReady = ml.status === "TRAINED";
  const riskShieldReady = riskShield.status === "READY";

  const opportunities = valueReport.opportunities.map((value) => {
    const greenScore = calculateGreenScore(value);
    const risk = normalizeRisk(value.risk);
    const discoveryBlocked = Boolean(value.discoveryBlockReason) || value.discoveryStatus === "AVOID_OR_WATCH";
    const confidence = Math.round(value.confidence);
    const reasons = buildReasons({ value, risk, mlReady, discoveryBlocked, riskShieldReady, score: greenScore });
    const qualifiesOddsOfDay = greenScore >= 80 && confidence >= 80 && risk === "LOW" && value.status === "APPROVED" && mlReady && !discoveryBlocked && riskShieldReady;
    for (const reason of reasons) increment(rejectionReasons, reason);
    return {
      id: `${value.id}-green-score`,
      value,
      greenScore,
      confidence,
      risk,
      classification: classifyGreenScore(greenScore),
      qualifiesOddsOfDay,
      reasons,
      engineStatus: {
        value: value.status,
        confidence: value.smartConfidenceStatus ?? "INSUFFICIENT_REAL_DATA",
        ml: ml.status,
        discovery: value.discoveryStatus ?? discovery.status,
        riskShield: riskShield.status,
      },
      analyzedAt,
    };
  });

  const mockProviders = opportunities.filter((item) => !isRealProvider(item.value.provider) || !isRealProvider(item.value.bookmaker)).length;
  const mockEvents = opportunities.filter((item) => isMockEvent(item.value.providerEventId)).length;
  const syntheticRows = opportunities.filter((item) => item.value.rejectionReasons.includes("SYNTHETIC_DATA") || item.value.rejectionReasons.includes("MOCK_DATA")).length;
  const sourceIntegrity = {
    onlyRealProvider: mockProviders === 0 && mockEvents === 0 && syntheticRows === 0 && isRealProvider(valueReport.provider),
    mockProviders,
    mockEvents,
    syntheticRows,
    status: mockProviders === 0 && mockEvents === 0 && syntheticRows === 0 && isRealProvider(valueReport.provider) ? "REAL_ONLY" as const : "BLOCKED" as const,
  };

  const oddsOfDay = opportunities.filter((item) => item.qualifiesOddsOfDay && sourceIntegrity.status === "REAL_ONLY").sort((a, b) => b.greenScore - a.greenScore || b.confidence - a.confidence);
  const radar = opportunities.filter((item) => item.greenScore >= 60).sort((a, b) => b.greenScore - a.greenScore || b.confidence - a.confidence);
  const watchlist = opportunities.filter((item) => item.greenScore < 80 || !item.qualifiesOddsOfDay).sort((a, b) => b.greenScore - a.greenScore);
  const persistence = await persistGreenScores(opportunities);
  if (sourceIntegrity.status !== "REAL_ONLY") increment(rejectionReasons, "SOURCE_INTEGRITY_BLOCKED");

  const audit = {
    provider: valueReport.provider,
    analyzed: opportunities.length,
    oddsOfDay: oddsOfDay.length,
    elite: opportunities.filter((item) => item.classification === "ELITE_GREEN").length,
    strong: opportunities.filter((item) => item.classification === "STRONG_GREEN").length,
    green: opportunities.filter((item) => item.classification === "GREEN").length,
    watchlist: opportunities.filter((item) => item.classification === "WATCHLIST").length,
    avoid: opportunities.filter((item) => item.classification === "AVOID").length,
    rejected: opportunities.filter((item) => !item.qualifiesOddsOfDay).length,
    rejectionReasons,
    persistence,
    sourceIntegrity,
    generatedAt: analyzedAt,
  };

  await prisma.auditLog.create({
    data: {
      category: "GREEN_SCORE_ENGINE",
      status: oddsOfDay.length ? "READY" : "WATCH",
      message: `${audit.analyzed} odds reais avaliadas pelo Green Score; ${audit.oddsOfDay} Odds do Dia liberadas.`,
      metadata: JSON.stringify({ audit, mlStatus: ml.status, discoveryStatus: discovery.status, riskShieldStatus: riskShield.status, sourceIntegrity }),
    },
  }).catch(() => undefined);

  return {
    provider: valueReport.provider,
    updatedAt: analyzedAt,
    gamesLoaded: valueReport.gamesLoaded,
    opportunities,
    radar,
    oddsOfDay,
    watchlist,
    audit,
    warning: oddsOfDay.length ? undefined : "Nenhuma Odd do Dia validada pelos criterios greenScore >= 80, confidence >= 80 e risk LOW.",
  };
}
