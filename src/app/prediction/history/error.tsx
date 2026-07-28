"use client";

import { TriangleAlert } from "lucide-react";

/**
 * Error boundary do segmento `/prediction/history` — mesmo padrão de
 * `/prediction/error.tsx`. Nunca exibe `error.message` ou stack trace;
 * nenhum `console.log`/`console.error`.
 */
export default function PredictionHistoryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="card p-6" role="alert">
      <TriangleAlert className="text-amber-300" size={24} aria-hidden="true" />
      <p className="label mt-4 text-amber-300">Histórico de Previsões</p>
      <h1 className="mt-2 text-2xl font-black">Painel indisponível</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
        Não foi possível carregar o histórico de previsões. Nenhum dado foi alterado; tente novamente em instantes.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-xl border border-line bg-white/[.03] px-5 py-3 text-xs font-black uppercase text-zinc-200"
      >
        Tentar novamente
      </button>
    </section>
  );
}
