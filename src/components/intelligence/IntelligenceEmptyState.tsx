import { Telescope } from "lucide-react";

export function IntelligenceEmptyState() {
  return (
    <section className="card p-10 text-center" role="status">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-line bg-white/[.03] text-zinc-500">
        <Telescope size={24} aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-xl font-black text-white">Sem dados suficientes</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
        Ainda não existem dados suficientes para gerar o painel de inteligência.
      </p>
    </section>
  );
}
