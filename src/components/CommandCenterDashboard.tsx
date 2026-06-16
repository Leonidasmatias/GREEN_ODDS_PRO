"use client";

import { useEffect, useState } from "react";
import { Activity, BellRing, Clock3, Crosshair, Database, Percent, RefreshCw, ShieldAlert, Target, TrendingUp } from "lucide-react";

type CommandData = {
  summary: { gamesToday: number; oddsToday: number; generatedToday: number; settledToday: number; greens: number; reds: number; roi: number; winRate: number; lastSync: string | null; syncStatus: string };
  opportunities: Array<{ id: string; game: string; market: string; selection: string; odd: number; ev: number; score: number; powerRating: number; risk: string; status: string }>;
  movements: Array<{ id: string; game: string; market: string; selection: string; openingOdd: number; currentOdd: number; variation: number; type: string; timestamp: string }>;
  alerts: Array<{ id: string; level: string; title: string; detail: string; reason: string; timestamp: string }>;
  performance: { periods: Array<{ label: string; roi: number; yield: number; winRate: number; greens: number; reds: number }>; rankings: Array<{ market: string; roi: number; winRate: number; profit: number; entries: number }> };
  refreshedAt: string;
};

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value)) : "Ainda não executada";
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

export function CommandCenterDashboard({ initialData }: { initialData: CommandData }) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/command-center", { cache: "no-store" });
      if (response.ok) setData(await response.json() as CommandData);
    } finally { setRefreshing(false); }
  }

  useEffect(() => { const timer = window.setInterval(refresh, 30_000); return () => window.clearInterval(timer); }, []);

  const cards = [
    ["Jogos monitorados hoje", data.summary.gamesToday, Crosshair, "text-white"], ["Odds sincronizadas", data.summary.oddsToday, Database, "text-gold"], ["Tips geradas", data.summary.generatedToday, BellRing, "text-neon"], ["Tips liquidadas", data.summary.settledToday, Target, "text-white"],
    ["Greens", data.summary.greens, TrendingUp, "text-neon"], ["Reds", data.summary.reds, ShieldAlert, "text-red-400"], ["ROI acumulado", `${data.summary.roi.toFixed(2)}%`, Percent, data.summary.roi >= 0 ? "text-neon" : "text-red-400"], ["Win Rate", `${data.summary.winRate.toFixed(1)}%`, Activity, "text-gold"],
  ] as const;

  return <>
    <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="label mb-2 text-neon">Central de operações</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">Green Command Center</h1><p className="mt-2 max-w-2xl text-sm text-zinc-500">Monitoramento, auditoria e evolução contínua do motor analítico.</p></div><button onClick={refresh} className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white/[.03] px-4 py-3 text-[10px] font-black uppercase text-zinc-300"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""}/> Atualizar agora</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,Icon,tone]) => <div className="card p-5" key={label}><div className="flex items-center justify-between"><p className="label">{label}</p><Icon size={16} className={tone}/></div><strong className={`mt-4 block text-3xl ${tone}`}>{value}</strong></div>)}</div>
    <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4 text-[11px] text-zinc-500"><span className="flex items-center gap-2"><Clock3 size={14} className="text-neon"/>Última sincronização: <b className="text-white">{formatDate(data.summary.lastSync)}</b></span><span>Status: <b className={data.summary.syncStatus === "SUCCESS" ? "text-neon" : "text-amber-300"}>{data.summary.syncStatus}</b> · atualização automática a cada 30s</span></div>

    <section className="card mt-6 overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Top 20 oportunidades</p><p className="mt-1 text-[10px] text-zinc-600">Priorização em tempo real por EV e score</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Jogo</th><th>Mercado</th><th>Odd</th><th>EV</th><th>Score</th><th>Power Rating</th><th>Risco</th><th>Status</th></tr></thead><tbody>{data.opportunities.map((item) => <tr key={item.id} className="border-b border-line/60"><td className="px-5 py-4 font-black">{item.game}</td><td>{item.market}<span className="block text-[9px] text-zinc-600">{item.selection}</span></td><td className="font-black text-gold">{item.odd.toFixed(2)}</td><td className="font-black text-neon">{signed(item.ev)}</td><td>{item.score.toFixed(1)}</td><td>{item.powerRating.toFixed(1)}</td><td>{item.risk}</td><td className="font-black text-neon">{item.status}</td></tr>)}</tbody></table></div></section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><section className="card overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Odds Movement</p><p className="mt-1 text-[10px] text-zinc-600">Abertura, subida, queda e fechamento</p></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Jogo / mercado</th><th>Inicial</th><th>Atual</th><th>Variação</th><th>Evento</th><th>Timestamp</th></tr></thead><tbody>{data.movements.map((item) => <tr key={item.id} className="border-b border-line/60"><td className="px-5 py-4 font-bold">{item.game}<span className="block text-[9px] text-zinc-600">{item.market} · {item.selection}</span></td><td>{item.openingOdd.toFixed(2)}</td><td className="font-black text-gold">{item.currentOdd.toFixed(2)}</td><td className={item.variation > 0 ? "text-neon" : item.variation < 0 ? "text-red-400" : "text-zinc-400"}>{signed(item.variation)}</td><td>{item.type}</td><td className="text-[10px] text-zinc-500">{formatDate(item.timestamp)}</td></tr>)}</tbody></table></div></section><section className="card overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Smart Alerts</p><p className="mt-1 text-[10px] text-zinc-600">Score, EV e movimentos relevantes</p></div><div className="max-h-[520px] divide-y divide-line/60 overflow-y-auto">{data.alerts.length ? data.alerts.map((alert) => <div className="p-4" key={alert.id}><span className={`rounded-md px-2 py-1 text-[8px] font-black ${alert.level === "ELITE" ? "bg-neon/10 text-neon" : alert.level === "PREMIUM" ? "bg-gold/10 text-gold" : "bg-amber-400/10 text-amber-300"}`}>{alert.level}</span><p className="mt-3 text-xs font-black">{alert.title}</p><p className="mt-1 text-[10px] text-zinc-500">{alert.detail}</p><p className="mt-2 text-[10px] text-white">{alert.reason}</p></div>) : <p className="p-5 text-xs text-zinc-600">Nenhum alerta ativo.</p>}</div></section></div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><section className="card p-5"><p className="text-sm font-black uppercase tracking-wider">Monitor de performance</p><div className="mt-5 space-y-3">{data.performance.periods.map((period) => <div key={period.label} className="rounded-xl border border-line bg-white/[.02] p-4"><b className="text-xs">{period.label}</b><div className="mt-3 grid grid-cols-5 gap-2 text-center"><div><p className="label">ROI</p><strong className="text-neon">{period.roi}%</strong></div><div><p className="label">Yield</p><strong>{period.yield}%</strong></div><div><p className="label">Win Rate</p><strong>{period.winRate}%</strong></div><div><p className="label">Greens</p><strong className="text-neon">{period.greens}</strong></div><div><p className="label">Reds</p><strong className="text-red-400">{period.reds}</strong></div></div></div>)}</div></section><section className="card overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Ranking de mercados</p><p className="mt-1 text-[10px] text-zinc-600">Ordenado por ROI, Win Rate e lucro acumulado</p></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">#</th><th>Mercado</th><th>ROI</th><th>Win Rate</th><th>Lucro</th><th>Entradas</th></tr></thead><tbody>{data.performance.rankings.map((item,index) => <tr key={item.market} className="border-b border-line/60"><td className="px-5 py-4 text-zinc-600">{index+1}</td><td className="font-black">{item.market}</td><td className={item.roi >= 0 ? "text-neon" : "text-red-400"}>{item.roi}%</td><td>{item.winRate}%</td><td>{item.profit > 0 ? "+" : ""}{item.profit.toFixed(2)}u</td><td>{item.entries}</td></tr>)}</tbody></table></div></section></div>
    <div className="mt-6 rounded-xl border border-line bg-white/[.02] p-4 text-[11px] leading-relaxed text-zinc-500">As análises são estatísticas, não prometem lucro e não garantem resultados positivos. Aposte com responsabilidade e respeite seus limites.</div>
  </>;
}
