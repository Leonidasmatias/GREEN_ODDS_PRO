import type { AnalyzedOpportunity } from "@/lib/types";
import { RiskBadge } from "./RiskBadge";
import { ScoreBar } from "./ScoreBar";
import { GreenBadge } from "./GreenBadge";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function MarketTable({ items, compact = false }: { items: AnalyzedOpportunity[]; compact?: boolean }) {
  const visibleItems = compact ? items.slice(0, 4) : items;

  return (
    <div className="overflow-x-auto scrollbar-none">
      <table className="w-full min-w-[1160px] text-left">
        <thead><tr className="border-b border-line text-[9px] uppercase tracking-[.15em] text-zinc-600"><th className="px-4 py-4">Jogo / Entrada</th><th>Odd</th><th>Implícita</th><th>Estimativa</th><th>Edge</th><th>EV</th><th>Risco</th><th className="min-w-28">Score</th><th>Power</th><th>Classificação</th><th>Sinal</th></tr></thead>
        <tbody>{visibleItems.map((item) => {
          const positiveEV = item.expectedValue > 0;
          const signalStyle = item.signal === "Entrar" ? "text-neon" : item.signal === "Aguardar" ? "text-amber-300" : "text-red-400";
          return <tr key={item.id} className={`border-b border-line/60 text-xs transition hover:bg-white/[.025] ${positiveEV ? "bg-neon/[.025]" : ""}`}>
            <td className="px-4 py-4"><b className="block text-white">{item.game}</b><span className="mt-1 block text-[10px] text-zinc-500">{item.market} · {item.pick}</span></td>
            <td className="font-black text-white">{item.odd.toFixed(2)}</td>
            <td className="text-zinc-400">{pct(item.impliedProbability)}</td>
            <td className="font-bold text-neon">{pct(item.fairProbability)}</td>
            <td className={item.edge > 0 ? "font-bold text-neon" : "text-red-400"}>{item.edge > 0 ? "+" : ""}{pct(item.edge)}</td>
            <td className={positiveEV ? "font-black text-neon" : "font-bold text-red-400"}>{positiveEV ? "+" : ""}{pct(item.expectedValue)}</td>
            <td><RiskBadge risk={item.risk}/></td>
            <td className="pr-5"><ScoreBar score={item.score} compact/></td>
            <td><strong className="text-white">{item.powerRating.toFixed(0)}</strong><span className="text-[9px] text-zinc-600">/100</span></td>
            <td><GreenBadge classification={item.classification}/></td>
            <td><span className={`font-black ${signalStyle}`}>{item.signal}</span></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}
