import { Crosshair } from "lucide-react";
import type { PredictionCenterViewModel } from "@/lib/predictionCenterTypes";

/**
 * Destaque do mercado de maior probabilidade segundo o modelo —
 * `bestMarket` já foi selecionado pelo Adapter (`selectBestMarket`),
 * nunca recalculado aqui. Rotulagem deliberadamente conservadora: nunca
 * "melhor aposta", "aposta garantida", "oportunidade de valor", "edge"
 * ou qualquer linguagem de recomendação financeira — o modelo não tem
 * acesso a odds reais, apenas a probabilidades próprias.
 */
export function PredictionRecommendation({ bestMarket }: { bestMarket: PredictionCenterViewModel["bestMarket"] }) {
  return (
    <section className="card p-6" aria-labelledby="prediction-recommendation-heading">
      <p className="label flex items-center gap-2 text-neon">
        <Crosshair size={13} aria-hidden="true" /> Mercado com maior probabilidade segundo o modelo
      </p>
      <h2 id="prediction-recommendation-heading" className="sr-only">
        Mercado de maior probabilidade
      </h2>
      {bestMarket ? (
        <>
          <p className="mt-3 text-2xl font-black tracking-tight text-white">{bestMarket.label}</p>
          <p className="mt-2 text-sm text-zinc-400">
            Probabilidade estimada: <b className="text-neon">{bestMarket.probabilityLabel}</b>
          </p>
          <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
            Estimativa estatística do modelo, sem relação com cotações de mercado ou análise de valor — não constitui recomendação financeira.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">Nenhum mercado com probabilidade disponível para destaque nesta previsão.</p>
      )}
    </section>
  );
}
