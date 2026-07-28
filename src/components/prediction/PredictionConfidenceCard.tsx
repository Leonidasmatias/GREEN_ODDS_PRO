import { CheckCircle2, TriangleAlert } from "lucide-react";
import type { PredictionCenterViewModel } from "@/lib/predictionCenterTypes";

/**
 * Contexto por trás da confiança da previsão: suficiência de dados e
 * consistência entre o motor de resultado (1X2) e o motor de gols.
 * Nunca recalcula confiança — apenas apresenta os sinais já produzidos
 * pelo Prediction Orchestrator.
 */
export function PredictionConfidenceCard({ confidenceContext }: { confidenceContext: PredictionCenterViewModel["confidenceContext"] }) {
  const Icon = confidenceContext.consistencyMatchingWinner ? CheckCircle2 : TriangleAlert;
  const tone = confidenceContext.consistencyMatchingWinner ? "text-neon" : "text-amber-300";

  return (
    <section className="card p-6" aria-labelledby="prediction-confidence-heading">
      <p className="label flex items-center gap-2 text-neon">
        <Icon size={13} className={tone} aria-hidden="true" /> Contexto de confiança
      </p>
      <h2 id="prediction-confidence-heading" className="sr-only">
        Contexto de confiança da previsão
      </h2>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-[11px] text-zinc-500 sm:grid-cols-2">
        <div className="card px-4 py-3">
          <dt className="label">Suficiência de dados</dt>
          <dd className="mt-1 font-bold text-zinc-300">{confidenceContext.dataSufficiencyLabel}</dd>
        </div>
        <div className="card px-4 py-3">
          <dt className="label">Consistência entre motores</dt>
          <dd className={`mt-1 font-bold ${tone}`}>{confidenceContext.consistencyLabel}</dd>
        </div>
      </dl>
      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
        {confidenceContext.consistencyMatchingWinner
          ? "O motor de resultado e o motor de distribuição de gols concordam quanto ao favorito desta partida."
          : "O motor de resultado e o motor de distribuição de gols divergem quanto ao favorito desta partida — considere isso ao avaliar a previsão."}
      </p>
    </section>
  );
}
