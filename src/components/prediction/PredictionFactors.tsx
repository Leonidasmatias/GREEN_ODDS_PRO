import { ListTree } from "lucide-react";
import type { PredictionCenterViewModel } from "@/lib/predictionCenterTypes";

/**
 * Fatores que mais pesaram na decisão — `topSignals` já traduzidos pelo
 * Adapter (`typeLabel`/`sourceLabel`/`favorsLabel`/`magnitudeLabel`).
 * Este componente nunca interpreta o sinal, apenas lista o que recebeu.
 */
export function PredictionFactors({ explanation }: { explanation: PredictionCenterViewModel["explanation"] }) {
  return (
    <section className="card p-5 md:p-6" aria-labelledby="prediction-factors-heading">
      <div className="mb-5 flex items-center gap-2">
        <ListTree size={14} className="text-neon" aria-hidden="true" />
        <div>
          <p id="prediction-factors-heading" className="text-sm font-black uppercase tracking-wider">Fatores considerados</p>
          <p className="mt-1 text-[10px] text-zinc-600">{explanation.totalSignalsConsidered} sinal(is) avaliado(s) pelo modelo</p>
        </div>
      </div>
      {explanation.topSignals.length > 0 ? (
        <ul className="space-y-2">
          {explanation.topSignals.map((signal, index) => (
            <li key={`${signal.typeLabel}-${index}`} className="flex flex-col gap-2 rounded-xl border border-line bg-white/[.02] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold text-white">{signal.typeLabel}</p>
                <p className="mt-1 text-[10px] text-zinc-600">
                  {signal.sourceLabel} · {signal.favorsLabel}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[10px] font-black text-zinc-400">{signal.magnitudeLabel}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-xs text-zinc-600">Nenhum fator relevante identificado nesta previsão.</p>
      )}
    </section>
  );
}
