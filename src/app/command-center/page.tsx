import { CommandCenterDashboard } from "@/components/CommandCenterDashboard";
import { requireRouteAccess } from "@/services/authService";

export const dynamic = "force-dynamic";

const fallback = {
  summary: { gamesToday: 0, oddsToday: 0, generatedToday: 0, settledToday: 0, greens: 0, reds: 0, roi: 0, winRate: 0, lastSync: null, syncStatus: "INSUFFICIENT_REAL_DATA" },
  opportunities: [],
  movements: [],
  alerts: [],
  performance: { periods: [], rankings: [] },
  operational: { providerStatus: "PENDING_RESULTS", provider: "NO_ACTIVE_PROVIDER", jobsExecuted: 0, latestJobName: "NO_JOB_RUN", latestJobStatus: "NOT_RUN", lastSynchronization: null, gamesMonitored: 0, oddsPersisted: 0, resultsSynced: 0, resultSyncStatus: "NOT_RUN", settlementsDone: 0, settlementStatus: "NOT_RUN", settlementRate: 0 },
  refreshedAt: new Date().toISOString(),
};

export default async function CommandCenterPage() {
  await requireRouteAccess("/command-center");
  return <>
    <div className="mb-7"><p className="label mb-2 text-neon">Command Center Executivo</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">Visao executiva auditavel</h1><p className="mt-2 max-w-3xl text-sm text-zinc-500">Carregamento lazy: dados executivos sao buscados pela API apos o fallback inicial.</p></div>
    <CommandCenterDashboard initialData={fallback}/>
  </>;
}
