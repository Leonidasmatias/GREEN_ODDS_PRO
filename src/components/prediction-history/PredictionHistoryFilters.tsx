"use client";

import { useEffect, useState } from "react";

/** Estado de UI dos filtros — nunca duplica `PredictionQueryInput`
 * inteiro: `limit` fica como texto bruto do `<select>` ("" = deixa a
 * API aplicar o próprio padrão) e `matchId`/`playerId`/`league`/`period`
 * ficam sempre como string (nunca `undefined`), convertidos para o
 * formato do Query Service só no momento da busca (`Dashboard`). */
export type PredictionHistoryFilterValues = {
  matchId: string;
  playerId: string;
  league: string;
  period: string;
  orderBy: "generatedAt" | "createdAt";
  orderDirection: "asc" | "desc";
  limit: string;
};

export const DEFAULT_FILTER_VALUES: PredictionHistoryFilterValues = {
  matchId: "",
  playerId: "",
  league: "",
  period: "",
  orderBy: "generatedAt",
  orderDirection: "desc",
  limit: "",
};

const inputClassName = "w-full rounded-xl border border-line bg-white/[.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-neon/40";
const labelClassName = "label mb-1.5 block";

/**
 * Formulário de filtros — nunca dispara requisição por tecla: só ao
 * clicar em "Aplicar filtros" (`onApply`). `initialValues` reflete a
 * URL atual; o `useEffect` abaixo ressincroniza o rascunho local quando
 * a URL muda por fora (voltar/avançar do navegador, "Limpar filtros").
 */
export function PredictionHistoryFilters({
  initialValues,
  onApply,
  onClear,
}: {
  initialValues: PredictionHistoryFilterValues;
  onApply: (values: PredictionHistoryFilterValues) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(initialValues);

  useEffect(() => {
    setDraft(initialValues);
  }, [initialValues]);

  return (
    <form
      className="card grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
      aria-label="Filtros do histórico de previsões"
    >
      <div>
        <label htmlFor="prediction-history-matchId" className={labelClassName}>Match ID</label>
        <input
          id="prediction-history-matchId"
          type="text"
          className={inputClassName}
          value={draft.matchId}
          onChange={(event) => setDraft({ ...draft, matchId: event.target.value })}
        />
      </div>
      <div>
        <label htmlFor="prediction-history-playerId" className={labelClassName}>Player ID</label>
        <input
          id="prediction-history-playerId"
          type="text"
          className={inputClassName}
          value={draft.playerId}
          onChange={(event) => setDraft({ ...draft, playerId: event.target.value })}
        />
      </div>
      <div>
        <label htmlFor="prediction-history-league" className={labelClassName}>Liga</label>
        <input
          id="prediction-history-league"
          type="text"
          className={inputClassName}
          value={draft.league}
          onChange={(event) => setDraft({ ...draft, league: event.target.value })}
        />
      </div>
      <div>
        <label htmlFor="prediction-history-period" className={labelClassName}>Período</label>
        <input
          id="prediction-history-period"
          type="text"
          className={inputClassName}
          value={draft.period}
          onChange={(event) => setDraft({ ...draft, period: event.target.value })}
        />
      </div>
      <div>
        <label htmlFor="prediction-history-orderBy" className={labelClassName}>Ordenar por</label>
        <select
          id="prediction-history-orderBy"
          className={inputClassName}
          value={draft.orderBy}
          onChange={(event) => setDraft({ ...draft, orderBy: event.target.value as PredictionHistoryFilterValues["orderBy"] })}
        >
          <option value="generatedAt">Data de geração</option>
          <option value="createdAt">Data de persistência</option>
        </select>
      </div>
      <div>
        <label htmlFor="prediction-history-orderDirection" className={labelClassName}>Direção</label>
        <select
          id="prediction-history-orderDirection"
          className={inputClassName}
          value={draft.orderDirection}
          onChange={(event) => setDraft({ ...draft, orderDirection: event.target.value as PredictionHistoryFilterValues["orderDirection"] })}
        >
          <option value="desc">Mais recente primeiro</option>
          <option value="asc">Mais antiga primeiro</option>
        </select>
      </div>
      <div>
        <label htmlFor="prediction-history-limit" className={labelClassName}>Itens por página</label>
        <select
          id="prediction-history-limit"
          className={inputClassName}
          value={draft.limit}
          onChange={(event) => setDraft({ ...draft, limit: event.target.value })}
        >
          <option value="">Padrão</option>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>
      <div className="flex items-end gap-2">
        <button type="submit" className="flex-1 rounded-xl border border-neon/30 bg-neon/10 px-4 py-2 text-xs font-black uppercase text-neon">
          Aplicar filtros
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(DEFAULT_FILTER_VALUES);
            onClear();
          }}
          className="flex-1 rounded-xl border border-line bg-white/[.03] px-4 py-2 text-xs font-black uppercase text-zinc-200"
        >
          Limpar
        </button>
      </div>
    </form>
  );
}
