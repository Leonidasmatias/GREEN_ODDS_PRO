import { prisma } from "@/lib/prisma";
import { importProviderResults } from "@/providers/resultProvider";
import { settlePendingTips } from "./settlementService";

export async function importResultsAndSettle() {
  const feed = await importProviderResults();
  const matchesUpdated = feed.updated;
  const settlement = await settlePendingTips();
  await prisma.auditLog.create({ data: { category: "RESULT_IMPORT", status: "SUCCESS", message: `${feed.received} resultados recebidos de ${feed.provider}, ${matchesUpdated} partidas atualizadas e ${settlement.processed} tips liquidadas.`, metadata: JSON.stringify({ ...feed, settlement }) } });
  return { scoresReceived: feed.received, matchesUpdated, settlement, provider: feed.provider, warning: feed.failoverErrors.join(" | ") || undefined };
}
