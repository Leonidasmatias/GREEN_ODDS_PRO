import { Calculator, Check, Layers3, ShieldCheck } from "lucide-react";
import { worldCupOpportunities } from "@/lib/worldCupEngine";
import { ConfidenceRing, PageTitle } from "@/components/ui";
import { RiskBadge } from "@/components/RiskBadge";
import { generateSmartMultiple } from "@/lib/analysis";

const multiple = generateSmartMultiple(worldCupOpportunities);

export default function MultiplesPage() {
  return <><PageTitle eyebrow="Combinador inteligente" title="Múltiplas inteligentes" description="Combinações curtas de 2 a 4 seleções, priorizando estabilidade estatística e controle de exposição."/>
    <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <section className="card p-6"><div className="mb-6 flex items-center justify-between"><div><p className="label text-neon">Gerada automaticamente</p><h2 className="mt-2 text-xl font-black">Múltipla inteligente · {multiple.selections.length} seleções</h2><p className="mt-1 text-[10px] text-zinc-600">Score ≥ 80 · EV positivo · risco baixo ou médio</p></div><div className="grid h-11 w-11 place-items-center rounded-xl bg-neon/10 text-neon"><Layers3/></div></div>
        <div className="space-y-3">{multiple.selections.map((item, i) => <div key={item.id} className="flex items-center gap-4 rounded-xl border border-line bg-white/[.02] p-4"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neon text-xs font-black text-black">{i+1}</div><div className="min-w-0 flex-1"><b className="block truncate text-sm">{item.game}</b><p className="mt-1 text-[11px] text-zinc-500">{item.market} · {item.pick} · Score {item.score.toFixed(0)}</p></div><div className="text-right"><p className="text-lg font-black text-gold">{item.odd.toFixed(2)}</p><RiskBadge risk={item.risk}/></div></div>)}</div>
        <div className="mt-6 rounded-xl border border-neon/20 bg-neon/[.04] p-4 text-xs text-zinc-400"><ShieldCheck className="mb-2 text-neon" size={18}/><b className="text-white">Múltipla com maior potencial estatístico, sem garantia de resultado.</b> Limite a exposição e nunca tente recuperar perdas aumentando a stake.</div>
      </section>
      <aside className="card p-6"><p className="label">Resumo da múltipla</p><div className="my-6 flex justify-center"><ConfidenceRing value={Math.round(multiple.confidence)}/></div><div className="space-y-4 border-y border-line py-5">{[["Odd total", multiple.totalOdd.toFixed(2)], ["Score médio", multiple.averageScore.toFixed(1)], ["Confiança", `${multiple.confidence.toFixed(1)}%`], ["Risco total", multiple.risk], ["Stake sugerida", `${multiple.suggestedStake.toFixed(2)} unidade`]].map(([label,value]) => <div key={label} className="flex justify-between text-xs"><span className="text-zinc-500">{label}</span><b className={label === "Odd total" ? "text-gold" : ""}>{value}</b></div>)}</div><button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3.5 text-xs font-black uppercase tracking-wider text-black"><Calculator size={16}/> Simular retorno</button><div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-zinc-600"><Check size={12}/> Sem integração com casas de apostas</div></aside>
    </div>
  </>;
}
