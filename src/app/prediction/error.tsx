"use client";

import { TriangleAlert } from "lucide-react";

/**
 * Error boundary do segmento `/prediction` (App Router). Cobre apenas
 * falhas inesperadas de renderização do segmento — o erro "normal" do
 * Service (`status: "error"`) já é tratado dentro de `page.tsx` via
 * `PredictionErrorState`, nunca chega aqui. Nunca exibe `error.message`
 * ou stack trace; nenhum `console.log`/`console.error`.
 */
export default function PredictionCenterError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="card p-6" role="alert">
      <TriangleAlert className="text-amber-300" size={24} aria-hidden="true" />
      <p className="label mt-4 text-amber-300">Prediction Center</p>
      <h1 className="mt-2 text-2xl font-black">Painel indisponível</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
        Não foi possível carregar o Prediction Center. Nenhum dado foi alterado; tente novamente em instantes.
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
