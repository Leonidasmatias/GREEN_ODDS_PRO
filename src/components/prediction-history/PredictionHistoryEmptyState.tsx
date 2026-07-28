import { Clock3 } from "lucide-react";

/**
 * Mesma estrutura de `PredictionEmptyState.tsx` (Sprint 6.5), com a
 * ação adicional de limpar filtros — só faz sentido aqui porque esta
 * tela é filtrável (o Prediction Center original não é).
 */
export function PredictionHistoryEmptyState({ hasActiveFilters, onClearFilters }: { hasActiveFilters: boolean; onClearFilters: () => void }) {
  return (
    <section className="card p-10 text-center" role="status">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-line bg-white/[.03] text-zinc-500">
        <Clock3 size={24} aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-xl font-black text-white">Nenhuma previsão encontrada</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
        {hasActiveFilters
          ? "Nenhuma previsão encontrada com os filtros atuais."
          : "Ainda não existem previsões persistidas para exibição."}
      </p>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-6 rounded-xl border border-line bg-white/[.03] px-5 py-3 text-xs font-black uppercase text-zinc-200"
        >
          Limpar filtros
        </button>
      )}
    </section>
  );
}
