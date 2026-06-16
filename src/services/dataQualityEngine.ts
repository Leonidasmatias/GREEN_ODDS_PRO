import { prisma } from "@/lib/prisma";
import type { DataQualityClassification, DataQualityFinding, DataQualityReport, DataQualitySeverity } from "@/lib/dataQualityTypes";

const CHECKS_RUN = 11;

function classify(score: number): DataQualityClassification {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 50) return "WARNING";
  return "CRITICAL";
}

function scoreImpact(severity: DataQualitySeverity) {
  if (severity === "CRITICAL") return 12;
  if (severity === "WARNING") return 5;
  return 1;
}

function finding(input: Omit<DataQualityFinding, "scoreImpact"> & { scoreImpact?: number }): DataQualityFinding {
  return { ...input, scoreImpact: input.scoreImpact ?? scoreImpact(input.severity) };
}

function duplicateKeys<T>(rows: T[], keyFn: (row: T) => string) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(keyFn(row), (map.get(keyFn(row)) ?? 0) + 1);
  return [...map.entries()].filter(([, count]) => count > 1);
}

async function collectFindings(): Promise<DataQualityFinding[]> {
  const [
    invalidOdds,
    zeroOdds,
    negativeOdds,
    matches,
    odds,
    tips,
    results,
    bankrollProfiles,
    stakeRecommendations,
    matchesWithoutOdds,
  ] = await Promise.all([
    prisma.oddsSnapshot.findMany({ where: { OR: [{ odd: { lte: 1 } }, { odd: { gt: 1000 } }] }, take: 200 }).catch(() => []),
    prisma.oddsSnapshot.findMany({ where: { odd: 0 }, take: 200 }).catch(() => []),
    prisma.oddsSnapshot.findMany({ where: { odd: { lt: 0 } }, take: 200 }).catch(() => []),
    prisma.match.findMany({ include: { oddsSnapshots: true }, take: 2000 }).catch(() => []),
    prisma.oddsSnapshot.findMany({ orderBy: { capturedAt: "desc" }, take: 5000 }).catch(() => []),
    prisma.tip.findMany({ include: { match: true }, take: 2000 }).catch(() => []),
    prisma.tipResult.findMany({ include: { tip: true }, take: 3000 }).catch(() => []),
    prisma.bankrollProfile.findMany({ take: 200 }).catch(() => []),
    prisma.stakeRecommendation.findMany({ take: 2000 }).catch(() => []),
    prisma.match.findMany({ where: { oddsSnapshots: { none: {} } }, take: 200 }).catch(() => []),
  ]);
  const findings: DataQualityFinding[] = [];

  for (const odd of invalidOdds) findings.push(finding({ type: "INVALID_ODD", severity: "CRITICAL", entity: "OddsSnapshot", entityId: odd.id, message: `Odd invalida detectada: ${odd.odd}` }));
  for (const odd of zeroOdds) findings.push(finding({ type: "ZERO_ODD", severity: "CRITICAL", entity: "OddsSnapshot", entityId: odd.id, message: "Odd zerada detectada." }));
  for (const odd of negativeOdds) findings.push(finding({ type: "NEGATIVE_ODD", severity: "CRITICAL", entity: "OddsSnapshot", entityId: odd.id, message: `Odd negativa detectada: ${odd.odd}` }));

  for (const [key, count] of duplicateKeys(matches, (match) => [match.providerId ?? "", match.competition, match.homeTeam, match.awayTeam, match.startsAt.toISOString()].join("||"))) {
    findings.push(finding({ type: "DUPLICATE_MATCH", severity: "WARNING", entity: "Match", message: `${count} partidas duplicadas detectadas.`, metadata: { key, count } }));
  }
  for (const [key, count] of duplicateKeys(odds, (odd) => [odd.matchId, odd.market, odd.selection, odd.provider, odd.capturedAt.toISOString(), odd.odd].join("||"))) {
    findings.push(finding({ type: "DUPLICATE_MARKET", severity: "WARNING", entity: "OddsSnapshot", message: `${count} mercados/odds duplicados detectados.`, metadata: { key, count } }));
  }

  for (const match of matches.filter((item) => item.status === "FINISHED" && (item.homeScore == null || item.awayScore == null))) {
    findings.push(finding({ type: "INCONSISTENT_RESULT", severity: "CRITICAL", entity: "Match", entityId: match.id, message: "Partida finalizada sem placar completo." }));
  }
  for (const result of results.filter((item) => !["WON", "LOST", "VOID"].includes(item.status))) {
    findings.push(finding({ type: "INCONSISTENT_SETTLEMENT_STATUS", severity: "CRITICAL", entity: "TipResult", entityId: result.id, message: `TipResult com status inconsistente: ${result.status}` }));
  }
  const matchIds = new Set(matches.map((match) => match.id));
  for (const result of results.filter((item) => !matchIds.has(item.matchId))) {
    findings.push(finding({ type: "SETTLEMENT_WITHOUT_MATCH", severity: "CRITICAL", entity: "TipResult", entityId: result.id, message: "Liquidacao sem partida persistida correspondente." }));
  }
  for (const match of matchesWithoutOdds) {
    findings.push(finding({ type: "MATCH_WITHOUT_ODDS", severity: "WARNING", entity: "Match", entityId: match.id, message: "Partida sem odds persistidas." }));
  }

  for (const profile of bankrollProfiles.filter((item) => item.initialBankroll < 0 || item.currentBankroll < 0 || item.maxStakePercent <= 0 || item.maxDailyRiskPercent <= 0)) {
    findings.push(finding({ type: "INCONSISTENT_BANKROLL", severity: "CRITICAL", entity: "BankrollProfile", entityId: profile.id, message: "Perfil de banca inconsistente." }));
  }
  for (const tip of tips.filter((item) => item.stake < 0 || item.stakeSuggested < 0)) {
    findings.push(finding({ type: "NEGATIVE_STAKE", severity: "CRITICAL", entity: "Tip", entityId: tip.id, message: "Stake negativa detectada em tip." }));
  }
  for (const recommendation of stakeRecommendations.filter((item) => item.recommendedStake < 0 || item.stakePercent < 0)) {
    findings.push(finding({ type: "NEGATIVE_STAKE_RECOMMENDATION", severity: "CRITICAL", entity: "StakeRecommendation", entityId: recommendation.id, message: "Recomendacao de stake negativa detectada." }));
  }
  for (const result of results.filter((item) => !Number.isFinite(item.roi) || Math.abs(item.roi) > 10000 || !Number.isFinite(item.profit))) {
    findings.push(finding({ type: "IMPOSSIBLE_ROI", severity: "CRITICAL", entity: "TipResult", entityId: result.id, message: `ROI ou lucro impossivel detectado: ROI ${result.roi}, profit ${result.profit}` }));
  }

  return findings.slice(0, 500);
}

function buildReport(input: { runId: string | null; findings: DataQualityFinding[]; generatedAt: Date }): DataQualityReport {
  const criticalCount = input.findings.filter((item) => item.severity === "CRITICAL").length;
  const warningCount = input.findings.filter((item) => item.severity === "WARNING").length;
  const score = Math.max(0, 100 - input.findings.reduce((sum, item) => sum + item.scoreImpact, 0));
  return {
    status: "READY",
    runId: input.runId,
    score,
    classification: classify(score),
    checksRun: CHECKS_RUN,
    alertsFound: input.findings.length,
    criticalCount,
    warningCount,
    findings: input.findings,
    generatedAt: input.generatedAt.toISOString(),
    note: "Nenhum dado e corrigido automaticamente. A auditoria apenas alerta e registra eventos.",
  };
}

async function persistFindings(runId: string, findings: DataQualityFinding[]) {
  await prisma.dataQualityAlert.updateMany({ where: { status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: new Date() } }).catch(() => undefined);
  if (!findings.length) return;
  await prisma.dataQualityAlert.createMany({
    data: findings.map((item) => ({
      runId,
      type: item.type,
      severity: item.severity,
      entity: item.entity,
      entityId: item.entityId ?? undefined,
      scoreImpact: item.scoreImpact,
      message: item.message,
      metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
    })),
  });
  await prisma.dataQualityEvent.createMany({
    data: findings.map((item) => ({
      runId,
      eventType: item.type,
      severity: item.severity,
      entity: item.entity,
      entityId: item.entityId ?? undefined,
      message: item.message,
      metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
    })),
  });
}

export async function runDataQualityAudit(): Promise<DataQualityReport> {
  const startedAt = new Date();
  const job = await prisma.jobRun.create({ data: { name: "DATA_QUALITY_AUDIT", status: "RUNNING", startedAt } }).catch(() => null);
  const run = await prisma.dataQualityRun.create({ data: { startedAt, status: "RUNNING" } });
  const findings = await collectFindings();
  await persistFindings(run.id, findings);
  const report = buildReport({ runId: run.id, findings, generatedAt: new Date() });
  await prisma.dataQualityRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), status: "READY", score: report.score, classification: report.classification, checksRun: report.checksRun, alertsFound: report.alertsFound, criticalCount: report.criticalCount, warningCount: report.warningCount, notes: report.note },
  });
  await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: new Date(), durationMs: Date.now() - startedAt.getTime(), message: "DATA_QUALITY_AUDIT concluido sem correcao automatica.", metadata: JSON.stringify({ score: report.score, classification: report.classification, alertsFound: report.alertsFound, criticalCount: report.criticalCount, warningCount: report.warningCount, errors: [] }) } }).catch(() => undefined);
  return report;
}

export async function getDataQualityReport(): Promise<DataQualityReport> {
  const latest = await prisma.dataQualityRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null);
  if (!latest) return runDataQualityAudit();
  const alerts = await prisma.dataQualityAlert.findMany({ where: { runId: latest.id }, orderBy: [{ severity: "asc" }, { createdAt: "desc" }], take: 100 }).catch(() => []);
  return buildReport({
    runId: latest.id,
    findings: alerts.map((item) => ({
      type: item.type,
      severity: item.severity as DataQualitySeverity,
      entity: item.entity ?? "unknown",
      entityId: item.entityId,
      message: item.message,
      scoreImpact: item.scoreImpact,
      metadata: item.metadata ? JSON.parse(item.metadata) as Record<string, unknown> : undefined,
    })),
    generatedAt: latest.finishedAt ?? latest.startedAt,
  });
}
