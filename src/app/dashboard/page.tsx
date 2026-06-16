import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, CheckCircle2, CircleDollarSign, Crosshair, History, Layers3, TrendingUp, Zap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionHeader } from "@/components/ui";
import { MarketTable } from "@/components/MarketTable";
import { OddsTable } from "@/components/OddsTable";
import { OpportunityCard } from "@/components/OpportunityCard";
import { TopOpportunities } from "@/components/TopOpportunities";
import { rankByExpectedValue } from "@/lib/analysis";
import { getWorldCupOdds } from "@/services/oddsApi";
import { worldCupOpportunities } from "@/lib/worldCupEngine";

const positiveOpportunities = worldCupOpportunities.filter((item) => item.expectedValue > 0);
const topOpportunities = rankByExpectedValue(worldCupOpportunities).slice(0, 5);
const eliteGreens = worldCupOpportunities.filter((item) => item.classification === "ELITE GREEN").length;
const premiumGreens = worldCupOpportunities.filter((item) => item.classification === "GREEN PREMIUM").length;

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const oddsFeed = await getWorldCupOdds();
  const settledTips = await prisma.tip.findMany({ where: { status: { in: ["WON", "LOST"] } } });
  const greenResults = settledTips.filter((item) => item.status === "WON").length;
  const totalStake = settledTips.reduce((sum, item) => sum + item.stake, 0);
  const accumulatedProfit = settledTips.reduce((sum, item) => sum + (item.profitLoss ?? 0), 0);
  const roi = totalStake ? accumulatedProfit / totalStake * 100 : 0;
  const hitRate = settledTips.length ? greenResults / settledTips.length * 100 : 0;
  const games = oddsFeed.games;
  const overviewCards = [
    { label: "Total jogos hoje", value: games.length.toString().padStart(2, "0"), detail: oddsFeed.mode === "REAL" ? "feed licenciado ativo" : "dados demonstrativos", href: "/odds-do-dia", icon: CalendarDays, tone: "text-white" },
    { label: "Entradas Elite", value: eliteGreens.toString().padStart(2, "0"), detail: "score 95 ou superior", href: "/top-green", icon: Crosshair, tone: "text-neon" },
    { label: "Entradas Premium", value: premiumGreens.toString().padStart(2, "0"), detail: "score entre 90 e 94", href: "/top-green", icon: Layers3, tone: "text-gold" },
    { label: "ROI acumulado", value: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`, detail: "tips liquidadas", href: "/performance", icon: TrendingUp, tone: "text-neon" },
    { label: "Taxa de acerto", value: `${hitRate.toFixed(1)}%`, detail: `${greenResults} greens reais`, href: "/performance", icon: History, tone: "text-white" },
    { label: "Lucro real", value: `${accumulatedProfit >= 0 ? "+" : ""}${accumulatedProfit.toFixed(2)}u`, detail: "resultado liquidado", href: "/performance", icon: CircleDollarSign, tone: "text-gold" },
  ];
  return <>
    <section className="relative mb-6 overflow-hidden rounded-3xl border border-line bg-[radial-gradient(circle_at_82%_10%,rgba(69,230,138,.13),transparent_30%),linear-gradient(135deg,#121a16,#08100c)] p-6 shadow-glow md:p-9">
      <div className="absolute right-8 top-8 hidden h-36 w-36 rounded-full border border-neon/10 md:block"/><div className="absolute right-14 top-14 hidden h-24 w-24 rounded-full border border-gold/15 md:block"/>
      <div className="relative max-w-3xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-neon/20 bg-neon/[.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.2em] text-neon"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon"/> Central de análise · Copa 2026</div><h1 className="max-w-2xl text-4xl font-black leading-[1.05] tracking-[-.04em] md:text-6xl">Radar inteligente para odds com <span className="text-neon">valor estatístico.</span></h1><p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">Compare preços de mercado, probabilidade estimada, risco e valor esperado em uma interface construída para decisões disciplinadas.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/odds-do-dia" className="flex items-center gap-2 rounded-xl bg-neon px-6 py-3.5 text-xs font-black uppercase tracking-wider text-[#041008] shadow-[0_0_24px_rgba(69,230,138,.14)]">Ver odds do dia <ArrowRight size={16}/></Link><Link href="/radar-green" className="flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/[.06] px-6 py-3.5 text-xs font-black uppercase tracking-wider text-gold">Abrir radar <Crosshair size={15}/></Link></div></div>
    </section>

    {oddsFeed.warning && <div className="mb-6 rounded-xl border border-amber-400/15 bg-amber-400/[.05] px-4 py-3 text-[10px] text-amber-200">{oddsFeed.warning}</div>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{overviewCards.map(({ label, value, detail, href, icon: Icon, tone }) => <Link href={href} key={label} className="card group p-5 transition hover:-translate-y-0.5 hover:border-neon/25"><div className="flex items-start justify-between"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.04] text-zinc-500 transition group-hover:bg-neon/10 group-hover:text-neon"><Icon size={17}/></div><ArrowRight size={14} className="text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-neon"/></div><p className="label mt-5">{label}</p><p className={`mt-2 text-3xl font-black tracking-tight ${tone}`}>{value}</p><p className="mt-1 text-[10px] text-zinc-600">{detail}</p></Link>)}</div>

    <section className="card mt-7 overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-5"><div><p className="text-sm font-black uppercase tracking-[.14em]">Top oportunidades</p><p className="mt-1 text-[10px] text-zinc-600">Ranking automático pelo maior valor esperado</p></div><Link href="/radar-green" className="text-[9px] font-black uppercase tracking-wider text-neon">Abrir radar</Link></div><TopOpportunities items={topOpportunities}/></section>

    <section className="mt-7"><SectionHeader title="Oportunidades em destaque" detail="Mercados com valor esperado positivo e score qualificado" href="/radar-green"/><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{positiveOpportunities.slice(0, 3).map((item) => <OpportunityCard key={item.id} opportunity={item}/>)}</div></section>

    <div className="mt-7 grid gap-6 xl:grid-cols-[1.65fr_.55fr]">
      <section><OddsTable games={games}/></section>
      <section className="card overflow-hidden p-6">
        <div className="flex items-center justify-between"><div><p className="label text-neon">Pulso do mercado</p><h2 className="mt-2 text-xl font-black">Índice de valor</h2></div><div className="grid h-11 w-11 place-items-center rounded-xl bg-neon/10 text-neon"><Activity/></div></div>
        <div className="my-7 text-center"><p className="text-6xl font-black tracking-tighter">74<span className="text-2xl text-neon">/100</span></p><p className="mt-2 text-xs text-zinc-500">Mercado com valor moderado hoje</p></div>
        <div className="space-y-4">{[["Valor médio", "7.4%", 74], ["Confiança", "76.2%", 76], ["Volatilidade", "Média", 52]].map(([label, value, width]) => <div key={label as string}><div className="mb-2 flex justify-between text-[10px] font-bold"><span className="text-zinc-500">{label}</span><span>{value}</span></div><div className="h-1.5 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-800 to-neon" style={{width:`${width}%`}}/></div></div>)}</div>
        <div className="mt-7 rounded-xl border border-neon/15 bg-neon/[.04] p-4 text-xs leading-relaxed text-zinc-400"><Zap className="mb-2 text-neon" size={16}/><b className="text-white">Leitura do sistema:</b> priorize mercados de gols e dupla chance. Evite ampliar exposição em partidas ao vivo.</div>
      </section>
    </div>

    <section className="card mt-6 overflow-hidden p-5 md:p-6"><SectionHeader title="Radar Elite Green" detail="World Cup Model · power rating · Monte Carlo" href="/top-green"/><MarketTable items={worldCupOpportunities} compact/></section>

    <div className="mt-6 grid gap-4 md:grid-cols-3">
      {[{icon:Crosshair,title:"Motor quantitativo",text:"Score combina probabilidade, edge, forma, ataque, defesa e contexto."},{icon:CircleDollarSign,title:"Gestão de risco",text:"Stake sugerida por nível de confiança, sem promessa de resultado."},{icon:CheckCircle2,title:"Transparência",text:"Histórico preserva greens, reds, pendências e ROI acumulado."}].map(({icon:Icon,title,text}) => <div className="card flex gap-4 p-5" key={title}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-neon"><Icon size={18}/></div><div><b className="text-sm">{title}</b><p className="mt-1 text-xs leading-relaxed text-zinc-600">{text}</p></div></div>)}
    </div>
  </>;
}
