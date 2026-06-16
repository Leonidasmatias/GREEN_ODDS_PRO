import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, CircleDollarSign, Crosshair, History, Radio, TrendingUp } from "lucide-react";
import { SectionHeader } from "@/components/ui";
import { OddsTable } from "@/components/OddsTable";
import { ValueAuditSummary, ValueOpportunityTable } from "@/components/ValueOpportunityTable";
import { getWorldCupOdds } from "@/services/oddsApi";
import { buildValueReport } from "@/services/valueEngine";
import { generateSettlementReport } from "@/services/settlementEngine";
import { getSmartRankingReport } from "@/services/rankingEngine";

export const dynamic = "force-dynamic";

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

type RankingRow = {
  id?: string;
  market?: string;
  competition?: string;
  bookmaker?: string;
  provider?: string;
  oddRange?: string;
  totalTips: number;
  wins: number;
  losses: number;
  voids: number;
  winRate: number;
  roi: number;
  profit: number;
  drawdown: number;
  confidenceScore: number;
  status?: string;
};

function RankingTable({ title, items, labelFor }: { title: string; items: RankingRow[]; labelFor: (item: RankingRow) => string }) {
  return <section className="card overflow-hidden">
    <div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-[.14em]">{title}</p><p className="mt-1 text-[10px] text-zinc-600">Somente resultados reais liquidados</p></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Ranking</th><th>Tips</th><th>Win Rate</th><th>ROI</th><th>Profit</th><th>Drawdown</th><th>Confianca</th></tr></thead><tbody>{items.length ? items.map((item, index) => <tr key={item.id ?? `${title}-${index}`} className="border-b border-line/60"><td className="px-5 py-4"><b className="block">{labelFor(item)}</b><span className="text-[10px] text-zinc-600">{item.provider ?? "-"}</span></td><td>{item.totalTips}</td><td>{(item.winRate * 100).toFixed(1)}%</td><td className={item.roi >= 0 ? "text-neon" : "text-red-400"}>{item.roi.toFixed(2)}%</td><td>{item.profit.toFixed(2)}u</td><td>{item.drawdown.toFixed(2)}u</td><td>{item.confidenceScore.toFixed(0)}/100</td></tr>) : <tr><td colSpan={7} className="px-5 py-10 text-center text-zinc-600">INSUFFICIENT_REAL_DATA</td></tr>}</tbody></table></div>
  </section>;
}

export default async function DashboardPage() {
  const oddsFeed = await getWorldCupOdds();
  const valueReport = await buildValueReport();
  const settlement = await generateSettlementReport();
  const ranking = await getSmartRankingReport();
  const games = oddsFeed.games;
  const liveGames = games.filter((game) => game.status === "Ao vivo").length;
  const overviewCards = [
    { label: "Jogos carregados", value: games.length.toString().padStart(2, "0"), detail: oddsFeed.provider, href: "/odds-do-dia", icon: CalendarDays, tone: "text-white" },
    { label: "Ao vivo", value: liveGames.toString().padStart(2, "0"), detail: "partidas do provider", href: "/live-monitor", icon: Radio, tone: "text-red-400" },
    { label: "Mercados", value: valueReport.audit.analyzed.toString().padStart(2, "0"), detail: "odds reais analisadas", href: "/radar-green", icon: Crosshair, tone: "text-gold" },
    { label: "ROI acumulado", value: `${settlement.roi >= 0 ? "+" : ""}${settlement.roi.toFixed(1)}%`, detail: `${settlement.settled} liquidadas reais`, href: "/performance", icon: TrendingUp, tone: "text-neon" },
    { label: "Taxa de acerto", value: `${(settlement.winRate * 100).toFixed(1)}%`, detail: `${settlement.won} wins reais`, href: "/performance", icon: History, tone: "text-white" },
    { label: "Lucro real", value: `${settlement.profit >= 0 ? "+" : ""}${settlement.profit.toFixed(2)}u`, detail: `${settlement.pending} pendentes`, href: "/performance", icon: CircleDollarSign, tone: "text-gold" },
  ];

  return <>
    <section className="relative mb-6 overflow-hidden rounded-3xl border border-line bg-[radial-gradient(circle_at_82%_10%,rgba(69,230,138,.13),transparent_30%),linear-gradient(135deg,#121a16,#08100c)] p-6 shadow-glow md:p-9">
      <div className="relative max-w-3xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-neon/20 bg-neon/[.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.2em] text-neon"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon"/> Provider ativo · {oddsFeed.provider}</div><h1 className="max-w-2xl text-4xl font-black leading-[1.05] md:text-6xl">Radar inteligente para odds com <span className="text-neon">dados reais.</span></h1><p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">Feed atualizado em {formatDate(oddsFeed.updatedAt)} · {games.length} jogos carregados.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/odds-do-dia" className="flex items-center gap-2 rounded-xl bg-neon px-6 py-3.5 text-xs font-black uppercase tracking-wider text-[#041008]">Ver odds do dia <ArrowRight size={16}/></Link><Link href="/radar-green" className="flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/[.06] px-6 py-3.5 text-xs font-black uppercase tracking-wider text-gold">Abrir radar <Crosshair size={15}/></Link></div></div>
    </section>

    {oddsFeed.warning && <div className="mb-6 rounded-xl border border-amber-400/15 bg-amber-400/[.05] px-4 py-3 text-[10px] text-amber-200">{oddsFeed.warning}</div>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{overviewCards.map(({ label, value, detail, href, icon: Icon, tone }) => <Link href={href} key={label} className="card group p-5 transition hover:-translate-y-0.5 hover:border-neon/25"><div className="flex items-start justify-between"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.04] text-zinc-500 transition group-hover:bg-neon/10 group-hover:text-neon"><Icon size={17}/></div><ArrowRight size={14} className="text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-neon"/></div><p className="label mt-5">{label}</p><p className={`mt-2 text-3xl font-black tracking-tight ${tone}`}>{value}</p><p className="mt-1 text-[10px] text-zinc-600">{detail}</p></Link>)}</div>

    <section className="mt-7"><ValueAuditSummary {...valueReport.audit}/></section>
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[["Entradas pendentes", settlement.pending], ["Entradas liquidadas", settlement.settled], ["WinRate real", `${(settlement.winRate * 100).toFixed(1)}%`], ["ROI real", `${settlement.roi.toFixed(2)}%`], ["Lucro real", `${settlement.profit.toFixed(2)}u`]].map(([label, value]) => <div className="card p-4" key={label}><p className="label">{label}</p><strong className="mt-3 block text-lg text-white">{value}</strong></div>)}
    </section>
    {ranking.status === "INSUFFICIENT_REAL_DATA" && <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-4 text-xs text-amber-200">SMART RANKING: INSUFFICIENT_REAL_DATA. {ranking.sourceRows}/{ranking.minimumSample} resultados reais liquidados.</div>}
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <RankingTable title="Top Mercados" items={ranking.topMarkets} labelFor={(item) => `${item.market ?? "-"} · ${item.oddRange ?? "-"}`}/>
      <RankingTable title="Top Competicoes" items={ranking.topCompetitions} labelFor={(item) => `${item.competition ?? "-"} · ${item.oddRange ?? "-"}`}/>
      <RankingTable title="Top Bookmakers" items={ranking.topBookmakers} labelFor={(item) => `${item.bookmaker ?? "-"} · ${item.oddRange ?? "-"}`}/>
      <RankingTable title="Top ROI" items={ranking.topRoi} labelFor={(item) => `${item.market ?? item.competition ?? item.bookmaker ?? "-"} · ${item.oddRange ?? "-"}`}/>
      <RankingTable title="Top Win Rate" items={ranking.topWinRate} labelFor={(item) => `${item.market ?? item.competition ?? item.bookmaker ?? "-"} · ${item.oddRange ?? "-"}`}/>
    </div>
    <section className="card mt-7 overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-5"><div><p className="text-sm font-black uppercase tracking-[.14em]">Entradas green validadas</p><p className="mt-1 text-[10px] text-zinc-600">{oddsFeed.provider} · atualizado em {formatDate(oddsFeed.updatedAt)}</p></div><Link href="/radar-green" className="text-[9px] font-black uppercase tracking-wider text-neon">Abrir radar</Link></div><ValueOpportunityTable items={valueReport.entries}/></section>

    <div className="mt-7 grid gap-6 xl:grid-cols-[1.65fr_.55fr]">
      <section><OddsTable games={games}/></section>
      <section className="card overflow-hidden p-6">
        <div className="flex items-center justify-between"><div><p className="label text-neon">Feed do mercado</p><h2 className="mt-2 text-xl font-black">Resumo da API</h2></div><div className="grid h-11 w-11 place-items-center rounded-xl bg-neon/10 text-neon"><Activity/></div></div>
        <div className="my-7 text-center"><p className="text-6xl font-black tracking-tighter">{games.length}</p><p className="mt-2 text-xs text-zinc-500">partidas carregadas</p></div>
        <div className="space-y-3 text-xs text-zinc-500"><p>Provider: <b className="text-white">{oddsFeed.provider}</b></p><p>Ultima atualizacao: <b className="text-white">{formatDate(oddsFeed.updatedAt)}</b></p><p>Odds analisadas: <b className="text-white">{valueReport.audit.analyzed}</b></p><p>Entradas aprovadas: <b className="text-white">{valueReport.audit.approved}</b></p></div>
      </section>
    </div>

    <section className="card mt-6 overflow-hidden p-5 md:p-6"><SectionHeader title="Radar Green" detail={`${oddsFeed.provider} · ${valueReport.audit.watch} mercados em observacao`} href="/radar-green"/><ValueOpportunityTable items={valueReport.watchlist.slice(0, 4)} empty="Nenhuma partida encontrada"/></section>
  </>;
}
