import { FlaskConical, Telescope } from "lucide-react";
import type { IntelligenceDashboardViewModel } from "@/lib/intelligenceTypes";
import type { IntelligenceSourceKind } from "@/lib/intelligenceTypes";
import { StrategyStatusBadge } from "./StrategyStatusBadge";

export function IntelligenceHeader({ header, strategy, source }: { header: IntelligenceDashboardViewModel["header"]; strategy: IntelligenceDashboardViewModel["strategy"]; source: IntelligenceSourceKind }) {
  return (
    <div className="mb-7">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="label mb-2 flex items-center gap-2 text-neon">
            <Telescope size={13} aria-hidden="true" /> Green Odds Intelligence Center
          </p>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Green Odds Intelligence Center</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">
            Monitoramento técnico de predição, aprendizado, adaptação e observabilidade
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {source === "fixture" && (
            <span
              role="status"
              aria-label="Painel exibindo dados de demonstração, não dados reais"
              className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gold"
            >
              <FlaskConical size={13} aria-hidden="true" /> Dados de demonstração
            </span>
          )}
          <StrategyStatusBadge status={strategy.status} label={strategy.label} />
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-3 text-[11px] text-zinc-500 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <dt className="label">Relatório gerado em</dt>
          <dd className="mt-1 font-bold text-zinc-300">{header.generatedAtLabel}</dd>
        </div>
        <div className="card px-4 py-3">
          <dt className="label">Modelo</dt>
          <dd className="mt-1 break-words font-bold text-zinc-300">{header.modelVersion}</dd>
        </div>
        <div className="card px-4 py-3">
          <dt className="label">Identificador do relatório</dt>
          <dd className="mt-1 break-words font-bold text-zinc-300">{header.reportId}</dd>
        </div>
      </dl>
    </div>
  );
}
