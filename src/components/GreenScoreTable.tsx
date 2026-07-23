import type { GreenScoreAudit, GreenScoreOpportunity } from "@/lib/greenScoreTypes";

const riskStyle = {
  LOW: "text-neon",
  MEDIUM: "text-amber-300",
  HIGH: "text-red-400",
  UNDEFINED: "text-zinc-500",
};

const classStyle = {
  ELITE_GREEN: "border-gold/30 bg-gold/10 text-gold",
  STRONG_GREEN: "border-neon/25 bg-neon/10 text-neon",
  GREEN: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  WATCHLIST: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  AVOID: "border-red-500/25 bg-red-500/10 text-red-400",
};

const pct = (value: number | null) => value == null ? "INSUFFICIENT_REAL_DATA" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;

export function GreenScoreSummary({ audit }: { audit: GreenScoreAudit }) {
  const cards = [
    ["Provider", audit.provider],
    ["Analisadas", audit.analyzed.toString()],
    ["Odds do Dia", audit.oddsOfDay.toString()],
    ["ELITE", audit.elite.toString()],
    ["STRONG", audit.strong.toString()],
    ["GREEN", audit.green.toString()],
    ["WATCH/AVOID", `${audit.watchlist}/${audit.avoid}`],
  ];
  const reasons = Object.entries(audit.rejectionReasons).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">{cards.map(([label, value]) => <div key={label} className="card p-4"><p className="label">{label}</p><strong className="mt-3 block text-lg text-white">{value}</strong></div>)}</div>
    {reasons.length > 0 && <div className="rounded-xl border border-line bg-white/[.02] p-4 text-[10px] text-zinc-500"><b className="mr-2 text-zinc-300">Bloqueios:</b>{reasons.map(([reason, count]) => <span key={reason} className="mr-3 inline-block">{reason}: <b className="text-white">{count}</b></span>)}</div>}
  </div>;
}

export function GreenScoreTable({ items, empty = "Nenhuma oportunidade validada no momento." }: { items: GreenScoreOpportunity[]; empty?: string }) {
  return <div className="overflow-x-auto scrollbar-none">
    <table className="w-full min-w-[1240px] text-left text-xs">
      <thead><tr className="border-b border-line text-[9px] uppercase tracking-[.15em] text-zinc-600"><th className="px-4 py-4">Jogo / Mercado</th><th>Odd</th><th>Green Score</th><th>Confidence</th><th>Risk</th><th>EV</th><th>Edge</th><th>Engines</th><th>Classificacao</th><th>Odds do Dia</th></tr></thead>
      <tbody>{items.length ? items.map((item) => <tr key={item.id} className="border-b border-line/60 transition hover:bg-white/[.025]">
        <td className="px-4 py-4"><b className="block text-white">{item.value.game}</b><span className="mt-1 block text-[10px] text-zinc-500">{item.value.market} - {item.value.selection}</span><span className="mt-1 block text-[9px] text-zinc-600">{item.value.bookmaker} · {item.value.competition}</span></td>
        <td className="font-black text-white">{item.value.odd.toFixed(2)}</td>
        <td className={item.greenScore >= 80 ? "font-black text-neon" : item.greenScore >= 60 ? "font-black text-amber-300" : "font-black text-red-400"}>{item.greenScore}/100</td>
        <td>{item.confidence}/100</td>
        <td className={`font-black ${riskStyle[item.risk]}`}>{item.risk}</td>
        <td className={(item.value.expectedValue ?? 0) > 0 ? "text-neon" : "text-red-400"}>{pct(item.value.expectedValue)}</td>
        <td className={(item.value.edge ?? 0) > 0 ? "text-neon" : "text-red-400"}>{pct(item.value.edge)}</td>
        <td><span className="block">Value: {item.engineStatus.value}</span><span className="block text-[9px] text-zinc-600">ML: {item.engineStatus.ml}</span><span className="block text-[9px] text-zinc-600">Discovery: {item.engineStatus.discovery}</span><span className="block text-[9px] text-zinc-600">Risk Shield: {item.engineStatus.riskShield}</span></td>
        <td><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${classStyle[item.classification]}`}>{item.classification}</span>{item.reasons[0] && <span className="mt-2 block max-w-[260px] text-[9px] text-zinc-600">{item.reasons.slice(0, 3).join(" · ")}</span>}</td>
        <td>{item.qualifiesOddsOfDay ? <span className="rounded-full border border-neon/25 bg-neon/10 px-2.5 py-1 text-[9px] font-black text-neon">VALIDADA</span> : <span className="text-[9px] text-zinc-600">BLOQUEADA</span>}</td>
      </tr>) : <tr><td colSpan={10} className="px-4 py-14 text-center text-sm text-zinc-600">{empty}</td></tr>}</tbody>
    </table>
  </div>;
}
