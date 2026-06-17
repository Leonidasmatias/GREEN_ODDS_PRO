import { CommandCenterDashboard } from "@/components/CommandCenterDashboard";
import { getCommandCenter } from "@/services/operationalService";
import { redactSecrets } from "@/services/securityService";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  try {
    return <CommandCenterDashboard initialData={await getCommandCenter()}/>;
  } catch (error) {
    return <CommandCenterDashboard initialData={{ error: redactSecrets(error instanceof Error ? error.message : "Falha ao carregar Command Center"), summary: { gamesToday: 0, oddsToday: 0, generatedToday: 0, settledToday: 0, greens: 0, reds: 0, roi: 0, winRate: 0, lastSync: null, syncStatus: "PENDING_RESULTS" }, opportunities: [], movements: [], alerts: [], performance: { periods: [], rankings: [] }, operational: { providerStatus: "PENDING_RESULTS", provider: "NO_ACTIVE_PROVIDER", jobsExecuted: 0, latestJobName: "NO_JOB_RUN", latestJobStatus: "NOT_RUN", lastSynchronization: null, gamesMonitored: 0, oddsPersisted: 0, resultsSynced: 0, resultSyncStatus: "NOT_RUN", settlementsDone: 0, settlementStatus: "NOT_RUN", settlementRate: 0 }, refreshedAt: new Date().toISOString() }}/>;
  }
}
