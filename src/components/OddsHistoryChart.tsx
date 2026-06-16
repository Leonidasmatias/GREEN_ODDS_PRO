export function OddsHistoryChart({ values }: { values: number[] }) {
  if (!values.length) return <div className="h-20 text-[10px] text-zinc-600">Sem histórico.</div>;
  const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1;
  const points = values.map((value, index) => `${values.length === 1 ? 50 : index / (values.length - 1) * 100},${38 - (value - min) / range * 32}`).join(" ");
  return <svg viewBox="0 0 100 42" className="h-20 w-full" preserveAspectRatio="none" aria-label="Histórico de odds"><polyline points={points} fill="none" stroke="#45e68a" strokeWidth="2" vectorEffect="non-scaling-stroke"/><line x1="0" y1="38" x2="100" y2="38" stroke="#243029" strokeWidth="1"/></svg>;
}
