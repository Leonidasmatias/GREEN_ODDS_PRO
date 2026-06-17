"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function CommandCenterError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("COMMAND_CENTER_ERROR", error.message);
  }, [error]);

  return <section className="card p-6">
    <TriangleAlert className="text-amber-300" size={24}/>
    <p className="label mt-4 text-amber-300">Command Center</p>
    <h1 className="mt-2 text-2xl font-black">PENDING_RESULTS</h1>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">Nao foi possivel renderizar o painel operacional agora. Nenhum dado mock foi criado; tente atualizar ou aguarde a proxima sincronizacao real.</p>
    <button onClick={reset} className="mt-6 rounded-xl border border-line bg-white/[.03] px-5 py-3 text-xs font-black uppercase text-zinc-200">Tentar novamente</button>
  </section>;
}
