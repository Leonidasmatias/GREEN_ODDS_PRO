"use client";

import type { PredictionQueryPage } from "@/lib/predictionApiClient";

/**
 * Consome `total/limit/offset/hasNextPage/hasPreviousPage` diretamente
 * da API — nunca recalcula `total`, nunca infere `hasNextPage` pela
 * quantidade de itens da página atual. `currentPage`/intervalo exibido
 * são puramente visuais, derivados de `offset`/`limit`.
 */
export function PredictionHistoryPagination({
  page,
  onPrevious,
  onNext,
}: {
  page: Pick<PredictionQueryPage, "total" | "limit" | "offset" | "hasNextPage" | "hasPreviousPage">;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { total, limit, offset, hasNextPage, hasPreviousPage } = page;
  const currentPage = Math.floor(offset / limit) + 1;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + limit, total);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs" aria-label="Paginação do histórico de previsões">
      <span className="text-zinc-500">
        Exibindo <b className="text-white">{rangeStart}–{rangeEnd}</b> de <b className="text-white">{total}</b> · Página {currentPage}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPreviousPage}
          className="rounded-xl border border-line bg-white/[.03] px-4 py-2 text-xs font-black uppercase text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNextPage}
          className="rounded-xl border border-line bg-white/[.03] px-4 py-2 text-xs font-black uppercase text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </nav>
  );
}
