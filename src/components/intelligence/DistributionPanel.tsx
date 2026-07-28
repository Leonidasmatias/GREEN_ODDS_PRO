import type { DistributionEntryViewModel } from "@/lib/intelligenceTypes";

/** Painel de distribuição — barras horizontais construídas com CSS (mesmo
 * padrão já estabelecido por `ScoreBar`), evitando depender de uma
 * biblioteca de gráficos apenas para esta visualização simples. Cada
 * barra expõe rótulo, código técnico e contagem em texto — nunca depende
 * apenas da cor/comprimento da barra. */
export function DistributionPanel({ title, description, entries, emptyMessage }: { title: string; description: string; entries: DistributionEntryViewModel[]; emptyMessage: string }) {
  const hasData = entries.some((entry) => entry.count > 0);

  return (
    <section className="card p-5 md:p-6" aria-labelledby={`distribution-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="mb-5">
        <p id={`distribution-${title.replace(/\s+/g, "-").toLowerCase()}`} className="text-sm font-black uppercase tracking-wider">{title}</p>
        <p className="mt-1 text-[10px] text-zinc-600">{description}</p>
      </div>
      {hasData ? (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.code}>
              <div className="mb-1.5 flex items-end justify-between gap-3 text-[11px]">
                <span className="font-bold text-zinc-300">
                  {entry.label}
                  <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-zinc-600">{entry.code}</span>
                </span>
                <strong className="text-white">
                  {entry.count}
                  <span className="ml-1 text-[9px] font-bold text-zinc-600">({entry.percentage.toFixed(1)}%)</span>
                </strong>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800" role="img" aria-label={`${entry.label}: ${entry.count} ocorrências, ${entry.percentage.toFixed(1)} por cento`}>
                <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${Math.max(entry.percentage, entry.count > 0 ? 2 : 0)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-xs text-zinc-600">{emptyMessage}</p>
      )}
    </section>
  );
}
