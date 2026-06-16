import { Filter, SlidersHorizontal } from "lucide-react";
import { PageTitle, StatCard } from "@/components/ui";
import { MarketTable } from "@/components/MarketTable";
import { getWorldCupOdds, opportunitiesFromFeed } from "@/services/oddsApi";

export const dynamic = "force-dynamic";

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

export default async function OddsTodayPage() {
  const feed = await getWorldCupOdds();
  const opportunities = opportunitiesFromFeed(feed).sort((a, b) => b.odd - a.odd);
  return <><PageTitle eyebrow="Pre-jogo" title="Odds do dia" description="Partidas e mercados retornados pelo provider licenciado ativo." action={<button className="flex items-center gap-2 rounded-xl border border-line bg-white/[.03] px-5 py-3 text-xs font-bold"><SlidersHorizontal size={15}/> Ajustar filtros</button>}/>
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Jogos carregados" value={feed.games.length.toString()} detail={feed.provider}/><StatCard label="Mercados mapeados" value={opportunities.length.toString()} detail="odds do provider" tone="white"/><StatCard label="Ultima atualizacao" value={formatDate(feed.updatedAt)} detail="feed ativo" tone="yellow"/></div>
    <section className="card mt-6 overflow-hidden p-5 md:p-6"><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-black uppercase tracking-wider">Mercados disponiveis</p><p className="mt-1 text-[11px] text-zinc-600">{feed.provider} · {feed.games.length} jogos carregados</p></div><Filter size={17} className="text-zinc-600"/></div><MarketTable items={opportunities}/></section>
  </>;
}
