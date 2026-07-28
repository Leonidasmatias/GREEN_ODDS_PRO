import { requireRouteAccess } from "@/services/authService";
import { getPredictionCenterData } from "@/services/predictionCenterService";
import { PredictionHeader } from "@/components/prediction/PredictionHeader";
import { PredictionSummary } from "@/components/prediction/PredictionSummary";
import { PredictionConfidenceCard } from "@/components/prediction/PredictionConfidenceCard";
import { PredictionMarkets } from "@/components/prediction/PredictionMarkets";
import { PredictionRecommendation } from "@/components/prediction/PredictionRecommendation";
import { PredictionFactors } from "@/components/prediction/PredictionFactors";
import { PredictionRiskPanel } from "@/components/prediction/PredictionRiskPanel";
import { PredictionEmptyState } from "@/components/prediction/PredictionEmptyState";
import { PredictionErrorState } from "@/components/prediction/PredictionErrorState";

export const dynamic = "force-dynamic";

export default async function PredictionCenterPage() {
  await requireRouteAccess("/prediction");

  const data = await getPredictionCenterData();

  if (data.status === "error") {
    return <PredictionErrorState message={data.message} />;
  }

  if (data.status === "empty") {
    return <PredictionEmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Prediction Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-500">
          Previsões técnicas geradas pelo motor de predição, com contexto de confiança e risco por partida.
        </p>
      </div>

      {data.source === "fixture" && (
        <div role="status" className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-xs font-bold text-gold">
          Dados demonstrativos gerados pelo motor de previsão.
        </div>
      )}

      {data.status === "partial" && (
        <div role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
          Algumas previsões possuem dados insuficientes ou sinais divergentes. Consulte os detalhes de confiança e risco de cada partida.
        </div>
      )}

      <div className="space-y-10">
        {data.items.map((item) => (
          <section key={item.header.matchId} aria-label={`Previsão: ${item.header.homeTeamLabel} vs ${item.header.awayTeamLabel}`} className="space-y-6 border-b border-line pb-10 last:border-b-0 last:pb-0">
            <PredictionHeader header={item.header} source={data.source} />
            <PredictionSummary scores={item.scores} outcome={item.outcome} predictedScore={item.predictedScore} />
            <PredictionConfidenceCard confidenceContext={item.confidenceContext} />
            <PredictionMarkets markets={item.markets} />
            <PredictionRecommendation bestMarket={item.bestMarket} />
            <PredictionFactors explanation={item.explanation} />
            <PredictionRiskPanel risk={item.risk} />
          </section>
        ))}
      </div>
    </div>
  );
}
