import { prisma } from "@/lib/prisma";
import type { ExecutiveCenter, ExecutiveKpi, ExecutiveStatus } from "@/lib/executiveTypes";
import { getCommandCenter, getPerformance } from "./operationalService";
import { getSmartConfidenceReport } from "./smartConfidenceEngine";
import { generateModelReport } from "./mlEngine";
import { getAutoDiscoveryReport } from "./autoDiscoveryEngine";
import { getBankrollReport } from "./bankrollEngine";
import { getRiskShieldReport } from "./riskShieldEngine";
import { buildGreenScoreReport } from "./greenScoreEngine";

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

function statusFromCount(count: number): ExecutiveStatus {
  return count > 0 ? "READY" : "INSUFFICIENT_REAL_DATA";
}

function centerStatus(kpis: ExecutiveKpi[]): ExecutiveStatus {
  if (kpis.some((kpi) => kpi.status === "BLOCKED")) return "BLOCKED";
  if (kpis.some((kpi) => kpi.status === "READY")) return "READY";
  return "INSUFFICIENT_REAL_DATA";
}

function kpi(key: string, label: string, value: string | number, status: ExecutiveStatus, source: string, audit: string): ExecutiveKpi {
  return { key, label, value, status, source, audit };
}

function sourceIntegrityStatus(input: { sourceIntegrity?: { status: string }; provider?: string }) {
  if (input.sourceIntegrity?.status === "REAL_ONLY" && input.provider && input.provider !== "none" && !input.provider.toLowerCase().startsWith("mock")) return "REAL_ONLY";
  return "BLOCKED";
}

export async function getExecutiveCommandCenter() {
  const [legacy, green, confidence, ml, discovery, bankroll, riskShield, performance] = await Promise.all([
    getCommandCenter(),
    buildGreenScoreReport(),
    getSmartConfidenceReport(),
    generateModelReport(),
    getAutoDiscoveryReport(),
    getBankrollReport(),
    getRiskShieldReport(),
    getPerformance(),
  ]);

  const integrity = sourceIntegrityStatus({ sourceIntegrity: green.audit.sourceIntegrity, provider: green.provider });
  const latestPeriod = performance.periods.at(-1);
  const totalSettled = (latestPeriod?.greens ?? 0) + (latestPeriod?.reds ?? 0);
  const executiveOverview: ExecutiveCenter = {
    generatedAt: new Date().toISOString(),
    kpis: [
      kpi("odds_of_day", "Odds do Dia", green.audit.oddsOfDay, statusFromCount(green.audit.oddsOfDay), "Green Score Engine", "greenScore >= 80, confidence >= 80, risk LOW"),
      kpi("green_score_rows", "Green Scores auditados", green.audit.persistence.persisted, statusFromCount(green.audit.persistence.persisted), "green_score_analyses", green.audit.persistence.status),
      kpi("source_integrity", "Integridade da fonte", integrity, integrity === "REAL_ONLY" ? "READY" : "BLOCKED", "Green Score Engine", "mock/sintetico bloqueado"),
      kpi("settled_results", "Resultados liquidados", totalSettled, statusFromCount(totalSettled), "TipResult", "WON/LOST reais"),
    ],
    status: "INSUFFICIENT_REAL_DATA",
  };
  executiveOverview.status = centerStatus(executiveOverview.kpis);

  const systemHealthCenter: ExecutiveCenter = {
    generatedAt: new Date().toISOString(),
    kpis: [
      kpi("provider", "Provider", legacy.operational.provider, legacy.operational.providerStatus === "ACTIVE" ? "READY" : "INSUFFICIENT_REAL_DATA", "Provider Manager", legacy.operational.providerStatus),
      kpi("odds_persisted", "Odds persistidas", legacy.operational.oddsPersisted, statusFromCount(legacy.operational.oddsPersisted), "odds_snapshots", "provider real"),
      kpi("confidence", "Confidence Engine", confidence.status, confidence.status === "READY" ? "READY" : "INSUFFICIENT_REAL_DATA", "Smart Confidence", `${confidence.sourceRows}/${confidence.minimumSample}`),
      kpi("ml", "ML Engine", ml.status, ml.status === "TRAINED" ? "READY" : "INSUFFICIENT_REAL_DATA", "ML Engine", ml.blockReason ?? ml.modelVersion ?? "baseline"),
      kpi("discovery", "Discovery Patterns", discovery.status, discovery.status === "READY" ? "READY" : "INSUFFICIENT_REAL_DATA", "Auto Discovery", `${discovery.totalTipsAnalyzed}/${discovery.minimumSample}`),
    ],
    status: "INSUFFICIENT_REAL_DATA",
  };
  systemHealthCenter.status = centerStatus(systemHealthCenter.kpis);

  const topOpportunities = green.oddsOfDay.slice(0, 10).map((item) => ({
    id: item.id,
    game: item.value.game,
    market: item.value.market,
    selection: item.value.selection,
    odd: item.value.odd,
    greenScore: item.greenScore,
    confidence: item.confidence,
    risk: item.risk,
    classification: item.classification,
    expectedValue: item.value.expectedValue,
    source: "Green Score Engine",
  }));

  const bankrollCenter: ExecutiveCenter = {
    generatedAt: bankroll.generatedAt,
    kpis: [
      kpi("status", "Status", bankroll.status, bankroll.status === "READY" ? "READY" : "INSUFFICIENT_REAL_DATA", "Bankroll Engine", bankroll.reason ?? "perfil ativo"),
      kpi("bankroll", "Banca atual", bankroll.currentBankroll == null ? "BANKROLL_NOT_CONFIGURED" : round(bankroll.currentBankroll), bankroll.currentBankroll == null ? "INSUFFICIENT_REAL_DATA" : "READY", "BankrollProfile", bankroll.currency ?? "-"),
      kpi("daily_risk", "Risco diario usado", `${bankroll.dailyRiskUsedPercent.toFixed(2)}%`, bankroll.status === "READY" ? "READY" : "INSUFFICIENT_REAL_DATA", "StakeRecommendation", "limite diario"),
      kpi("open_exposure", "Exposicao aberta", `${bankroll.openExposurePercent.toFixed(2)}%`, bankroll.status === "READY" ? "READY" : "INSUFFICIENT_REAL_DATA", "Tip PENDING", "stakeSuggested"),
    ],
    status: "INSUFFICIENT_REAL_DATA",
  };
  bankrollCenter.status = centerStatus(bankrollCenter.kpis);

  const riskShieldCenter: ExecutiveCenter = {
    generatedAt: riskShield.generatedAt,
    kpis: [
      kpi("status", "Status", riskShield.status, riskShield.status === "READY" ? "READY" : "INSUFFICIENT_REAL_DATA", "Risk Shield", riskShield.reason ?? "READY"),
      kpi("risks", "Riscos detectados", riskShield.risksDetected, "READY", "RiskEvent", "eventos reais"),
      kpi("blocked", "Tips bloqueadas", riskShield.tipsBlocked, "READY", "RiskEvent", "action BLOCK"),
      kpi("correlation", "Alertas de correlacao", riskShield.correlationAlerts, "READY", "CorrelationBlock", "status ACTIVE"),
    ],
    status: "INSUFFICIENT_REAL_DATA",
  };
  riskShieldCenter.status = centerStatus(riskShieldCenter.kpis);

  const settledPeriods = performance.periods.filter((period) => period.greens + period.reds > 0);
  const performanceCenter: ExecutiveCenter = {
    generatedAt: new Date().toISOString(),
    kpis: [
      kpi("periods", "Periodos com resultado", settledPeriods.length, statusFromCount(settledPeriods.length), "Tip", "WON/LOST"),
      kpi("roi_90d", "ROI 90 dias", `${(performance.periods.find((period) => period.days === 90)?.roi ?? 0).toFixed(2)}%`, statusFromCount(settledPeriods.length), "Performance", "tips liquidadas"),
      kpi("markets_ranked", "Mercados ranqueados", performance.rankings.filter((item) => item.entries > 0).length, statusFromCount(performance.rankings.filter((item) => item.entries > 0).length), "Performance", "ranking real"),
    ],
    status: "INSUFFICIENT_REAL_DATA",
  };
  performanceCenter.status = centerStatus(performanceCenter.kpis);

  const allKpis = [executiveOverview, systemHealthCenter, bankrollCenter, riskShieldCenter, performanceCenter].flatMap((center) => center.kpis);
  const insufficientKpis = allKpis.filter((item) => item.status !== "READY").length;
  const executiveAudit = {
    status: integrity === "REAL_ONLY" && insufficientKpis === 0 ? "READY" : integrity === "REAL_ONLY" ? "INSUFFICIENT_REAL_DATA" : "BLOCKED",
    provider: green.provider,
    sourceIntegrity: integrity,
    totalKpis: allKpis.length,
    insufficientKpis,
    generatedAt: new Date().toISOString(),
  };

  const payload = {
    ...legacy,
    executive: {
      overview: executiveOverview,
      systemHealth: systemHealthCenter,
      topOpportunities,
      bankroll: bankrollCenter,
      riskShield: riskShieldCenter,
      performance: performanceCenter,
      audit: executiveAudit,
      integrations: {
        valueEngine: green.audit.analyzed > 0 ? "READY" : "INSUFFICIENT_REAL_DATA",
        confidenceEngine: confidence.status,
        mlEngine: ml.status,
        discoveryPatterns: discovery.status,
        bankrollEngine: bankroll.status,
        riskShield: riskShield.status,
        greenScoreEngine: green.audit.persistence.status,
      },
    },
  };

  await prisma.executiveCommandAudit.create({
    data: {
      status: executiveAudit.status,
      provider: executiveAudit.provider,
      sourceIntegrity: executiveAudit.sourceIntegrity,
      totalKpis: executiveAudit.totalKpis,
      insufficientKpis: executiveAudit.insufficientKpis,
      oddsOfDay: green.audit.oddsOfDay,
      topOpportunities: topOpportunities.length,
      bankrollStatus: bankroll.status,
      riskShieldStatus: riskShield.status,
      performanceStatus: performanceCenter.status,
      systemHealthStatus: systemHealthCenter.status,
      payload: JSON.stringify(payload.executive),
    },
  }).catch(() => undefined);

  return payload;
}

export async function getExecutiveCommandAudit() {
  const report = await getExecutiveCommandCenter();
  const latest = await prisma.executiveCommandAudit.findMany({ orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []);
  return {
    audit: report.executive.audit,
    integrations: report.executive.integrations,
    mockSyntheticCheck: {
      status: report.executive.audit.sourceIntegrity,
      rule: "providers/events mock and synthetic rows are blocked before executive approval",
    },
    kpis: {
      overview: report.executive.overview.kpis,
      systemHealth: report.executive.systemHealth.kpis,
      bankroll: report.executive.bankroll.kpis,
      riskShield: report.executive.riskShield.kpis,
      performance: report.executive.performance.kpis,
    },
    latest: latest.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    checkedAt: new Date().toISOString(),
  };
}
