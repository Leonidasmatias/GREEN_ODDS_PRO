import type { WorldCupMatchAnalysis } from "@/lib/worldCupEngine";

export function MatchIntelligenceCard({ analysis }: { analysis: WorldCupMatchAnalysis }) {
  const { home, away, homePower, awayPower, fixture } = analysis;
  const metrics = [
    ["Forma 5", home.formLast5 * 100, away.formLast5 * 100, "%"],
    ["Forma 10", home.formLast10 * 100, away.formLast10 * 100, "%"],
    ["Gols marcados", home.goalsScoredAverage, away.goalsScoredAverage, ""],
    ["Gols sofridos", home.goalsConcededAverage, away.goalsConcededAverage, ""],
    ["Escanteios", home.cornersAverage, away.cornersAverage, ""],
    ["Cartões", home.cardsAverage, away.cardsAverage, ""],
    ["Chutes", home.shotsAverage, away.shotsAverage, ""],
    ["Clean sheets", home.cleanSheetRate * 100, away.cleanSheetRate * 100, "%"],
    ["Ambas marcam", home.bttsRate * 100, away.bttsRate * 100, "%"],
  ] as const;
  const powerMetrics = [
    ["Ataque", homePower.attack, awayPower.attack], ["Defesa", homePower.defense, awayPower.defense], ["Forma", homePower.form, awayPower.form], ["Momento", homePower.momentum, awayPower.momentum], ["Ranking FIFA", homePower.fifaRanking, awayPower.fifaRanking], ["Eficiência ofensiva", homePower.offensiveEfficiency, awayPower.offensiveEfficiency], ["Eficiência defensiva", homePower.defensiveEfficiency, awayPower.defensiveEfficiency],
  ] as const;
  return <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-line p-5"><div><p className="label text-neon">Match Intelligence</p><h3 className="mt-2 text-sm font-black">{fixture.home} x {fixture.away}</h3></div><div className="flex gap-2"><span className="rounded-lg bg-neon/10 px-3 py-2 text-xs font-black text-neon">{homePower.total.toFixed(0)}</span><span className="rounded-lg bg-white/5 px-3 py-2 text-xs font-black">{awayPower.total.toFixed(0)}</span></div></div><div className="grid grid-cols-[1fr_auto_1fr] border-b border-line bg-white/[.015] px-5 py-3 text-[9px] font-black uppercase tracking-wider"><span>{fixture.home}</span><span className="text-zinc-600">Métrica</span><span className="text-right">{fixture.away}</span></div><div className="divide-y divide-line/60">{metrics.map(([label,homeValue,awayValue,suffix]) => <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center px-5 py-2.5 text-[10px]"><strong>{homeValue.toFixed(suffix ? 0 : 2)}{suffix}</strong><span className="px-3 text-zinc-600">{label}</span><strong className="text-right">{awayValue.toFixed(suffix ? 0 : 2)}{suffix}</strong></div>)}</div><div className="border-t border-line p-5"><p className="label mb-4">Power Rating · 7 componentes</p><div className="space-y-3">{powerMetrics.map(([label,homeValue,awayValue]) => <div key={label}><div className="mb-1 flex justify-between text-[9px]"><strong className="text-neon">{homeValue.toFixed(0)}</strong><span className="text-zinc-600">{label}</span><strong className="text-gold">{awayValue.toFixed(0)}</strong></div><div className="grid grid-cols-2 gap-1"><div className="flex justify-end rounded-l-full bg-zinc-800"><div className="h-1 rounded-full bg-neon" style={{width:`${homeValue}%`}}/></div><div className="rounded-r-full bg-zinc-800"><div className="h-1 rounded-full bg-gold" style={{width:`${awayValue}%`}}/></div></div></div>)}</div></div><div className="grid grid-cols-2 gap-px bg-line"><div className="bg-panel p-4"><p className="label">Mandante</p><strong className="mt-1 block text-lg text-neon">{(home.homeEfficiency*100).toFixed(0)}%</strong></div><div className="bg-panel p-4 text-right"><p className="label">Visitante</p><strong className="mt-1 block text-lg text-gold">{(away.awayEfficiency*100).toFixed(0)}%</strong></div></div></section>;
}
