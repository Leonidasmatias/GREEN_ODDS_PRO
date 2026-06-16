import { prisma } from "@/lib/prisma";

type Finding = { type: string; severity: "YELLOW" | "RED"; message: string; entityId?: string; metadata?: Record<string, unknown> };

export async function runDataQualityChecks() {
  const [invalidOdds, snapshots, finishedWithoutScore, pendingOnFinished, matches] = await Promise.all([
    prisma.oddsSnapshot.findMany({ where: { odd: { lte: 1 } }, take: 100 }),
    prisma.oddsSnapshot.findMany({ orderBy: { capturedAt: "asc" } }),
    prisma.match.findMany({ where: { status: "FINISHED", OR: [{ homeScore: null }, { awayScore: null }] }, take: 100 }),
    prisma.tip.findMany({ where: { status: "PENDING", match: { status: "FINISHED" } }, take: 100 }),
    prisma.match.findMany({ include: { oddsSnapshots: true }, take: 500 }),
  ]);
  const findings: Finding[] = invalidOdds.map((odd) => ({ type: "INVALID_ODD", severity: "RED", message: `Odd inválida: ${odd.odd}`, entityId: odd.id }));
  const duplicates = new Map<string, number>();
  for (const item of snapshots) {
    const key = `${item.matchId}:${item.market}:${item.selection}:${item.provider}:${item.capturedAt.toISOString()}:${item.odd}`;
    duplicates.set(key, (duplicates.get(key) ?? 0) + 1);
  }
  for (const [key, count] of duplicates) if (count > 1) findings.push({ type: "DUPLICATE_ODDS", severity: "YELLOW", message: `${count} snapshots idênticos detectados.`, metadata: { key, count } });
  for (const match of finishedWithoutScore) findings.push({ type: "INCONSISTENT_RESULT", severity: "RED", message: "Partida finalizada sem placar completo.", entityId: match.id });
  for (const tip of pendingOnFinished) findings.push({ type: "UNSETTLED_TIP", severity: "RED", message: "Tip pendente em partida finalizada.", entityId: tip.id });
  for (const match of matches.filter((item) => item.status !== "FINISHED" && item.oddsSnapshots.length < 3)) findings.push({ type: "INCOMPLETE_MARKET", severity: "YELLOW", message: `Mercado incompleto com ${match.oddsSnapshots.length} odds.`, entityId: match.id });

  await prisma.dataQualityAlert.updateMany({ where: { status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  if (findings.length) await prisma.dataQualityAlert.createMany({ data: findings.map((item) => ({ type: item.type, severity: item.severity, message: item.message, entityId: item.entityId, metadata: item.metadata ? JSON.stringify(item.metadata) : undefined })) });
  return { checkedAt: new Date().toISOString(), total: findings.length, red: findings.filter((item) => item.severity === "RED").length, yellow: findings.filter((item) => item.severity === "YELLOW").length, findings };
}
