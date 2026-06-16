import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, CircleDollarSign, Crosshair, History, Radio, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionHeader } from "@/components/ui";
import { MarketTable } from "@/components/MarketTable";
import { OddsTable } from "@/components/OddsTable";
import { TopOpportunities } from "@/components/TopOpportunities";
import { getWorldCupOdds, opportunitiesFromFeed } from "@/services/oddsApi";

export const dynamic = "force-dynamic";

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

export default async function DashboardPage() {
  const oddsFeed = await getWorldCupOdds();
  const opportunities = opportunitiesFromFeed(oddsFeed);
  const settledTips = await prisma.tip.findMany({ where: { status: { in: ["WON", "LOST"] } } });
  const greenResults = settledTips.filter((item) => item.status === "WON").length;
  const totalStake = settledTips.reduce((sum, item) => sum + item.stake, 0);
  const accumulatedProfit = settledTips.reduce((sum, item) => sum + (item.profitLoss ?? 0), 0);
  const roi = totalStake ? accumulatedProfit / totalStake * 100 : 0;
  const hitRate = settledTips.length ? greenResults / settledTips.length * 100 : 0;
  const games = oddsFeed.games;
  const liveGames = games.filter((game) => game.status === "Ao vivo").length;
  const topOpportunities = opportunities.slice(0, 5);
  const overviewCards = [
    { label: "Jogos carregados", value: games.length.toString().padStart(2, "0"), detail: oddsFeed.provider, href: "/odds-do-dia", icon: CalendarDays, tone: "text-white" },
    { label: "Ao vivo", value: liveGames.toString().padStart(2, "0"), detail: "partidas do provider", href: "/live-monitor", icon: Radio, tone: "text-red-400" },
    { label: "Mercados", value: opportunities.length.toString().padStart(2, "0"), detail: "odds reais mapeadas", href: "/radar-green", icon: Crosshair, tone: "text-gold" },
    { label: "ROI acumulado", value: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`, detail: "tips liquidadas", href: "/performance", icon: TrendingUp, tone: "text-neon" },
    { label: "Taxa de acerto", value: `${hitRate.toFixed(1)}%`, detail: `${greenResults} greens reais`, href: "/performance", icon: History, tone: "text-white" },
    { label: "Lucro real", value: `${accumulatedProfit >= 0 ? "+" : ""}${accumulatedProfit.toFixed(2)}u`, detail: "resultado liquidado", href: "/performance", icon: CircleDollarSign, tone: "text-gold" },
  ];

  return <>
    <section className="relative mb-6 overflow-hidden rounded-3xl border border-line bg-[radial-gradient(circle_at_82%_10%,rgba(69,230,138,.13),transparent_30%),linear-gradient(135deg,#121a16,#08100c)] p-6 shadow-glow md:p-9">
      <div className="relative max-w-3xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-neon/20 bg-neon/[.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.2em] text-neon"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon"/> Provider ativo · {oddsFeed.provider}</div><h1 className="max-w-2xl text-4xl font-black leading-[1.05] md:text-6xl">Radar inteligente para odds com <span className="text-neon">dados reais.</span></h1><p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">Feed atualizado em {formatDate(oddsFeed.updatedAt)} · {games.length} jogos carregados.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/odds-do-dia" className="flex items-center gap-2 rounded-xl bg-neon px-6 py-3.5 text-xs font-black uppercase tracking-wider text-[#041008]">Ver odds do dia <ArrowRight size={16}/></Link><Link href="/radar-green" className="flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/[.06] px-6 py-3.5 text-xs font-black uppercase tracking-wider text-gold">Abrir radar <Crosshair size={15}/></Link></div></div>
    </section>

    {oddsFeed.warning && <div className="mb-6 rounded-xl border border-amber-400/15 bg-amber-400/[.05] px-4 py-3 text-[10px] text-amber-200">{oddsFeed.warning}</div>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{overviewCards.map(({ label, value, detail, href, icon: Icon, tone }) => <Link href={href} key={label} className="card group p-5 transition hover:-translate-y-0.5 hover:border-neon/25"><div className="flex items-start justify-between"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.04] text-zinc-500 transition group-hover:bg-neon/10 group-hover:text-neon"><Icon size={17}/></div><ArrowRight size={14} className="text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-neon"/></div><p className="label mt-5">{label}</p><p className={`mt-2 text-3xl font-black tracking-tight ${tone}`}>{value}</p><p className="mt-1 text-[10px] text-zinc-600">{detail}</p></Link>)}</div>

    <section className="card mt-7 overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-5"><div><p className="text-sm font-black uppercase tracking-[.14em]">Top mercados do provider</p><p className="mt-1 text-[10px] text-zinc-600">{oddsFeed.provider} · atualizado em {formatDate(oddsFeed.updatedAt)}</p></div><Link href="/radar-green" className="text-[9px] font-black uppercase tracking-wider text-neon">Abrir radar</Link></div><TopOpportunities items={topOpportunities}/></section>

    <div className="mt-7 grid gap-6 xl:grid-cols-[1.65fr_.55fr]">
      <section><OddsTable games={games}/></section>
      <section className="card overflow-hidden p-6">
        <div className="flex items-center justify-between"><div><p className="label text-neon">Feed do mercado</p><h2 className="mt-2 text-xl font-black">Resumo da API</h2></div><div className="grid h-11 w-11 place-items-center rounded-xl bg-neon/10 text-neon"><Activity/></div></div>
        <div className="my-7 text-center"><p className="text-6xl font-black tracking-tighter">{games.length}</p><p className="mt-2 text-xs text-zinc-500">partidas carregadas</p></div>
        <div className="space-y-3 text-xs text-zinc-500"><p>Provider: <b className="text-white">{oddsFeed.provider}</b></p><p>Ultima atualizacao: <b className="text-white">{formatDate(oddsFeed.updatedAt)}</b></p><p>Mercados mapeados: <b className="text-white">{opportunities.length}</b></p></div>
      </section>
    </div>

    <section className="card mt-6 overflow-hidden p-5 md:p-6"><SectionHeader title="Radar Green" detail={`${oddsFeed.provider} · ${opportunities.length} mercados reais`} href="/radar-green"/><MarketTable items={opportunities} compact/></section>
  </>;
}
