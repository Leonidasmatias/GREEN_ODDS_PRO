import { Filter, SlidersHorizontal } from "lucide-react";
import { PageTitle, StatCard } from "@/components/ui";
import { ValueOpportunityTable } from "@/components/ValueOpportunityTable";
import { getWorldCupOdds } from "@/services/oddsApi";
import { buildValueReport } from "@/services/valueEngine";
import { getSmartConfidenceReport } from "@/services/smartConfidenceEngine";
import { generateModelReport } from "@/services/mlEngine";
import { getAutoDiscoveryReport } from "@/services/autoDiscoveryEngine";
import { getBankrollReport } from "@/services/bankrollEngine";
import { getRiskShieldReport } from "@/services/riskShieldEngine";
import { getPerformanceAttributionReport } from "@/services/performanceAttributionEngine";
import { getAdaptiveStrategyReport } from "@/services/adaptiveStrategyEngine";

export const dynamic = "force-dynamic";

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

export default async function OddsTodayPage() {
  const [feed, valueReport, confidence, ml, discovery, bankroll, riskShield, attribution, adaptive] = await Promise.all([getWorldCupOdds(), buildValueReport(), getSmartConfidenceReport(), generateModelReport(), getAutoDiscoveryReport(), getBankrollReport(), getRiskShieldReport(), getPerformanceAttributionReport(), getAdaptiveStrategyReport()]);
  const preGameValues = [...valueReport.entries, ...valueReport.watchlist].filter((item) => item.matchStatus === "PRE_GAME");
  return <>
    <PageTitle eyebrow="Pre-jogo" title="Odds do dia" description="Partidas do provider ativo e analise estatistica baseada somente em odds reais persistidas." action={<button className="flex items-center gap-2 rounded-xl border border-line bg-white/[.03] px-5 py-3 text-xs font-bold"><SlidersHorizontal size={15}/> Ajustar filtros</button>}/>
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Jogos carregados" value={feed.games.length.toString()} detail={feed.provider}/>
      <StatCard label="Odds analisadas" value={valueReport.audit.analyzed.toString()} detail="value engine" tone="white"/>
      <StatCard label="Ultima analise" value={formatDate(valueReport.updatedAt)} detail="dados persistidos" tone="yellow"/>
    </div>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <StatCard label="Smart Confidence" value={confidence.status} detail={`${confidence.sourceRows}/${confidence.minimumSample} liquidacoes reais`} tone="white"/>
      <StatCard label="MarketConfidence" value={(confidence.topMarkets[0]?.confidenceScore ?? 0).toFixed(0)} detail={confidence.topMarkets[0]?.market ?? "INSUFFICIENT_REAL_DATA"}/>
      <StatCard label="BookmakerConfidence" value={(confidence.topBookmakers[0]?.confidenceScore ?? 0).toFixed(0)} detail={confidence.topBookmakers[0]?.bookmaker ?? "INSUFFICIENT_REAL_DATA"} tone="yellow"/>
      <StatCard label="OddRangeConfidence" value={(confidence.topOddRanges[0]?.confidenceScore ?? 0).toFixed(0)} detail={confidence.topOddRanges[0]?.oddRange ?? "INSUFFICIENT_REAL_DATA"} tone="white"/>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-5">
      <StatCard label="ML status" value={ml.status} detail={ml.blockReason ?? "baseline real"}/>
      <StatCard label="Samples ML" value={`${ml.totalSamples}/${ml.minimumSamples}`} detail="WON/LOST/VOID reais" tone="white"/>
      <StatCard label="Accuracy ML" value={ml.accuracy == null ? "INSUFFICIENT_REAL_DATA" : `${ml.accuracy.toFixed(2)}%`} detail={ml.modelVersion ?? "sem modelo"} tone="yellow"/>
      <StatCard label="ROI backtest" value={ml.roiBacktest == null ? "INSUFFICIENT_REAL_DATA" : `${ml.roiBacktest.toFixed(2)}%`} detail="sem promessa de lucro"/>
      <StatCard label="Predicoes ML" value={ml.predictionsGenerated.toString()} detail="persistidas"/>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <StatCard label="Discovery" value={discovery.status} detail={`${discovery.totalTipsAnalyzed}/${discovery.minimumSample} liquidadas reais`}/>
      <StatCard label="Padroes" value={discovery.patternsFound.toString()} detail="somente liquidados" tone="white"/>
      <StatCard label="Negativos" value={discovery.negativePatterns.length.toString()} detail="bloqueios operacionais" tone="yellow"/>
      <StatCard label="Recomendacoes" value={discovery.recommendationsGenerated.toString()} detail="sem promessa de lucro"/>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <StatCard label="Bankroll" value={bankroll.status} detail={bankroll.reason ?? bankroll.profileName ?? "gestao de banca"}/>
      <StatCard label="Banca atual" value={bankroll.currentBankroll == null ? "BANKROLL_NOT_CONFIGURED" : bankroll.currentBankroll.toFixed(2)} detail={bankroll.currency ?? "sem perfil"} tone="white"/>
      <StatCard label="Risco diario" value={`${bankroll.dailyRiskUsedPercent.toFixed(2)}%`} detail="limite configurado"/>
      <StatCard label="Exposicao aberta" value={`${bankroll.openExposurePercent.toFixed(2)}%`} detail="tips pendentes" tone="yellow"/>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <StatCard label="Risk Shield" value={riskShield.status} detail={riskShield.reason ?? "controle de exposicao"}/>
      <StatCard label="Bloqueios" value={riskShield.tipsBlocked.toString()} detail="entradas barradas" tone="yellow"/>
      <StatCard label="Stakes reduzidas" value={riskShield.stakesReduced.toString()} detail="controle automatico"/>
      <StatCard label="Correlacao" value={riskShield.correlationAlerts.toString()} detail="alertas ativos" tone="white"/>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <StatCard label="Attribution" value={attribution.status} detail={`${attribution.totalTipsAnalyzed}/${attribution.minimumSample} TipResult reais`}/>
      <StatCard label="Segmentos" value={attribution.segmentsAnalyzed.toString()} detail="performance explicada" tone="white"/>
      <StatCard label="Drawdown alerts" value={attribution.drawdownAlerts.length.toString()} detail="risco realizado" tone="yellow"/>
      <StatCard label="Calibracao EV" value={attribution.calibrationAlerts.length.toString()} detail="EV estimado vs realizado"/>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <StatCard label="Adaptive Strategy" value={adaptive.status} detail={`${adaptive.totalTipsAnalyzed}/${adaptive.minimumSample} TipResult reais`}/>
      <StatCard label="Ajustes gerados" value={adaptive.adjustmentsGenerated.toString()} detail="baseado em performance" tone="white"/>
      <StatCard label="Ajustes aplicados" value={adaptive.adjustmentsApplied.toString()} detail="regras restritivas"/>
      <StatCard label="Segmentos bloqueados" value={adaptive.blockedSegments.toString()} detail="sem all-in, sem override" tone="yellow"/>
    </section>
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Confidence por historico real</p><p className="mt-1 text-[10px] text-zinc-600">Win rate, ROI, drawdown e sampleSize liberados somente com 30 liquidacoes reais</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Dimensao</th><th>Amostra</th><th>Win Rate</th><th>ROI</th><th>Drawdown</th><th>Score</th><th>Status</th></tr></thead><tbody>{confidence.topMarkets.length ? confidence.topMarkets.map((item) => <tr key={item.id} className="border-b border-line/60"><td className="px-5 py-4 font-black">{item.market}<span className="block text-[10px] text-zinc-600">{item.provider} · {item.bookmaker}</span></td><td>{item.sampleSize}</td><td>{(item.winRate * 100).toFixed(1)}%</td><td className={item.roi >= 0 ? "text-neon" : "text-red-400"}>{item.roi.toFixed(2)}%</td><td>{item.drawdown.toFixed(2)}u</td><td>{item.confidenceScore.toFixed(0)}/100</td><td>{item.status}</td></tr>) : <tr><td colSpan={7} className="px-5 py-10 text-center text-zinc-600">INSUFFICIENT_REAL_DATA</td></tr>}</tbody></table></div>
    </section>
    <section className="card mt-6 overflow-hidden p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider">Mercados pre-jogo avaliados</p>
          <p className="mt-1 text-[11px] text-zinc-600">{valueReport.provider} · {preGameValues.length} mercados com status de acompanhamento</p>
        </div>
        <Filter size={17} className="text-zinc-600"/>
      </div>
      <ValueOpportunityTable items={preGameValues}/>
    </section>
  </>;
}
