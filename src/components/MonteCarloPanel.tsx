import type { WorldCupMatchAnalysis } from "@/lib/worldCupEngine";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function MonteCarloPanel({ analysis }: { analysis: WorldCupMatchAnalysis }) {
  const { simulation, fixture } = analysis;
  const probabilities = [
    { label: `Vitória ${fixture.home}`, value: simulation.homeWin, color: "bg-neon" },
    { label: "Empate", value: simulation.draw, color: "bg-gold" },
    { label: `Vitória ${fixture.away}`, value: simulation.awayWin, color: "bg-red-400" },
  ];
  return <section className="card p-5"><div className="flex items-start justify-between"><div><p className="label text-neon">Monte Carlo</p><h3 className="mt-2 text-sm font-black">{fixture.home} x {fixture.away}</h3></div><span className="rounded-full border border-line px-2.5 py-1 text-[9px] font-bold text-zinc-500">{simulation.simulations} simulações</span></div><div className="mt-5 space-y-4">{probabilities.map((item) => <div key={item.label}><div className="mb-1.5 flex justify-between text-[10px]"><span className="text-zinc-500">{item.label}</span><strong>{percent(item.value)}</strong></div><div className="h-1.5 rounded-full bg-zinc-800"><div className={`h-full rounded-full ${item.color}`} style={{width:percent(item.value)}}/></div></div>)}</div><div className="mt-5 border-t border-line pt-4"><p className="label">Placares mais prováveis</p><div className="mt-3 flex flex-wrap gap-2">{simulation.scoreDistribution.slice(0, 4).map((score) => <span key={score.score} className="rounded-lg border border-line bg-black/20 px-3 py-2 text-[10px]"><b className="text-gold">{score.score}</b> <span className="text-zinc-600">{percent(score.probability)}</span></span>)}</div></div></section>;
}
