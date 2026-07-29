"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getPredictionById, PredictionApiError } from "@/lib/predictionApiClient";
import type { PredictionDetail } from "@/lib/predictionApiClient";
import { formatHashShort } from "@/lib/predictionHistoryFormatters";
import { buildPredictionCenterViewModel } from "@/adapters/predictionCenterAdapter";
import { PredictionHeader } from "@/components/prediction/PredictionHeader";
import { PredictionSummary } from "@/components/prediction/PredictionSummary";
import { PredictionConfidenceCard } from "@/components/prediction/PredictionConfidenceCard";
import { PredictionMarkets } from "@/components/prediction/PredictionMarkets";
import { PredictionRecommendation } from "@/components/prediction/PredictionRecommendation";
import { PredictionFactors } from "@/components/prediction/PredictionFactors";
import { PredictionRiskPanel } from "@/components/prediction/PredictionRiskPanel";
import { PredictionExplanationSection } from "./PredictionExplanationSection";
import { useDrawerFocusTrap } from "./useDrawerFocusTrap";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; detail: PredictionDetail };

/**
 * Drawer de detalhe — busca `PredictionDetail` sob demanda (uma única
 * chamada, ao abrir/trocar `id`), nunca antecipadamente para itens da
 * lista. Reaproveita `buildPredictionCenterViewModel` (Sprint 6.5, função
 * pura, sem dependência de backend) e os MESMOS componentes de
 * apresentação já usados por `/prediction` — nunca recalcula Green
 * Score/recomendação/risco, apenas re-renderiza o que o motor já
 * produziu, garantindo compatibilidade visual total com o Prediction
 * Center atual.
 */
export function PredictionHistoryDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const containerRef = useDrawerFocusTrap(true, onClose);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    getPredictionById(id, controller.signal)
      .then((detail) => {
        setState(detail ? { status: "success", detail } : { status: "error", message: "Previsão não encontrada." });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        const message = error instanceof PredictionApiError ? error.message : "Não foi possível carregar os detalhes desta previsão.";
        setState({ status: "error", message });
      });

    return () => controller.abort();
  }, [id]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhe da previsão"
        tabIndex={-1}
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-line bg-[#07100c] p-6 outline-none"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">Detalhe da previsão</h2>
            {state.status === "success" && (
              <p className="mt-1 text-[10px] text-zinc-600" title={state.detail.id}>ID {formatHashShort(state.detail.id)}</p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg border border-line bg-white/[.03] p-2 text-zinc-300">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {state.status === "loading" && (
          <div className="mt-6 space-y-3" role="status" aria-label="Carregando detalhe">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-white/[.03]" aria-hidden="true" />
            ))}
          </div>
        )}

        {state.status === "error" && <p role="alert" className="mt-6 text-sm text-red-400">{state.message}</p>}

        {state.status === "success" && <DetailContent detail={state.detail} />}
      </div>
    </div>
  );
}

function DetailContent({ detail }: { detail: PredictionDetail }) {
  const viewModel = buildPredictionCenterViewModel(detail.snapshot);
  return (
    <div className="mt-6 space-y-6">
      <PredictionHeader header={viewModel.header} source={detail.source} />
      <PredictionSummary scores={viewModel.scores} outcome={viewModel.outcome} predictedScore={viewModel.predictedScore} />
      <PredictionConfidenceCard confidenceContext={viewModel.confidenceContext} />
      <PredictionMarkets markets={viewModel.markets} />
      <PredictionRecommendation bestMarket={viewModel.bestMarket} />
      <PredictionFactors explanation={viewModel.explanation} />
      <PredictionRiskPanel risk={viewModel.risk} />
      <PredictionExplanationSection id={detail.id} />
    </div>
  );
}
