import { Activity, BarChart3, ShieldCheck, TrendingUp } from "lucide-react";
import { getExecutiveCommandCenter } from "@/services/executiveCommandCenter";
import { requireRouteAccess } from "@/services/authService";

export const dynamic = "force-dynamic";

export default async function PerformanceCenterPage() {
  await requireRouteAccess("/performance-center");
  const report = await getExecutiveCommandCenter();
  const center = report.executive.performance;
  const periods = report.performance.periods;
  const rankings = report.performance.rankings.filter((item) => item.entries > 0);

  return <>
    <div className="mb-7"><p className="label mb-2 text-neon">Performance Center</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">Performance executiva real</h1><p className="mt-2 max-w-3xl text-sm text-zinc-500">ROI, win rate e ranking calculados apenas por tips WON/LOST reais. Sem mock, sem historico sintetico.</p></div>
    <section className="grid gap-4 sm:grid-cols-3">
      {center.kpis.map((item) => <div key={item.key} className="card p-5"><div className="flex items-center justify-between"><p className="label">{item.label}</p>{item.key === "roi_90d" ? <TrendingUp size={16} className="text-neon"/> : item.key === "markets_ranked" ? <BarChart3 size={16} className="text-gold"/> : <ShieldCheck size={16} className="text-neon"/>}</div><strong className="mt-4 block text-3xl text-white">{item.value}</strong><p className="mt-1 text-[10px] text-zinc-600">{item.source} · {item.audit}</p></div>)}
    </section>
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Periodos</p><p className="mt-1 text-[10px] text-zinc-600">Sem dados suficientes, retorna INSUFFICIENT_REAL_DATA.</p></div>
      <div className="grid gap-3 p-5 md:grid-cols-3">{periods.length ? periods.map((period) => <div key={period.label} className="rounded-xl border border-line p-4 text-xs"><b>{period.label}</b><p className="mt-3 text-zinc-500">ROI <span className="float-right text-white">{period.roi.toFixed(2)}%</span></p><p className="mt-2 text-zinc-500">Win Rate <span className="float-right text-white">{period.winRate.toFixed(1)}%</span></p><p className="mt-2 text-zinc-500">Greens/Reds <span className="float-right text-white">{period.greens}/{period.reds}</span></p></div>) : <p className="text-xs text-zinc-600">INSUFFICIENT_REAL_DATA</p>}</div>
    </section>
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Ranking real de mercados</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Mercado</th><th>ROI</th><th>Win Rate</th><th>Lucro</th><th>Entradas</th></tr></thead><tbody>{rankings.length ? rankings.map((item) => <tr key={item.market} className="border-b border-line/60"><td className="px-5 py-4 font-black">{item.market}</td><td className={item.roi >= 0 ? "text-neon" : "text-red-400"}>{item.roi.toFixed(2)}%</td><td>{item.winRate.toFixed(1)}%</td><td>{item.profit.toFixed(2)}u</td><td>{item.entries}</td></tr>) : <tr><td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-600">INSUFFICIENT_REAL_DATA</td></tr>}</tbody></table></div>
    </section>
    <div className="mt-6 rounded-xl border border-line bg-white/[.02] p-4 text-[11px] text-zinc-500"><Activity size={14} className="mr-2 inline text-neon"/>Relatorio estatistico auditavel. Performance passada nao garante resultados futuros.</div>
  </>;
}
