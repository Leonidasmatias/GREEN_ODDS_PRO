import { prisma } from "@/lib/prisma";
import { getProviderResults } from "./providerManager";

export async function importProviderResults() {
  const response = await getProviderResults();
  let updated = 0;
  for (const result of response.data) {
    const match = await prisma.match.updateMany({ where: { providerId: result.providerId }, data: { status: result.status, homeScore: result.homeScore, awayScore: result.awayScore } });
    updated += match.count;
  }
  return { provider: response.provider.id, received: response.data.length, updated, remainingLimit: response.remainingLimit, failoverErrors: response.failoverErrors };
}
