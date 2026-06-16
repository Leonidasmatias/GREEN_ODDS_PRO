import { Crosshair, Info } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { MarketTable } from "@/components/MarketTable";
import { getWorldCupOdds, opportunitiesFromFeed } from "@/services/oddsApi";

export const dynamic = "force-dynamic";

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

export default async function RadarPage() {
  const feed = await getWorldCupOdds();
  const opportunities = opportunitiesFromFeed(feed);
  return <><PageTitle eyebrow="Provider ativo" title="Radar de Odds Green" description="Mercados construidos exclusivamente a partir do provider licenciado ativo."/>
    <section className="card overflow-hidden p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-neon/10 text-neon"><Crosshair size={19}/></div><div><b className="text-sm">{feed.provider}</b><p className="text-[10px] text-zinc-600">{feed.games.length} jogos · {opportunities.length} mercados · {formatDate(feed.updatedAt)}</p></div></div><span className="flex items-center gap-2 text-[10px] font-bold text-neon"><span className="h-2 w-2 animate-pulse rounded-full bg-neon"/> PROVIDER REAL</span></div><MarketTable items={opportunities}/></section>
    <div className="mt-4 flex gap-3 rounded-xl border border-line bg-white/[.02] p-4 text-xs leading-relaxed text-zinc-500"><Info size={17} className="shrink-0 text-neon"/> O score organiza odds reais do provider ativo. Ele nao promete lucro nem garante green.</div>
  </>;
}
