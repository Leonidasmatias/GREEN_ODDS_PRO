import { Crosshair, Info } from "lucide-react";
import { worldCupOpportunities } from "@/lib/worldCupEngine";
import { PageTitle } from "@/components/ui";
import { MarketTable } from "@/components/MarketTable";

export default function RadarPage() {
  return <><PageTitle eyebrow="Motor de análise" title="Radar de Odds Green" description="Comparação entre a probabilidade de mercado e a estimativa do sistema para detectar valor estatístico."/>
    <div className="mb-6 flex flex-wrap gap-2">{["Todos", "1X2", "Gols", "Ambas marcam", "Escanteios", "Chutes", "Cartões", "Handicap", "Dupla chance"].map((item, i) => <button key={item} className={`rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-wider ${i === 0 ? "border-neon bg-neon text-black" : "border-line text-zinc-500"}`}>{item}</button>)}</div>
    <section className="card overflow-hidden p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-neon/10 text-neon"><Crosshair size={19}/></div><div><b className="text-sm">World Cup Model ativo</b><p className="text-[10px] text-zinc-600">{worldCupOpportunities.length} mercados · 4.000 simulações</p></div></div><span className="flex items-center gap-2 text-[10px] font-bold text-neon"><span className="h-2 w-2 animate-pulse rounded-full bg-neon"/> ANALISANDO</span></div><MarketTable items={worldCupOpportunities}/></section>
    <div className="mt-4 flex gap-3 rounded-xl border border-line bg-white/[.02] p-4 text-xs leading-relaxed text-zinc-500"><Info size={17} className="shrink-0 text-neon"/> O score não é uma promessa de acerto. Ele organiza sinais estatísticos e deve ser usado em conjunto com gestão de banca e análise de contexto.</div>
  </>;
}
