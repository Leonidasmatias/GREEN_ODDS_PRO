import { Filter, SlidersHorizontal } from "lucide-react";
import { worldCupOpportunities } from "@/lib/worldCupEngine";
import { PageTitle, StatCard } from "@/components/ui";
import { MarketTable } from "@/components/MarketTable";

const sorted = [...worldCupOpportunities].sort((a, b) => {
  const rank = { Baixo: 0, Médio: 1, Alto: 2 };
  return rank[a.risk] - rank[b.risk] || b.expectedValue - a.expectedValue || b.confidence - a.confidence;
});

export default function OddsTodayPage() {
  return <><PageTitle eyebrow="Seleção diária" title="Odds do dia" description="Melhores oportunidades da Copa 2026 ordenadas por risco, valor esperado, odd e confiança." action={<button className="flex items-center gap-2 rounded-xl border border-line bg-white/[.03] px-5 py-3 text-xs font-bold"><SlidersHorizontal size={15}/> Ajustar filtros</button>}/>
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Entradas mapeadas" value={worldCupOpportunities.length.toString()} detail="10 mercados por partida"/><StatCard label="Filtro aprovado" value={worldCupOpportunities.filter((item) => item.expectedValue > 0 && item.score >= 70).length.toString()} detail="EV positivo e score mínimo" tone="white"/><StatCard label="Melhor edge" value={`${(worldCupOpportunities[0].edge*100).toFixed(1)}%`} detail={worldCupOpportunities[0].game} tone="yellow"/></div>
    <section className="card mt-6 overflow-hidden p-5 md:p-6"><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-black uppercase tracking-wider">Ranking de oportunidades</p><p className="mt-1 text-[11px] text-zinc-600">Atualizado há 2 minutos · dados demonstrativos</p></div><Filter size={17} className="text-zinc-600"/></div><MarketTable items={sorted}/></section>
  </>;
}
