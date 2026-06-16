import { ArrowUpRight, Clock3 } from "lucide-react";
import type { AnalyzedOpportunity } from "@/lib/types";
import { RiskBadge } from "./RiskBadge";
import { ScoreBar } from "./ScoreBar";

const percent = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;

export function OddCard({ opportunity }: { opportunity: AnalyzedOpportunity }) {
  const positiveEV = opportunity.expectedValue > 0;
  const signalStyle = opportunity.signal === "Entrar" ? "text-neon" : opportunity.signal === "Aguardar" ? "text-amber-300" : "text-red-400";

  return (
    <article className={`group rounded-2xl border p-5 transition hover:-translate-y-0.5 ${positiveEV ? "border-neon/25 bg-gradient-to-br from-neon/[.08] to-panel shadow-glow" : "border-line bg-panel"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-zinc-600"><Clock3 size={11}/> Copa 2026</div>
          <h3 className="truncate text-sm font-black text-white">{opportunity.game}</h3>
          <p className="mt-1 truncate text-[11px] text-zinc-500">{opportunity.market} · {opportunity.pick}</p>
        </div>
        <ArrowUpRight size={17} className="shrink-0 text-zinc-700 transition group-hover:text-neon" />
      </div>
      <div className="my-5 grid grid-cols-3 gap-2">
        <div><p className="label">Odd</p><strong className="mt-1 block text-xl">{opportunity.odd.toFixed(2)}</strong></div>
        <div><p className="label">EV</p><strong className={`mt-1 block text-xl ${positiveEV ? "text-neon" : "text-red-400"}`}>{percent(opportunity.expectedValue)}</strong></div>
        <div><p className="label">Sinal</p><strong className={`mt-2 block text-xs ${signalStyle}`}>{opportunity.signal}</strong></div>
      </div>
      <ScoreBar score={opportunity.score} />
      <div className="mt-4 flex items-center justify-between"><RiskBadge risk={opportunity.risk}/><span className="text-[10px] text-zinc-600">Confiança {opportunity.confidence}%</span></div>
    </article>
  );
}
