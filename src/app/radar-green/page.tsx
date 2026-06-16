import { Crosshair, Info } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { ValueAuditSummary, ValueOpportunityTable } from "@/components/ValueOpportunityTable";
import { buildValueReport } from "@/services/valueEngine";

export const dynamic = "force-dynamic";

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

export default async function RadarPage() {
  const report = await buildValueReport();
  const validatedGreens = report.entries.filter((item) => (item.classification === "GREEN FORTE" || item.classification === "ELITE GREEN") && item.historicalSample >= 30 && item.marketSample >= 30);
  return <>
    <PageTitle eyebrow="Provider ativo" title="Radar de Odds Green" description="Mercados construidos exclusivamente a partir de odds reais persistidas do provider licenciado ativo."/>
    <ValueAuditSummary {...report.audit}/>
    <section className="card mt-6 overflow-hidden p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-neon/10 text-neon"><Crosshair size={19}/></div>
          <div>
            <b className="text-sm">{report.provider}</b>
            <p className="text-[10px] text-zinc-600">{report.gamesLoaded} jogos persistidos · {report.audit.analyzed} odds · {formatDate(report.updatedAt)}</p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-[10px] font-bold text-neon"><span className="h-2 w-2 animate-pulse rounded-full bg-neon"/> VALUE ENGINE V1</span>
      </div>
      <ValueOpportunityTable items={validatedGreens}/>
    </section>
    <div className="mt-4 flex gap-3 rounded-xl border border-line bg-white/[.02] p-4 text-xs leading-relaxed text-zinc-500">
      <Info size={17} className="shrink-0 text-neon"/> O Radar exibe somente GREEN FORTE e ELITE GREEN com historico real suficiente. Sem amostra minima liquidada, o mercado permanece INSUFFICIENT_REAL_DATA e nenhuma entrada green e forcada.
    </div>
  </>;
}
