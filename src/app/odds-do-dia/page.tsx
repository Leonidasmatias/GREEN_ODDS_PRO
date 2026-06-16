import { Filter, SlidersHorizontal } from "lucide-react";
import { PageTitle, StatCard } from "@/components/ui";
import { ValueOpportunityTable } from "@/components/ValueOpportunityTable";
import { getWorldCupOdds } from "@/services/oddsApi";
import { buildValueReport } from "@/services/valueEngine";

export const dynamic = "force-dynamic";

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

export default async function OddsTodayPage() {
  const [feed, valueReport] = await Promise.all([getWorldCupOdds(), buildValueReport()]);
  const preGameValues = [...valueReport.entries, ...valueReport.watchlist].filter((item) => item.matchStatus === "PRE_GAME");
  return <>
    <PageTitle eyebrow="Pre-jogo" title="Odds do dia" description="Partidas do provider ativo e analise estatistica baseada somente em odds reais persistidas." action={<button className="flex items-center gap-2 rounded-xl border border-line bg-white/[.03] px-5 py-3 text-xs font-bold"><SlidersHorizontal size={15}/> Ajustar filtros</button>}/>
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Jogos carregados" value={feed.games.length.toString()} detail={feed.provider}/>
      <StatCard label="Odds analisadas" value={valueReport.audit.analyzed.toString()} detail="value engine" tone="white"/>
      <StatCard label="Ultima analise" value={formatDate(valueReport.updatedAt)} detail="dados persistidos" tone="yellow"/>
    </div>
    <section className="card mt-6 overflow-hidden p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider">Mercados pre-jogo avaliados</p>
          <p className="mt-1 text-[11px] text-zinc-600">{valueReport.provider} · {preGameValues.length} mercados com status de acompanhamento</p>
        </div>
        <Filter size={17} className="text-zinc-600"/>
      </div>
      <ValueOpportunityTable items={preGameValues}/>
    </section>
  </>;
}
