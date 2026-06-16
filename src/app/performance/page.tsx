import { Award, CircleDollarSign, Crosshair, Percent, Target, TrendingUp } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { PerformanceCharts } from "@/components/PerformanceCharts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ChartPoint = { date: string; profit: number; roi: number; greens: number; reds: number };

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function getRealPerformance() {
  const tips = await prisma.tip.findMany({ where: { status: { in: ["WON", "LOST"] } }, orderBy: { settledAt: "asc" } });
  let profit = 0;
  let stake = 0;
  let greens = 0;
  let reds = 0;
  const byDay = new Map<string, ChartPoint>();
  for (const tip of tips) {
    const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(tip.settledAt ?? tip.createdAt);
    profit += tip.profitLoss ?? 0;
    stake += tip.stake;
    greens += tip.status === "WON" ? 1 : 0;
    reds += tip.status === "LOST" ? 1 : 0;
    byDay.set(date, { date, profit: round(profit), roi: round(stake ? profit / stake * 100 : 0), greens, reds });
  }
  return { totalEntries: tips.length, greens, reds, roi: round(stake ? profit / stake * 100 : 0), hitRate: round(tips.length ? greens / tips.length * 100 : 0), accumulatedProfit: round(profit), series: [...byDay.values()] };
}

export default async function PerformancePage() {
  const performance = await getRealPerformance();
  const metrics = [
    { label: "Total de entradas", value: performance.totalEntries.toString(), detail: "tips liquidadas", icon: Crosshair, tone: "text-white" },
    { label: "Greens", value: performance.greens.toString(), detail: "resultados positivos", icon: Award, tone: "text-neon" },
    { label: "Reds", value: performance.reds.toString(), detail: "resultados negativos", icon: Target, tone: "text-red-400" },
    { label: "ROI", value: `${performance.roi >= 0 ? "+" : ""}${performance.roi}%`, detail: "retorno real registrado", icon: TrendingUp, tone: "text-neon" },
    { label: "Taxa de acerto", value: `${performance.hitRate}%`, detail: "entradas finalizadas", icon: Percent, tone: "text-gold" },
    { label: "Lucro acumulado", value: `${performance.accumulatedProfit >= 0 ? "+" : ""}${performance.accumulatedProfit}u`, detail: "stake registrada", icon: CircleDollarSign, tone: "text-neon" },
  ];
  return <>
    <PageTitle eyebrow="Inteligencia de resultados" title="Painel de performance" description="Metricas calculadas somente a partir de tips liquidadas no banco, sem historico sintetico."/>
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{metrics.map(({label,value,detail,icon:Icon,tone}) => <div key={label} className="card p-5"><div className="flex items-start justify-between"><p className="label">{label}</p><Icon size={15} className={tone}/></div><strong className={`mt-4 block text-3xl tracking-tight ${tone}`}>{value}</strong><p className="mt-1 text-[10px] text-zinc-600">{detail}</p></div>)}</div>
    {performance.series.length ? <PerformanceCharts data={performance.series}/> : <section className="card p-8 text-center text-sm text-zinc-500">Nenhuma performance real liquidada ainda.</section>}
    <div className="mt-5 rounded-xl border border-line bg-white/[.02] p-4 text-[11px] leading-relaxed text-zinc-500">Esta pagina nao promete lucro, nao garante green e nao cria historico demonstrativo em producao. Resultados dependem da liquidacao oficial de cada mercado.</div>
  </>;
}
