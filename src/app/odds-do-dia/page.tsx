import { ShieldCheck, SlidersHorizontal } from "lucide-react";
import { PageTitle, StatCard } from "@/components/ui";
import { CreatorSignature } from "@/components/CreatorSignature";
import { GreenScoreSummary, GreenScoreTable } from "@/components/GreenScoreTable";
import { buildGreenScoreReport } from "@/services/greenScoreEngine";
import { formatDateTimeBrt } from "@/lib/timezone";
import { requireRouteAccess } from "@/services/authService";
import { limitItemsByPlan } from "@/services/subscriptionAccess";

export const dynamic = "force-dynamic";

export default async function OddsTodayPage() {
  const context = await requireRouteAccess("/odds-do-dia");
  const report = await buildGreenScoreReport();
  const oddsOfDay = limitItemsByPlan(report.oddsOfDay, context.plan?.code);

  return <>
    <PageTitle eyebrow="Criterios oficiais" title="Odds do Dia" description="Lista final liberada apenas quando greenScore >= 80, confidence >= 80 e risk LOW." action={<a href="#auditoria-odds" className="flex items-center gap-2 rounded-xl border border-line bg-white/[.03] px-5 py-3 text-xs font-bold"><SlidersHorizontal size={15}/> Ver filtros</a>}/>
    <GreenScoreSummary audit={report.audit}/>
    {report.warning && <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-4 text-xs text-amber-200">{report.warning}</div>}
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <StatCard label="Odds validadas" value={oddsOfDay.length.toString()} detail={`plano ${context.plan?.code}`}/>
      <StatCard label="Provider" value={report.provider} detail="sem mock" tone="white"/>
      <StatCard label="Jogos monitorados" value={report.gamesLoaded.toString()} detail="odds persistidas" tone="yellow"/>
      <StatCard label="Atualizado" value={formatDateTimeBrt(report.updatedAt)} detail="Green Intelligence"/>
    </section>
    <section id="auditoria-odds" className="card mt-6 p-5">
      <div className="flex items-center gap-3"><ShieldCheck className="text-neon"/><div><p className="text-sm font-black uppercase tracking-wider">Filtro aplicado</p><p className="mt-1 text-xs text-zinc-500">greenScore &gt;= 80 · confidence &gt;= 80 · risk LOW · Value aprovado · ML treinado · Discovery sem padrao negativo · Risk Shield READY.</p></div></div>
    </section>
    <section className="card mt-6 overflow-hidden p-5 md:p-6">
      <div className="mb-4"><p className="text-sm font-black uppercase tracking-wider">Odds do Dia validadas</p><p className="mt-1 text-[11px] text-zinc-600">Nenhuma recomendacao e gerada com mock ou amostra insuficiente.</p></div>
      <GreenScoreTable items={oddsOfDay} empty="Nenhuma Odd do Dia validada pelos criterios oficiais."/>
    </section>
    <div className="mt-6"><CreatorSignature compact/></div>
  </>;
}
