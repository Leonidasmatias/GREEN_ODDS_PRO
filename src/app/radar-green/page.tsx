import { Crosshair, Info } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { ValueAuditSummary, ValueOpportunityTable } from "@/components/ValueOpportunityTable";
import { buildValueReport } from "@/services/valueEngine";
import { generateModelReport } from "@/services/mlEngine";
import { getAutoDiscoveryReport } from "@/services/autoDiscoveryEngine";
import { getBankrollReport } from "@/services/bankrollEngine";
import { getRiskShieldReport } from "@/services/riskShieldEngine";
import { getPerformanceAttributionReport } from "@/services/performanceAttributionEngine";
import { getAdaptiveStrategyReport } from "@/services/adaptiveStrategyEngine";
import { getResultCollectorReport } from "@/services/resultCollectorEngine";

export const dynamic = "force-dynamic";

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

export default async function RadarPage() {
  const [report, ml, discovery, bankroll, riskShield, attribution, adaptive, resultCollector] = await Promise.all([buildValueReport(), generateModelReport(), getAutoDiscoveryReport(), getBankrollReport(), getRiskShieldReport(), getPerformanceAttributionReport(), getAdaptiveStrategyReport(), getResultCollectorReport()]);
  const validatedGreens = report.entries.filter((item) => (
    item.classification === "GREEN FORTE" ||
    item.classification === "ELITE GREEN" ||
    item.classification === "DIAMANTE"
  ) && item.smartConfidenceStatus === "READY" && (item.smartConfidenceScore ?? 0) >= 80 && item.historicalSample >= 30 && item.marketSample >= 30);
  return <>
    <PageTitle eyebrow="Provider ativo" title="Radar de Odds Green" description="Mercados construidos exclusivamente a partir de odds reais persistidas do provider licenciado ativo."/>
    <ValueAuditSummary {...report.audit}/>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <div className="card p-4"><p className="label">ML status</p><strong className="mt-3 block text-lg text-white">{ml.status}</strong></div>
      <div className="card p-4"><p className="label">Samples</p><strong className="mt-3 block text-lg text-white">{ml.totalSamples}/{ml.minimumSamples}</strong></div>
      <div className="card p-4"><p className="label">WinRate backtest</p><strong className="mt-3 block text-lg text-white">{ml.winRateBacktest == null ? "INSUFFICIENT_REAL_DATA" : `${ml.winRateBacktest.toFixed(2)}%`}</strong></div>
      <div className="card p-4"><p className="label">Predicoes ML</p><strong className="mt-3 block text-lg text-white">{ml.predictionsGenerated}</strong></div>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <div className="card p-4"><p className="label">Bankroll</p><strong className="mt-3 block text-lg text-white">{bankroll.status}</strong></div>
      <div className="card p-4"><p className="label">Banca atual</p><strong className="mt-3 block text-lg text-white">{bankroll.currentBankroll == null ? "BANKROLL_NOT_CONFIGURED" : bankroll.currentBankroll.toFixed(2)}</strong></div>
      <div className="card p-4"><p className="label">Risco diario</p><strong className="mt-3 block text-lg text-white">{bankroll.dailyRiskUsedPercent.toFixed(2)}%</strong></div>
      <div className="card p-4"><p className="label">Exposicao</p><strong className="mt-3 block text-lg text-white">{bankroll.openExposurePercent.toFixed(2)}%</strong></div>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <div className="card p-4"><p className="label">Risk Shield</p><strong className="mt-3 block text-lg text-white">{riskShield.status}</strong></div>
      <div className="card p-4"><p className="label">Bloqueadas</p><strong className="mt-3 block text-lg text-white">{riskShield.tipsBlocked}</strong></div>
      <div className="card p-4"><p className="label">Reduzidas</p><strong className="mt-3 block text-lg text-white">{riskShield.stakesReduced}</strong></div>
      <div className="card p-4"><p className="label">Correlacao</p><strong className="mt-3 block text-lg text-white">{riskShield.correlationAlerts}</strong></div>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <div className="card p-4"><p className="label">Attribution</p><strong className="mt-3 block text-lg text-white">{attribution.status}</strong></div>
      <div className="card p-4"><p className="label">Amostra</p><strong className="mt-3 block text-lg text-white">{attribution.totalTipsAnalyzed}/{attribution.minimumSample}</strong></div>
      <div className="card p-4"><p className="label">Segmentos negativos</p><strong className="mt-3 block text-lg text-white">{attribution.negativeSegments.length}</strong></div>
      <div className="card p-4"><p className="label">Alertas EV/DD</p><strong className="mt-3 block text-lg text-white">{attribution.calibrationAlerts.length + attribution.drawdownAlerts.length}</strong></div>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <div className="card p-4"><p className="label">Adaptive Strategy</p><strong className="mt-3 block text-lg text-white">{adaptive.status}</strong></div>
      <div className="card p-4"><p className="label">Ajustes</p><strong className="mt-3 block text-lg text-white">{adaptive.adjustmentsGenerated}</strong></div>
      <div className="card p-4"><p className="label">Aplicados</p><strong className="mt-3 block text-lg text-white">{adaptive.adjustmentsApplied}</strong></div>
      <div className="card p-4"><p className="label">Bloqueios</p><strong className="mt-3 block text-lg text-white">{adaptive.blockedSegments}</strong></div>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <div className="card p-4"><p className="label">RESULT_SYNC</p><strong className="mt-3 block text-lg text-white">{resultCollector.status}</strong></div>
      <div className="card p-4"><p className="label">Resultados reais</p><strong className="mt-3 block text-lg text-white">{resultCollector.resultsPersisted}</strong></div>
      <div className="card p-4"><p className="label">Liquidadas auto</p><strong className="mt-3 block text-lg text-white">{resultCollector.tipsSettled}</strong></div>
      <div className="card p-4"><p className="label">W/L/V</p><strong className="mt-3 block text-lg text-white">{resultCollector.won}/{resultCollector.lost}/{resultCollector.voids}</strong></div>
    </section>
    <section className="card mt-6 p-5">
      <p className="text-sm font-black uppercase tracking-wider">Auto Discovery</p>
      <p className="mt-1 text-[10px] text-zinc-600">{discovery.status} · {discovery.patternsFound} padroes · {discovery.recommendationsGenerated} recomendacoes</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{discovery.negativePatterns.slice(0, 4).map((item) => <div key={`${item.patternType}-${item.market ?? item.competition ?? item.bookmaker ?? item.oddRange}`} className="rounded-xl border border-red-400/15 bg-red-400/[.04] p-3 text-xs"><b>{item.market ?? item.competition ?? item.bookmaker ?? item.oddRange}</b><span className="float-right text-red-400">{item.roi.toFixed(2)}%</span><p className="mt-1 text-[10px] text-zinc-600">Bloqueia reforco de ELITE GREEN quando o padrao e negativo.</p></div>)}</div>
    </section>
    <section className="card mt-6 overflow-hidden p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-neon/10 text-neon"><Crosshair size={19}/></div>
          <div>
            <b className="text-sm">{report.provider}</b>
            <p className="text-[10px] text-zinc-600">{report.gamesLoaded} jogos persistidos · {report.audit.analyzed} odds · {formatDate(report.updatedAt)}</p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-[10px] font-bold text-neon"><span className="h-2 w-2 animate-pulse rounded-full bg-neon"/> VALUE ENGINE V1</span>
      </div>
      <ValueOpportunityTable items={validatedGreens}/>
    </section>
    <div className="mt-4 flex gap-3 rounded-xl border border-line bg-white/[.02] p-4 text-xs leading-relaxed text-zinc-500">
      <Info size={17} className="shrink-0 text-neon"/> O Radar exibe somente GREEN FORTE, ELITE GREEN e DIAMANTE com confidence real suficiente. Sem 30 liquidacoes reais, o mercado permanece INSUFFICIENT_REAL_DATA e nenhuma entrada green e forcada.
    </div>
  </>;
}
