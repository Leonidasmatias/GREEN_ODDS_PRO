import { BrainCircuit, Crosshair, Trophy } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { TopOpportunities } from "@/components/TopOpportunities";
import { getWorldCupOdds, opportunitiesFromFeed } from "@/services/oddsApi";

export const dynamic = "force-dynamic";

export default async function TopGreenPage() {
  const feed = await getWorldCupOdds();
  const opportunities = opportunitiesFromFeed(feed);
  const topTen = opportunities.slice(0, 10);
  return <><PageTitle eyebrow="Provider ativo" title="Top 10 do dia" description="Mercados retornados pelo provider licenciado ativo."/>
    <div className="mb-6 grid gap-4 sm:grid-cols-3"><div className="card p-5"><Crosshair size={17} className="text-neon"/><p className="label mt-4">Mercados analisados</p><strong className="mt-2 block text-3xl">{opportunities.length}</strong></div><div className="card p-5"><Trophy size={17} className="text-gold"/><p className="label mt-4">Jogos carregados</p><strong className="mt-2 block text-3xl text-gold">{feed.games.length}</strong></div><div className="card p-5"><BrainCircuit size={17} className="text-neon"/><p className="label mt-4">Provider</p><strong className="mt-2 block text-lg text-neon">{feed.provider}</strong></div></div>
    <section className="card overflow-hidden"><div className="border-b border-line px-5 py-5"><p className="text-sm font-black uppercase tracking-wider">Radar Green</p><p className="mt-1 text-[10px] text-zinc-600">Top 10 por odds reais do provider ativo</p></div><TopOpportunities items={topTen} showPowerRating/></section>
  </>;
}
