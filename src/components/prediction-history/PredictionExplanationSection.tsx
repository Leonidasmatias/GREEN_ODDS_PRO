"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { getPredictionExplanation, PredictionApiError } from "@/lib/predictionApiClient";
import type { PredictionExplanationView } from "@/lib/predictionApiClient";
import {
  formatConfidenceBreakdownCategory,
  formatPredictionQualityGrade,
  formatPredictionRiskCode,
  formatPredictionRiskSeverity,
} from "@/lib/predictionExplanationFormatters";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; explanation: PredictionExplanationView };

const RISK_SEVERITY_STYLES: Record<string, string> = {
  LOW: "border-line bg-white/[.03] text-zinc-400",
  MEDIUM: "border-amber-300/25 bg-amber-300/10 text-amber-300",
  HIGH: "border-red-500/25 bg-red-500/10 text-red-400",
};

const QUALITY_GRADE_STYLES: Record<string, string> = {
  A_PLUS: "border-neon/25 bg-neon/10 text-neon",
  A: "border-neon/25 bg-neon/10 text-neon",
  B_PLUS: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  B: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  C: "border-amber-300/25 bg-amber-300/10 text-amber-300",
  D: "border-red-500/25 bg-red-500/10 text-red-400",
};

/**
 * "Por que esta previsão?" — Sprint 9.0. Busca sob demanda, independente
 * do restante do drawer de detalhe (loading próprio, nunca bloqueia as
 * seções já existentes). Nunca recalcula nada — apenas apresenta o que
 * `GET /api/predictions/[id]/explanation` já devolve.
 */
export function PredictionExplanationSection({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    getPredictionExplanation(id, controller.signal)
      .then((explanation) => {
        setState(explanation ? { status: "success", explanation } : { status: "error", message: "Explicação não disponível para esta previsão." });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        const message = error instanceof PredictionApiError ? error.message : "Não foi possível carregar a explicação desta previsão.";
        setState({ status: "error", message });
      });

    return () => controller.abort();
  }, [id]);

  return (
    <section className="card p-5 md:p-6" aria-labelledby="prediction-explanation-heading">
      <div className="mb-5 flex items-center gap-2">
        <Lightbulb size={14} className="text-neon" aria-hidden="true" />
        <p id="prediction-explanation-heading" className="text-sm font-black uppercase tracking-wider">Por que esta previsão?</p>
      </div>

      {state.status === "loading" && (
        <div className="space-y-3" role="status" aria-label="Carregando explicação">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-8 animate-pulse rounded-lg bg-white/[.03]" aria-hidden="true" />
          ))}
        </div>
      )}

      {state.status === "error" && <p role="alert" className="text-xs text-red-400">{state.message}</p>}

      {state.status === "success" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-xl border border-line bg-white/[.02] p-4">
            <p className="text-xs font-bold text-zinc-400">Qualidade da previsão</p>
            <span className={`rounded-lg border px-3 py-1 text-sm font-black ${QUALITY_GRADE_STYLES[state.explanation.quality.grade]}`}>
              {formatPredictionQualityGrade(state.explanation.quality.grade)}
            </span>
          </div>

          <div>
            <p className="label mb-3">Razões</p>
            {state.explanation.reasons.length > 0 ? (
              <ol className="space-y-2">
                {state.explanation.reasons.map((reason) => (
                  <li key={reason.rank} className="flex items-start gap-2 text-xs text-zinc-300">
                    <span className="mt-0.5 shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[9px] font-black text-zinc-500">{reason.rank}</span>
                    <span>{reason.text}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-zinc-600">Nenhuma razão de destaque identificada.</p>
            )}
          </div>

          <div>
            <p className="label mb-3">Breakdown da confiança</p>
            <div className="space-y-2">
              {state.explanation.confidenceBreakdown.map((item) => (
                <div key={item.category} className="flex items-center gap-3 text-xs">
                  <span className="w-32 shrink-0 text-zinc-400">{formatConfidenceBreakdownCategory(item.category)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[.05]">
                    <div className="h-full rounded-full bg-neon/60" style={{ width: `${item.percentage}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right font-bold text-white">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="label mb-3">Indicadores de risco</p>
            {state.explanation.risks.length > 0 ? (
              <ul className="space-y-2">
                {state.explanation.risks.map((risk) => (
                  <li key={risk.code} className={`rounded-xl border p-3 text-xs ${RISK_SEVERITY_STYLES[risk.severity]}`}>
                    <div className="flex items-center justify-between">
                      <b>{formatPredictionRiskCode(risk.code)}</b>
                      <span className="text-[10px] font-black uppercase">{formatPredictionRiskSeverity(risk.severity)}</span>
                    </div>
                    <p className="mt-1 text-zinc-400">{risk.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-600">Nenhum risco relevante identificado.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
