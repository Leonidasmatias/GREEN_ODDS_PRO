import { Activity, BrainCircuit, ShieldCheck } from "lucide-react";
import { CreatorSignature } from "@/components/CreatorSignature";
import { GreenScoreSummary, GreenScoreTable } from "@/components/GreenScoreTable";
import { StatCard } from "@/components/ui";
import { buildGreenScoreReport } from "@/services/greenScoreEngine";
import { generateModelReport } from "@/services/mlEngine";
import { getAutoDiscoveryReport } from "@/services/autoDiscoveryEngine";
import { getRiskShieldReport } from "@/services/riskShieldEngine";
import { getSmartConfidenceReport } from "@/services/smartConfidenceEngine";
import { formatDateTimeBrt } from "@/lib/timezone";
import { requireRouteAccess } from "@/services/authService";
import { limitItemsByPlan } from "@/services/subscriptionAccess";

export const dynamic = "force-dynamic";

export default async function GreenAiReportPage() {
  const context = await requireRouteAccess("/green-ai-report");
  const [green, ml, discovery, riskShield, confidence] = await Promise.all([
    buildGreenScoreReport(),
    generateModelReport(),
    getAutoDiscoveryReport(),
    getRiskShieldReport(),
    getSmartConfidenceReport(),
  ]);

  return <>
    <div className="mb-7"><p className="label mb-2 text-neon">Green AI Report</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">Green Intelligence Center</h1><p className="mt-2 max-w-3xl text-sm text-zinc-500">Relatorio auditavel do Green Score Engine integrado aos engines de valor, confianca, ML, discovery e risco.</p></div>
    <GreenScoreSummary audit={green.audit}/>
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="ML Engine" value={ml.status} detail={ml.blockReason ?? ml.modelVersion ?? "modelo real"} tone="white"/>
      <StatCard label="Confidence Engine" value={confidence.status} detail={`${confidence.sourceRows}/${confidence.minimumSample} reais`}/>
      <StatCard label="Discovery Patterns" value={discovery.status} detail={`${discovery.patternsFound} padroes`} tone="yellow"/>
      <StatCard label="Risk Shield" value={riskShield.status} detail={riskShield.reason ?? `${riskShield.tipsBlocked} bloqueios`} tone="white"/>
      <StatCard label="Gerado" value={formatDateTimeBrt(green.updatedAt)} detail={green.provider}/>
    </section>
    <section className="card mt-6 p-5">
      <div className="grid gap-5 md:grid-cols-3">
        <div><BrainCircuit className="text-neon"/><p className="mt-3 text-sm font-black uppercase tracking-wider">Score</p><p className="mt-1 text-xs text-zinc-500">Classifica 90+ ELITE_GREEN, 80-89 STRONG_GREEN, 70-79 GREEN, 60-69 WATCHLIST e abaixo disso AVOID.</p></div>
        <div><Activity className="text-gold"/><p className="mt-3 text-sm font-black uppercase tracking-wider">Dados reais</p><p className="mt-1 text-xs text-zinc-500">Sem provider mock, sem recomendacao sintetica e sem liberar mercado com engine essencial insuficiente.</p></div>
        <div><ShieldCheck className="text-cyan-200"/><p className="mt-3 text-sm font-black uppercase tracking-wider">Odds do Dia</p><p className="mt-1 text-xs text-zinc-500">Somente greenScore &gt;= 80, confidence &gt;= 80 e risk LOW, com Value aprovado, ML treinado e Risk Shield READY.</p></div>
      </div>
    </section>
    {context.plan?.code === "PRO" && <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-4 text-xs text-amber-200">Plano PRO: Green AI Report basico. Relatorio completo, Command Center e Performance Center sao PREMIUM.</div>}
    <section className="card mt-6 overflow-hidden p-5 md:p-6">
      <div className="mb-4"><p className="text-sm font-black uppercase tracking-wider">Radar auditavel</p><p className="mt-1 text-[11px] text-zinc-600">{green.audit.analyzed} odds reais avaliadas · {green.audit.oddsOfDay} Odds do Dia</p></div>
      <GreenScoreTable items={context.plan?.code === "PREMIUM" ? green.radar : limitItemsByPlan(green.radar, context.plan?.code)}/>
    </section>
    <div className="mt-6"><CreatorSignature compact/></div>
  </>;
}
