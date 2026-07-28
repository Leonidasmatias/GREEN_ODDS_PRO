import { TriangleAlert } from "lucide-react";
import type { PredictionCenterViewModel } from "@/lib/predictionCenterTypes";
import { predictionRiskLevelStyles } from "./predictionStatusStyles";

/**
 * Risco DESTA previsão (partida específica) — derivado por
 * `classifyPredictionRisk` no Adapter a partir de `quality`/`warnings`
 * já calculados. Distinto do risco agregado por PERFIL da Observability
 * (Sprint 5.3): os dois conceitos não se cruzam nesta sprint.
 */
export function PredictionRiskPanel({ risk }: { risk: PredictionCenterViewModel["risk"] }) {
  return (
    <section className="card p-5 md:p-6" aria-labelledby="prediction-risk-heading">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p id="prediction-risk-heading" className="text-sm font-black uppercase tracking-wider">Risco da previsão desta partida</p>
          <p className="mt-1 text-[10px] text-zinc-600">Não deve ser confundido com o risco agregado por perfil histórico do Intelligence Center</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${predictionRiskLevelStyles[risk.level]}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {risk.label}
        </span>
      </div>
      {risk.reasons.length > 0 ? (
        <ul className="space-y-2">
          {risk.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2 rounded-xl border border-line bg-white/[.02] p-3 text-xs text-zinc-400">
              <TriangleAlert size={13} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
              {reason}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-xs text-zinc-600">Nenhum motivo de risco identificado nesta previsão.</p>
      )}
    </section>
  );
}
