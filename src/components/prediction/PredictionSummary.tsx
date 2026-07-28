import { Gauge, ShieldCheck, Trophy } from "lucide-react";
import type { PredictionCenterViewModel } from "@/lib/predictionCenterTypes";
import { greenScoreCategoryStyles } from "./predictionStatusStyles";

/**
 * Resumo em destaque de UMA previsão: Green Score, Confidence Score,
 * resultado previsto e placar previsto — os números-chave da decisão.
 * Todo valor já chega formatado do Adapter; este componente apenas
 * organiza a apresentação.
 */
export function PredictionSummary({
  scores,
  outcome,
  predictedScore,
}: {
  scores: PredictionCenterViewModel["scores"];
  outcome: PredictionCenterViewModel["outcome"];
  predictedScore: PredictionCenterViewModel["predictedScore"];
}) {
  return (
    <section aria-label="Resumo da previsão" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <p className="label">Green Score</p>
          <ShieldCheck size={16} className="text-neon" aria-hidden="true" />
        </div>
        <p className="mt-3 break-words text-2xl font-black tracking-tight text-neon">{scores.greenScoreLabel}</p>
        <span
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${greenScoreCategoryStyles[scores.greenScoreCategory]}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {scores.greenScoreCategoryLabel}
        </span>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between">
          <p className="label">Confidence Score</p>
          <Gauge size={16} className="text-cyan-200" aria-hidden="true" />
        </div>
        <p className="mt-3 break-words text-2xl font-black tracking-tight text-cyan-200">{scores.confidenceLabel}</p>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between">
          <p className="label">Resultado previsto</p>
          <Trophy size={16} className="text-gold" aria-hidden="true" />
        </div>
        <p className="mt-3 break-words text-lg font-black tracking-tight text-white">{outcome.predictedOutcomeLabel}</p>
        <p className="mt-1 text-[10px] text-zinc-600">Probabilidade: {outcome.topProbabilityLabel}</p>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between">
          <p className="label">Placar previsto</p>
        </div>
        <p className="mt-3 break-words text-2xl font-black tracking-tight text-white">
          {predictedScore.homeGoals} <span className="text-zinc-600">x</span> {predictedScore.awayGoals}
        </p>
        <p className="mt-1 text-[10px] text-zinc-600">Probabilidade: {predictedScore.probabilityLabel}</p>
      </div>
    </section>
  );
}
