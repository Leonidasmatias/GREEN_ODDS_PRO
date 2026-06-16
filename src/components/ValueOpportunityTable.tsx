import type { ValueOpportunity } from "@/lib/valueTypes";

const pct = (value: number | null) => value == null ? "INSUFFICIENT_REAL_DATA" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
const prob = (value: number | null) => value == null ? "INSUFFICIENT_REAL_DATA" : `${(value * 100).toFixed(2)}%`;

const classificationStyle: Record<ValueOpportunity["classification"], string> = {
  "NO BET": "border-red-500/25 bg-red-500/10 text-red-400",
  WATCH: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  "GREEN FORTE": "border-neon/25 bg-neon/10 text-neon",
  "ELITE GREEN": "border-gold/30 bg-gold/10 text-gold",
  DIAMANTE: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
};

const riskStyle: Record<ValueOpportunity["risk"], string> = {
  BAIXO: "text-neon",
  MEDIO: "text-amber-300",
  ALTO: "text-red-400",
  INDEFINIDO: "text-zinc-500",
};

export function ValueOpportunityTable({ items, empty = "Nenhuma entrada green validada no momento." }: { items: ValueOpportunity[]; empty?: string }) {
  return <div className="overflow-x-auto scrollbar-none">
    <table className="w-full min-w-[1420px] text-left text-xs">
      <thead><tr className="border-b border-line text-[9px] uppercase tracking-[.15em] text-zinc-600"><th className="px-4 py-4">Jogo / Mercado</th><th>Odd</th><th>Implicita</th><th>Margem</th><th>Fair odd</th><th>Prob. estimada</th><th>Edge</th><th>EV</th><th>Confianca</th><th>Amostra real</th><th>ROI real</th><th>Risco</th><th>Score</th><th>Classificacao</th></tr></thead>
      <tbody>{items.length ? items.map((item) => <tr key={item.id} className="border-b border-line/60 transition hover:bg-white/[.025]">
        <td className="px-4 py-4"><b className="block text-white">{item.game}</b><span className="mt-1 block text-[10px] text-zinc-500">{item.market} - {item.selection}</span><span className="mt-1 block text-[9px] text-zinc-600">{item.bookmaker}</span></td>
        <td className="font-black text-white">{item.odd.toFixed(2)}</td>
        <td>{prob(item.impliedProbability)}</td>
        <td>{pct(item.bookmakerMargin)}</td>
        <td>{item.fairOdd.toFixed(2)}</td>
        <td className={item.estimatedProbability == null ? "text-amber-300" : "text-neon"}>{prob(item.estimatedProbability)}<span className="mt-1 block text-[9px] text-zinc-600">{item.modelStatus === "READY" ? `ML ${item.modelConfidenceScore?.toFixed(0) ?? 0}` : item.modelStatus ?? item.probabilitySource}</span></td>
        <td className={(item.edge ?? 0) > 0 ? "font-black text-neon" : item.edge == null ? "text-amber-300" : "text-red-400"}>{pct(item.edge)}</td>
        <td className={(item.expectedValue ?? 0) > 0 ? "font-black text-neon" : item.expectedValue == null ? "text-amber-300" : "text-red-400"}>{pct(item.expectedValue)}</td>
        <td>{item.confidence}%</td>
        <td><span className="block font-black text-white">{item.marketSample}</span><span className="text-[9px] text-zinc-600">{item.discoveryBlockReason ?? item.smartConfidenceStatus ?? item.settlementBlockReason ?? "OK"}</span>{item.smartConfidenceScore != null && <span className="mt-1 block text-[9px] text-cyan-200">Conf {item.smartConfidenceScore.toFixed(0)} · n={item.smartConfidenceSampleSize ?? 0}</span>}</td>
        <td className={(item.marketRoi ?? 0) > 0 ? "text-neon" : "text-zinc-500"}>{item.marketRoi == null ? "INSUFFICIENT_REAL_DATA" : `${item.marketRoi.toFixed(2)}%`}</td>
        <td className={`font-black ${riskStyle[item.risk]}`}>{item.risk}</td>
        <td>{item.score}/100</td>
        <td><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${classificationStyle[item.classification]}`}>{item.classification}</span></td>
      </tr>) : <tr><td colSpan={14} className="px-4 py-14 text-center text-sm text-zinc-600">{empty}</td></tr>}</tbody>
    </table>
  </div>;
}

export function ValueAuditSummary({ analyzed, approved, rejected, watch, insufficientRealData, tipsCreated, provider, rejectionReasons }: { analyzed: number; approved: number; rejected: number; watch: number; insufficientRealData: number; tipsCreated?: number; provider: string; rejectionReasons?: Record<string, number> }) {
  const rows = [
    ["Provider", provider],
    ["Odds analisadas", analyzed.toString()],
    ["Aprovadas", approved.toString()],
    ["Tips PENDING", String(tipsCreated ?? 0)],
    ["Rejeitadas", rejected.toString()],
    ["Watch", watch.toString()],
    ["Historico insuficiente", insufficientRealData.toString()],
  ];
  const reasons = Object.entries(rejectionReasons ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">{rows.map(([label, value]) => <div key={label} className="card p-4"><p className="label">{label}</p><strong className="mt-3 block text-lg text-white">{value}</strong></div>)}</div>
    {reasons.length > 0 && <div className="rounded-xl border border-line bg-white/[.02] p-4 text-[10px] text-zinc-500"><b className="mr-2 text-zinc-300">Motivos de rejeicao:</b>{reasons.map(([reason, count]) => <span key={reason} className="mr-3 inline-block">{reason}: <b className="text-white">{count}</b></span>)}</div>}
  </div>;
}
