import type { AnalyzedOpportunity } from "@/lib/types";
import { GreenBadge } from "./GreenBadge";
import { RiskBadge } from "./RiskBadge";
import { ScoreBar } from "./ScoreBar";

const pct = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;

export function TopOpportunities({ items, showPowerRating = false }: { items: AnalyzedOpportunity[]; showPowerRating?: boolean }) {
  return <div className="overflow-x-auto scrollbar-none"><table className={`w-full ${showPowerRating ? "min-w-[1020px]" : "min-w-[920px]"} text-left`}><thead><tr className="border-b border-line text-[9px] uppercase tracking-[.16em] text-zinc-600"><th className="px-5 py-4">Jogo</th><th>Mercado</th><th>Odd</th><th>EV</th><th className="min-w-28">Score</th><th>Risco</th>{showPowerRating && <th>Power Rating</th>}<th>Status</th></tr></thead><tbody>{items.length ? items.map((item) => <tr key={item.id} className="border-b border-line/70 bg-neon/[.018] text-xs last:border-0 hover:bg-neon/[.035]"><td className="px-5 py-4 font-black text-white">{item.game}</td><td><span className="block text-zinc-300">{item.market}</span><span className="text-[10px] text-zinc-600">{item.pick}</span></td><td className="font-black text-gold">{item.odd.toFixed(2)}</td><td className="font-black text-neon">{pct(item.expectedValue)}</td><td className="pr-5"><ScoreBar score={item.score} compact/></td><td><RiskBadge risk={item.risk}/></td>{showPowerRating && <td><strong className="text-sm text-white">{item.powerRating.toFixed(1)}</strong><span className="text-[9px] text-zinc-600">/100</span></td>}<td><GreenBadge classification={item.classification}/></td></tr>) : <tr><td colSpan={showPowerRating ? 8 : 7} className="px-5 py-14 text-center text-sm text-zinc-600">Nenhuma partida encontrada</td></tr>}</tbody></table></div>;
}
