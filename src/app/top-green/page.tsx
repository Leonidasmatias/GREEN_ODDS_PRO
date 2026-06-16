import { BrainCircuit, Crosshair, Trophy } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { TopOpportunities } from "@/components/TopOpportunities";
import { MonteCarloPanel } from "@/components/MonteCarloPanel";
import { MatchIntelligenceCard } from "@/components/MatchIntelligenceCard";
import { worldCupAnalyses, worldCupOpportunities } from "@/lib/worldCupEngine";

export default function TopGreenPage() {
  const topTen = worldCupOpportunities.slice(0, 10);
  return <><PageTitle eyebrow="World Cup AI Engine" title="Top 10 do dia" description="Oportunidades da Copa 2026 ranqueadas por valor esperado, score, risco e power rating."/>
    <div className="mb-6 grid gap-4 sm:grid-cols-3"><div className="card p-5"><Crosshair size={17} className="text-neon"/><p className="label mt-4">Mercados analisados</p><strong className="mt-2 block text-3xl">{worldCupOpportunities.length}</strong></div><div className="card p-5"><Trophy size={17} className="text-gold"/><p className="label mt-4">Elite e Premium</p><strong className="mt-2 block text-3xl text-gold">{worldCupOpportunities.filter((item) => item.classification === "ELITE GREEN" || item.classification === "GREEN PREMIUM").length}</strong></div><div className="card p-5"><BrainCircuit size={17} className="text-neon"/><p className="label mt-4">Simulações executadas</p><strong className="mt-2 block text-3xl text-neon">{worldCupAnalyses.length * 1000}</strong></div></div>
    <section className="card overflow-hidden"><div className="border-b border-line px-5 py-5"><p className="text-sm font-black uppercase tracking-wider">Radar Elite Green</p><p className="mt-1 text-[10px] text-zinc-600">Top 10 ordenado pelo maior EV</p></div><TopOpportunities items={topTen} showPowerRating/></section>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">{worldCupAnalyses.map((analysis) => <MonteCarloPanel key={analysis.fixture.id} analysis={analysis}/>)}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">{worldCupAnalyses.map((analysis) => <MatchIntelligenceCard key={analysis.fixture.id} analysis={analysis}/>)}</div>
  </>;
}
