type HeatmapData = Array<{ market: string; cells: Array<{ score: number; roi: number }> }>;

function cellStyle(value: number) {
  if (value >= 15) return "bg-neon/25 text-neon";
  if (value >= 5) return "bg-emerald-400/10 text-emerald-300";
  if (value >= 0) return "bg-yellow-400/10 text-yellow-300";
  if (value >= -10) return "bg-orange-400/10 text-orange-300";
  return "bg-red-500/15 text-red-400";
}

export function RoiHeatmap({ data }: { data: HeatmapData }) {
  return <section className="card overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase tracking-wider">Heatmap Mercado x Yield</p><p className="mt-1 text-[10px] text-zinc-600">EV mínimo de 5% por faixa de score</p></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Mercado</th><th className="text-center">Score 70+</th><th className="text-center">Score 80+</th><th className="text-center">Score 90+</th></tr></thead><tbody>{data.map((row) => <tr key={row.market} className="border-b border-line/60"><td className="px-5 py-3 font-bold">{row.market}</td>{row.cells.map((cell) => <td key={cell.score} className="p-1.5 text-center"><div className={`rounded-lg px-3 py-3 font-black ${cellStyle(cell.roi)}`}>{cell.roi >= 0 ? "+" : ""}{cell.roi.toFixed(1)}%</div></td>)}</tr>)}</tbody></table></div></section>;
}
