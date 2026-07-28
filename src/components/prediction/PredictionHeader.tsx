import { FlaskConical, Target } from "lucide-react";
import type { PredictionCenterSourceKind, PredictionCenterViewModel } from "@/lib/predictionCenterTypes";

/**
 * Cabeçalho de UMA previsão dentro do Prediction Center: confronto,
 * liga, versão do modelo e data de geração — todos já formatados pelo
 * Adapter. `source` só é exibido quando explicitamente recebido por
 * propriedade (nunca inferido/inventado por este componente).
 *
 * Usa `<h2>` (não `<h1>`) deliberadamente: a página do Prediction Center
 * lista N previsões, e o `<h1>` único da página pertence exclusivamente
 * a ela — cada previsão é uma subseção.
 */
export function PredictionHeader({ header, source }: { header: PredictionCenterViewModel["header"]; source?: PredictionCenterSourceKind }) {
  return (
    <div className="mb-7">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="label mb-2 flex items-center gap-2 text-neon">
            <Target size={13} aria-hidden="true" /> Previsão técnica
          </p>
          <h2 className="text-3xl font-black tracking-tight md:text-4xl">
            {header.homeTeamLabel} <span className="text-zinc-600">vs</span> {header.awayTeamLabel}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">{header.leagueLabel}</p>
        </div>
        {source === "fixture" && (
          <span
            role="status"
            aria-label="Painel exibindo dados de demonstração, não dados reais"
            className="flex items-center gap-2 self-start rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gold"
          >
            <FlaskConical size={13} aria-hidden="true" /> Dados de demonstração
          </span>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-3 text-[11px] text-zinc-500 sm:grid-cols-2">
        <div className="card px-4 py-3">
          <dt className="label">Modelo</dt>
          <dd className="mt-1 break-words font-bold text-zinc-300">{header.modelVersion}</dd>
        </div>
        <div className="card px-4 py-3">
          <dt className="label">Gerado em</dt>
          <dd className="mt-1 font-bold text-zinc-300">{header.generatedAtLabel}</dd>
        </div>
      </dl>
    </div>
  );
}
