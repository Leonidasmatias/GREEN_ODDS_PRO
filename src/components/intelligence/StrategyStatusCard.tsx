import { BellRing, Gauge } from "lucide-react";
import type { StrategyStatusViewModel } from "@/lib/intelligenceTypes";
import { strategyStatusStyles } from "./intelligenceStatusStyles";

export function StrategyStatusCard({ strategy }: { strategy: StrategyStatusViewModel }) {
  return (
    <section className="card p-6" aria-labelledby="strategy-status-heading">
      <div className="flex items-center justify-between">
        <p className="label flex items-center gap-2 text-neon">
          <Gauge size={13} aria-hidden="true" /> Status da estratégia
        </p>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${strategyStatusStyles[strategy.status]}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {strategy.status}
        </span>
      </div>
      <h2 id="strategy-status-heading" className="mt-4 text-2xl font-black tracking-tight text-white">
        {strategy.label}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">{strategy.description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4 text-[11px] text-zinc-500">
        <span className="flex items-center gap-2">
          <BellRing size={13} className="text-amber-300" aria-hidden="true" />
          <b className="text-white">{strategy.relatedAlertsCount}</b> alerta(s) técnico(s) associado(s)
        </span>
        <span>Relatório gerado em: <b className="text-zinc-300">{strategy.generatedAtLabel}</b></span>
      </div>
    </section>
  );
}
