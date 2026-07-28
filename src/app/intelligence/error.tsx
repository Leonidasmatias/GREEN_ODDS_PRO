"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function IntelligenceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("INTELLIGENCE_DASHBOARD_ERROR", error.message);
  }, [error]);

  return (
    <section className="card p-6" role="alert">
      <TriangleAlert className="text-amber-300" size={24} aria-hidden="true" />
      <p className="label mt-4 text-amber-300">Intelligence Center</p>
      <h1 className="mt-2 text-2xl font-black">Painel indisponível</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
        Não foi possível carregar o relatório de observabilidade. Nenhum dado foi alterado; tente novamente em instantes.
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
