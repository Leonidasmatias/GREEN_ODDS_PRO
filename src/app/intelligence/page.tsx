import { requireRouteAccess } from "@/services/authService";
import { getIntelligenceDashboardData } from "@/services/intelligenceDashboardService";
import { buildIntelligenceDashboardViewModel } from "@/adapters/observabilityDashboardAdapter";
import { IntelligenceHeader } from "@/components/intelligence/IntelligenceHeader";
import { IntelligenceSummaryCards } from "@/components/intelligence/IntelligenceSummaryCards";
import { StrategyStatusCard } from "@/components/intelligence/StrategyStatusCard";
import { DistributionPanel } from "@/components/intelligence/DistributionPanel";
import { ProfileMonitoringTable } from "@/components/intelligence/ProfileMonitoringTable";
import { TechnicalAlertsPanel } from "@/components/intelligence/TechnicalAlertsPanel";
import { TrendOverview } from "@/components/intelligence/TrendOverview";
import { IntelligenceTimeline } from "@/components/intelligence/IntelligenceTimeline";
import { IntelligenceEmptyState } from "@/components/intelligence/IntelligenceEmptyState";
import { IntelligenceErrorState } from "@/components/intelligence/IntelligenceErrorState";

export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  await requireRouteAccess("/intelligence");

  const result = await getIntelligenceDashboardData();

  if (result.status === "error") {
    return <IntelligenceErrorState message={result.message} />;
  }

  if (result.status === "empty") {
    return <IntelligenceEmptyState />;
  }

  const dashboard = buildIntelligenceDashboardViewModel(result.report);

  return (
    <div className="space-y-6">
      <IntelligenceHeader header={dashboard.header} strategy={dashboard.strategy} source={result.source} />
      <IntelligenceSummaryCards cards={dashboard.summaryCards} />
      <StrategyStatusCard strategy={dashboard.strategy} />
      <div className="grid gap-6 xl:grid-cols-2">
        <DistributionPanel
          title="Distribuição de drift"
          description="Sinais de drift detectados na comparação de janelas, por tipo"
          entries={dashboard.driftDistribution}
          emptyMessage="Nenhum sinal de drift nesta execução."
        />
        <DistributionPanel
          title="Distribuição de recomendações"
          description="Recomendações técnicas atuais, por tipo"
          entries={dashboard.recommendationDistribution}
          emptyMessage="Nenhuma recomendação disponível nesta execução."
        />
      </div>
      <ProfileMonitoringTable rows={dashboard.profiles} />
      <div className="grid gap-6 xl:grid-cols-2">
        <TechnicalAlertsPanel alerts={dashboard.alerts} />
        <TrendOverview trends={dashboard.trends} />
      </div>
      <IntelligenceTimeline events={dashboard.timeline} />
    </div>
  );
}
