import type { TrendGroupViewModel } from "@/lib/intelligenceTypes";

/**
 * Visão geral de tendências — representa APENAS o comportamento
 * observado na comparação entre janelas já calculada pela Sprint 5.1,
 * nunca uma previsão futura.
 */
export function TrendOverview({ trends }: { trends: TrendGroupViewModel[] }) {
  return (
    <section className="card p-5 md:p-6" aria-labelledby="trends-heading">
      <div className="mb-5">
        <p id="trends-heading" className="text-sm font-black uppercase tracking-wider">Tendências — comportamento observado</p>
        <p className="mt-1 text-[10px] text-zinc-600">Classificação baseada na comparação entre a janela anterior e a atual, sem previsão futura</p>
      </div>
      {trends.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {trends.map((group) => (
            <div key={group.trend} className="rounded-xl border border-line bg-white/[.02] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-white">
                  {group.label} <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-zinc-600">{group.trend}</span>
                </p>
                <span className="rounded-full border border-line px-2.5 py-1 text-[9px] font-black text-zinc-400">{group.count}</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{group.description}</p>
              {group.profiles.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {group.profiles.slice(0, 8).map((profile) => (
                    <li key={`${profile.dimensionLabel}-${profile.key}`} className="rounded-full bg-black/20 px-2.5 py-1 text-[9px] text-zinc-400">
                      {profile.dimensionLabel} · {profile.key}
                    </li>
                  ))}
                  {group.profiles.length > 8 && (
                    <li className="rounded-full bg-black/20 px-2.5 py-1 text-[9px] text-zinc-500">+{group.profiles.length - 8} mais</li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-xs text-zinc-600">Sem dados suficientes para classificar tendências nesta execução.</p>
      )}
    </section>
  );
}
