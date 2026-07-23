import { Crosshair, Info } from "lucide-react";
import { PageTitle, StatCard } from "@/components/ui";
import { CreatorSignature } from "@/components/CreatorSignature";
import { GreenScoreSummary, GreenScoreTable } from "@/components/GreenScoreTable";
import { buildGreenScoreReport } from "@/services/greenScoreEngine";
import { formatDateTimeBrt } from "@/lib/timezone";
import { requireRouteAccess } from "@/services/authService";
import { limitItemsByPlan } from "@/services/subscriptionAccess";

export const dynamic = "force-dynamic";

export default async function RadarPage() {
  const context = await requireRouteAccess("/radar-green");
  const report = await buildGreenScoreReport();
  const radarItems = limitItemsByPlan(report.radar, context.plan?.code);
  const eliteAndStrong = radarItems.filter((item) => item.greenScore >= 80);

  return <>
    <PageTitle eyebrow="Green Intelligence Center" title="Radar Green" description="Score unificado com Value Engine, Confidence Engine, ML Engine, Discovery Patterns e Risk Shield, usando somente odds e resultados reais."/>
    <GreenScoreSummary audit={report.audit}/>
    <section className="mt-6 grid gap-4 sm:grid-cols-4">
      <StatCard label="Radar ativo" value={radarItems.length.toString()} detail={`plano ${context.plan?.code}`} tone="white"/>
      <StatCard label="Elite/Strong" value={eliteAndStrong.length.toString()} detail="greenScore >= 80"/>
      <StatCard label="Odds do Dia" value={report.oddsOfDay.length.toString()} detail="score/confidence/risk" tone="yellow"/>
      <StatCard label="Ultima analise" value={formatDateTimeBrt(report.updatedAt)} detail={report.provider} tone="white"/>
    </section>
    <section className="card mt-6 overflow-hidden p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-neon/10 text-neon"><Crosshair size={19}/></div>
          <div><b className="text-sm">{report.provider}</b><p className="text-[10px] text-zinc-600">{report.gamesLoaded} jogos reais persistidos · {report.audit.analyzed} odds avaliadas</p></div>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-neon">GREEN SCORE ENGINE</span>
      </div>
      <GreenScoreTable items={radarItems} empty="Nenhum mercado atingiu greenScore >= 60 com dados reais."/>
    </section>
    <div className="mt-4 flex gap-3 rounded-xl border border-line bg-white/[.02] p-4 text-xs leading-relaxed text-zinc-500">
      <Info size={17} className="shrink-0 text-neon"/> Classificacoes: 90+ ELITE_GREEN, 80-89 STRONG_GREEN, 70-79 GREEN, 60-69 WATCHLIST, 0-59 AVOID. Odds do Dia exige greenScore &gt;= 80, confidence &gt;= 80 e risk LOW.
    </div>
    <div className="mt-6"><CreatorSignature compact/></div>
  </>;
}
