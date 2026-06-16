import { Activity, BarChart3, BrainCircuit, Database, ShieldCheck, Target } from "lucide-react";
import { ValueAuditSummary } from "@/components/ValueOpportunityTable";
import { CreatorSignature } from "@/components/CreatorSignature";
import { getModelPerformance } from "@/services/modelTrainingService";
import { buildValueReport } from "@/services/valueEngine";
import { generateSettlementReport } from "@/services/settlementEngine";
import { generateModelReport } from "@/services/mlEngine";
import { getAutoDiscoveryReport } from "@/services/autoDiscoveryEngine";
import { getBankrollReport } from "@/services/bankrollEngine";
import { getRiskShieldReport } from "@/services/riskShieldEngine";
import { getPerformanceAttributionReport } from "@/services/performanceAttributionEngine";
import { formatDateTimeBrt } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const metric = (value: number | null | undefined) => value == null ? "—" : `${value.toFixed(2)}%`;

export default async function ModelPerformancePage() {
  const [data, valueReport, settlement, ml, discovery, bankroll, riskShield, attribution] = await Promise.all([getModelPerformance(), buildValueReport(), generateSettlementReport(), generateModelReport(), getAutoDiscoveryReport(), getBankrollReport(), getRiskShieldReport(), getPerformanceAttributionReport()]);
  const current = data.current;
  const cards = [
    ["Dataset size", data.status.records.toString(), Database], ["Accuracy", metric(current?.accuracy), Target], ["Precision", metric(current?.precision), ShieldCheck], ["Recall", metric(current?.recall), Activity], ["ROI", metric(current?.roi), BarChart3], ["Yield", metric(current?.yield), BarChart3], ["Win Rate", metric(current?.winRate), BrainCircuit],
  ] as const;
  const maxRecords = Math.max(1, ...data.learningCurve.map((item) => item.recordsUsed));
  return <>
    <div className="mb-7"><p className="label mb-2 text-neon">Validação temporal</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">Model Performance</h1><p className="mt-2 max-w-3xl text-sm text-zinc-500">Métricas calculadas somente no conjunto de teste futuro, preservando a divisão cronológica 70% treino, 15% validação e 15% teste.</p></div>
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {[["ML status", ml.status], ["TotalSamples", `${ml.totalSamples}/${ml.minimumSamples}`], ["Ultima execucao", ml.lastRunAt ? formatDateTimeBrt(ml.lastRunAt) : "INSUFFICIENT_REAL_DATA"], ["Accuracy", ml.accuracy == null ? "INSUFFICIENT_REAL_DATA" : `${ml.accuracy.toFixed(2)}%`], ["WinRate backtest", ml.winRateBacktest == null ? "INSUFFICIENT_REAL_DATA" : `${ml.winRateBacktest.toFixed(2)}%`], ["ROI backtest", ml.roiBacktest == null ? "INSUFFICIENT_REAL_DATA" : `${ml.roiBacktest.toFixed(2)}%`]].map(([label, value]) => <div className="card p-4" key={label}><p className="label">{label}</p><strong className="mt-3 block break-words text-lg text-white">{value}</strong></div>)}
    </section>
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[["Discovery", discovery.status], ["Tips analisadas", `${discovery.totalTipsAnalyzed}/${discovery.minimumSample}`], ["Padroes", discovery.patternsFound.toString()], ["Recomendacoes", discovery.recommendationsGenerated.toString()], ["Bloqueio", discovery.blockReason ?? "OK"]].map(([label, value]) => <div className="card p-4" key={label}><p className="label">{label}</p><strong className="mt-3 block text-lg text-white">{value}</strong></div>)}
    </section>
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[["Bankroll", bankroll.status], ["Perfil", bankroll.riskProfile ?? "BANKROLL_NOT_CONFIGURED"], ["Risco diario", `${bankroll.dailyRiskUsedPercent.toFixed(2)}%`], ["Exposicao", `${bankroll.openExposurePercent.toFixed(2)}%`], ["Bloqueadas", bankroll.blockedRecommendations.toString()]].map(([label, value]) => <div className="card p-4" key={label}><p className="label">{label}</p><strong className="mt-3 block text-lg text-white">{value}</strong></div>)}
    </section>
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[["Risk Shield", riskShield.status], ["Riscos detectados", riskShield.risksDetected.toString()], ["Tips bloqueadas", riskShield.tipsBlocked.toString()], ["Stakes reduzidas", riskShield.stakesReduced.toString()], ["Alertas correlacao", riskShield.correlationAlerts.toString()]].map(([label, value]) => <div className="card p-4" key={label}><p className="label">{label}</p><strong className="mt-3 block text-lg text-white">{value}</strong></div>)}
    </section>
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[["Attribution", attribution.status], ["Tips atribuidas", `${attribution.totalTipsAnalyzed}/${attribution.minimumSample}`], ["Segmentos", attribution.segmentsAnalyzed.toString()], ["Insights", attribution.insightsGenerated.toString()], ["Calibracao EV", attribution.calibrationAlerts.length.toString()]].map(([label, value]) => <div className="card p-4" key={label}><p className="label">{label}</p><strong className="mt-3 block text-lg text-white">{value}</strong></div>)}
    </section>
    <section className="card mb-6 overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Attribution por segmento</p><p className="mt-1 text-[10px] text-zinc-600">Somente TipResult WON/LOST/VOID, sem performance pendente</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Segmento</th><th>Status</th><th>Amostra</th><th>ROI</th><th>Profit</th><th>Drawdown</th><th>EV realizado</th></tr></thead><tbody>{[...attribution.topPositiveSegments, ...attribution.negativeSegments, ...attribution.drawdownAlerts, ...attribution.calibrationAlerts].slice(0, 12).map((item) => <tr key={`${item.segmentType}-${item.segmentKey}`} className="border-b border-line/60"><td className="px-5 py-4 font-black">{item.segmentKey}<span className="block text-[10px] text-zinc-600">{item.segmentType}</span></td><td>{item.status}</td><td>{item.totalTips}</td><td className={item.roi >= 0 ? "text-neon" : "text-red-400"}>{item.roi.toFixed(2)}%</td><td>{item.profit.toFixed(2)}u</td><td>{item.drawdown.toFixed(2)}u</td><td>{(item.evRealizado * 100).toFixed(2)}%</td></tr>)}</tbody></table></div></section>
    {ml.status === "INSUFFICIENT_REAL_DATA" && <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-5"><b className="text-amber-300">ML baseline bloqueado</b><p className="mt-2 text-xs text-zinc-400">{ml.blockReason ?? "Aguardando amostra minima real liquidada."} Nenhum modelo e treinado com historico fake.</p></div>}
    {!data.status.eligible && <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-5"><b className="text-amber-300">Dados insuficientes para treinamento</b><p className="mt-2 text-xs text-zinc-400">{data.status.records} de {data.status.minimum} tips liquidadas WON/LOST. Nenhuma métrica de modelo foi estimada.</p></div>}
    <section className="mb-6"><ValueAuditSummary {...valueReport.audit}/></section>
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[["Pendentes", settlement.pending], ["Liquidadas", settlement.settled], ["WinRate real", `${(settlement.winRate * 100).toFixed(1)}%`], ["ROI real", `${settlement.roi.toFixed(2)}%`], ["Lucro real", `${settlement.profit.toFixed(2)}u`]].map(([label, value]) => <div className="card p-4" key={label}><p className="label">{label}</p><strong className="mt-3 block text-lg text-white">{value}</strong></div>)}
    </section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">{cards.map(([label,value,Icon]) => <div className="card p-5" key={label}><Icon size={16} className="text-neon"/><p className="label mt-4">{label}</p><strong className="mt-2 block text-2xl">{value}</strong></div>)}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[.65fr_1.35fr]"><section className="card p-5"><p className="text-sm font-black uppercase tracking-wider">Status do aprendizado</p><div className="mt-5 space-y-4 text-xs"><p className="text-zinc-500">Confiança por volume <b className="float-right text-white">{data.status.confidence.level}</b></p><p className="text-zinc-500">Próximo treinamento <b className="float-right text-white">{data.status.nextTrainingAt} registros</b></p><p className="text-zinc-500">Novos desde a versão <b className="float-right text-white">{data.status.newRecordsSinceTraining}</b></p><p className="text-zinc-500">Versão atual <b className="float-right text-white">{current?.version ?? "Não treinado"}</b></p></div></section><section className="card p-5"><p className="text-sm font-black uppercase tracking-wider">Learning Curve</p><p className="mt-1 text-[10px] text-zinc-600">Evolução real das versões treinadas</p><div className="mt-6 space-y-5">{data.learningCurve.length ? data.learningCurve.map((item) => <div key={item.version}><div className="mb-2 flex justify-between text-xs"><b>{item.version}</b><span className="text-zinc-500">{item.recordsUsed} registros · {item.accuracy.toFixed(1)}% accuracy</span></div><div className="h-3 rounded-full bg-zinc-900"><div className="h-full rounded-full bg-gradient-to-r from-emerald-900 to-neon" style={{ width: `${Math.max(4, item.recordsUsed / maxRecords * 100)}%` }}/></div></div>) : <p className="py-10 text-center text-xs text-zinc-600">A curva será exibida após o primeiro treinamento com 100 resultados reais.</p>}</div></section></div>
    <div className="mt-6 rounded-xl border border-line bg-white/[.02] p-4 text-[11px] leading-relaxed text-zinc-500">Métricas históricas não prometem lucro nem garantem green. O modelo produz estimativas probabilísticas e depende da qualidade e quantidade dos dados reais.</div>
    <div className="mt-6"><CreatorSignature compact/></div>
  </>;
}
