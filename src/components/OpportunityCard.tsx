import { ArrowUpRight, BadgeCheck } from "lucide-react";
import type { AnalyzedOpportunity } from "@/lib/types";
import { RiskBadge } from "./RiskBadge";
import { ScoreBar } from "./ScoreBar";
import { GreenBadge } from "./GreenBadge";

export function OpportunityCard({ opportunity }: { opportunity: AnalyzedOpportunity }) {
  const ev = `${opportunity.expectedValue >= 0 ? "+" : ""}${(opportunity.expectedValue * 100).toFixed(1)}%`;
  return <article className="group relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-[#151b18] to-[#0c110f] p-5 transition hover:border-neon/25"><div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-neon/[.035] blur-2xl"/><div className="relative"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 rounded-md border border-neon/20 bg-neon/10 px-2 py-1 text-[9px] font-black text-neon"><BadgeCheck size={11}/> EV+ {ev}</span><ArrowUpRight size={16} className="text-zinc-700 group-hover:text-neon"/></div><h3 className="mt-5 text-sm font-black text-white">{opportunity.game}</h3><p className="mt-1 text-[10px] text-zinc-500">{opportunity.market} · {opportunity.pick}</p><div className="my-5 flex items-end justify-between border-y border-line/70 py-4"><div><p className="label">Odd atual</p><strong className="mt-1 block text-3xl tracking-tight text-gold">{opportunity.odd.toFixed(2)}</strong></div><div className="text-right"><p className="label">Sinal</p><strong className={opportunity.signal === "Entrar" ? "mt-2 block text-xs text-neon" : "mt-2 block text-xs text-amber-300"}>{opportunity.signal}</strong></div></div><ScoreBar score={opportunity.score}/><div className="mt-4 flex items-center justify-between gap-2"><RiskBadge risk={opportunity.risk}/><GreenBadge classification={opportunity.classification}/></div></div></article>;
}
