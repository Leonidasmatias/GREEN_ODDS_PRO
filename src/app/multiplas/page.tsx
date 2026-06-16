import { Calculator, Check, Layers3, ShieldCheck } from "lucide-react";
import { ConfidenceRing, PageTitle } from "@/components/ui";
import { RiskBadge } from "@/components/RiskBadge";
import { generateSmartMultiple } from "@/lib/analysis";
import { getWorldCupOdds, opportunitiesFromFeed } from "@/services/oddsApi";

export const dynamic = "force-dynamic";

export default async function MultiplesPage() {
  const feed = await getWorldCupOdds();
  const multiple = generateSmartMultiple(opportunitiesFromFeed(feed));
  return <><PageTitle eyebrow="Combinador inteligente" title="Multiplas inteligentes" description="Combinacoes baseadas somente em mercados retornados pelo provider licenciado ativo."/>
    {multiple.selections.length ? <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <section className="card p-6"><div className="mb-6 flex items-center justify-between"><div><p className="label text-neon">Gerada pelo provider</p><h2 className="mt-2 text-xl font-black">Multipla inteligente · {multiple.selections.length} selecoes</h2><p className="mt-1 text-[10px] text-zinc-600">{feed.provider}</p></div><div className="grid h-11 w-11 place-items-center rounded-xl bg-neon/10 text-neon"><Layers3/></div></div>
        <div className="space-y-3">{multiple.selections.map((item, i) => <div key={item.id} className="flex items-center gap-4 rounded-xl border border-line bg-white/[.02] p-4"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neon text-xs font-black text-black">{i+1}</div><div className="min-w-0 flex-1"><b className="block truncate text-sm">{item.game}</b><p className="mt-1 text-[11px] text-zinc-500">{item.market} · {item.pick} · Score {item.score.toFixed(0)}</p></div><div className="text-right"><p className="text-lg font-black text-gold">{item.odd.toFixed(2)}</p><RiskBadge risk={item.risk}/></div></div>)}</div>
        <div className="mt-6 rounded-xl border border-neon/20 bg-neon/[.04] p-4 text-xs text-zinc-400"><ShieldCheck className="mb-2 text-neon" size={18}/><b className="text-white">Multipla sem garantia de resultado.</b> Limite a exposicao e nunca tente recuperar perdas aumentando a stake.</div>
      </section>
      <aside className="card p-6"><p className="label">Resumo da multipla</p><div className="my-6 flex justify-center"><ConfidenceRing value={Math.round(multiple.confidence)}/></div><div className="space-y-4 border-y border-line py-5">{[["Odd total", multiple.totalOdd.toFixed(2)], ["Score medio", multiple.averageScore.toFixed(1)], ["Confianca", `${multiple.confidence.toFixed(1)}%`], ["Risco total", multiple.risk], ["Stake sugerida", `${multiple.suggestedStake.toFixed(2)} unidade`]].map(([label,value]) => <div key={label} className="flex justify-between text-xs"><span className="text-zinc-500">{label}</span><b className={label === "Odd total" ? "text-gold" : ""}>{value}</b></div>)}</div><button disabled title="BANKROLL_NOT_CONFIGURED: simulacao indisponivel sem banca configurada" className="mt-6 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-neon/40 py-3.5 text-xs font-black uppercase tracking-wider text-black opacity-70"><Calculator size={16}/> Simular retorno</button><div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-zinc-600"><Check size={12}/> Sem integracao com casas de apostas</div></aside>
    </div> : <section className="card py-16 text-center text-sm text-zinc-600">Nenhuma partida encontrada</section>}
  </>;
}
