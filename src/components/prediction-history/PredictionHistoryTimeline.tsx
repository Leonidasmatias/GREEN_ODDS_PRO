"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getPredictionHistoryByMatch, PredictionApiError } from "@/lib/predictionApiClient";
import type { PredictionQueryPage, PredictionSummary } from "@/lib/predictionApiClient";
import { formatReportDate } from "@/lib/predictionCenterFormatters";
import { formatMatchParticipant, formatPredictionCombinedStatus, formatPredictionGreenScoreCategory, formatPredictionSource } from "@/lib/predictionHistoryFormatters";
import { greenScoreCategoryStyles } from "@/components/prediction/predictionStatusStyles";
import { resolveDataSufficiencyStyle, resolveGreenScoreStyle } from "./predictionHistoryStyles";
import { PredictionHistoryPagination } from "./PredictionHistoryPagination";
import { useDrawerFocusTrap } from "./useDrawerFocusTrap";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; page: PredictionQueryPage };

const TIMELINE_LIMIT = 10;

/**
 * Drawer de Timeline por partida — busca `GET
 * /api/predictions/match/[matchId]` (paginado), usa `PredictionSummary`
 * (nunca `PredictionDetail` por evento — evitaria N+1). A ordem devolvida
 * pela API (`generatedAt desc`, fixo) nunca é reordenada localmente; o
 * primeiro item da primeira página é sempre o mais recente, então nenhuma
 * chamada extra a `/latest` é feita.
 */
export function PredictionHistoryTimeline({
  matchId,
  onClose,
  onOpenDetail,
}: {
  matchId: string;
  onClose: () => void;
  onOpenDetail: (id: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const containerRef = useDrawerFocusTrap(true, onClose);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    getPredictionHistoryByMatch(matchId, { orderBy: "generatedAt", orderDirection: "desc", limit: TIMELINE_LIMIT, offset }, controller.signal)
      .then((page) => setState({ status: "success", page }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        const message = error instanceof PredictionApiError ? error.message : "Não foi possível carregar a Timeline desta partida.";
        setState({ status: "error", message });
      });

    return () => controller.abort();
  }, [matchId, offset]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Timeline da partida ${matchId}`}
        tabIndex={-1}
        className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-[#07100c] p-6 outline-none"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">Timeline da partida</h2>
            <p className="mt-1 text-[10px] text-zinc-600">{matchId}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg border border-line bg-white/[.03] p-2 text-zinc-300">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {state.status === "loading" && (
          <div className="mt-6 space-y-3" role="status" aria-label="Carregando Timeline">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-white/[.03]" aria-hidden="true" />
            ))}
          </div>
        )}

        {state.status === "error" && <p role="alert" className="mt-6 text-sm text-red-400">{state.message}</p>}

        {state.status === "success" && state.page.items.length === 0 && (
          <p role="status" className="mt-6 text-sm text-zinc-500">Nenhuma previsão registrada para esta partida.</p>
        )}

        {state.status === "success" && state.page.items.length > 0 && (
          <>
            <ol className="mt-6 space-y-3">
              {state.page.items.map((item, index) => (
                <TimelineEvent key={item.id} item={item} isLatest={offset === 0 && index === 0} onOpenDetail={onOpenDetail} />
              ))}
            </ol>
            <div className="mt-6">
              <PredictionHistoryPagination page={state.page} onPrevious={() => setOffset(Math.max(0, offset - TIMELINE_LIMIT))} onNext={() => setOffset(offset + TIMELINE_LIMIT)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TimelineEvent({ item, isLatest, onOpenDetail }: { item: PredictionSummary; isLatest: boolean; onOpenDetail: (id: string) => void }) {
  return (
    <li className={`card p-4 text-xs ${isLatest ? "border-neon/30" : ""}`}>
      {isLatest && <span className="label mb-2 inline-block text-neon">Mais recente</span>}
      <p className="text-zinc-400">
        <b className="text-white">{formatMatchParticipant(item.virtualTeamHome, item.homePlayerId)}</b> <span className="text-zinc-600">vs</span>{" "}
        <b className="text-white">{formatMatchParticipant(item.virtualTeamAway, item.awayPlayerId)}</b>
      </p>
      <p className="mt-1 text-zinc-500">Gerada em {formatReportDate(item.generatedAt)} · Persistida em {formatReportDate(item.createdAt)}</p>
      <p className="mt-1 text-zinc-500">{item.league ?? "-"} {item.period ? `· ${item.period}` : ""} · Modelo {item.modelVersion}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${resolveGreenScoreStyle(item.greenScoreCategory, greenScoreCategoryStyles)}`}>
          {formatPredictionGreenScoreCategory(item.greenScoreCategory)}
        </span>
        <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${resolveDataSufficiencyStyle(item.combinedStatus)}`}>
          {formatPredictionCombinedStatus(item.combinedStatus)}
        </span>
        <span className="text-[10px] uppercase text-zinc-500">{formatPredictionSource(item.source)}</span>
      </div>
      <button
        type="button"
        onClick={() => onOpenDetail(item.id)}
        className="mt-3 rounded-lg border border-line bg-white/[.03] px-3 py-2 text-[10px] font-black uppercase text-zinc-200"
      >
        Ver detalhes
      </button>
    </li>
  );
}
