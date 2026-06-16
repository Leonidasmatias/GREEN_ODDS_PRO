import { CheckCircle2, CircleX, Database, Gauge, Radio, ShieldCheck, Timer, Trophy } from "lucide-react";
import { runProductionAudit } from "@/services/goLiveService";
import { getPerformanceAttributionReport } from "@/services/performanceAttributionEngine";
import { getAdaptiveStrategyReport } from "@/services/adaptiveStrategyEngine";
import { getDataQualityReport } from "@/services/dataQualityEngine";

export const dynamic = "force-dynamic";

export default async function GoLivePage() {
  const [data, attribution, adaptive, dataQuality] = await Promise.all([runProductionAudit(), getPerformanceAttributionReport(), getAdaptiveStrategyReport(), getDataQualityReport()]);
  const cards = [
    { label: "Banco PostgreSQL", value: data.databasePlatform, Icon: Database },
    { label: "Mock desativado", value: data.mockProviderDisabled ? "SIM" : "NAO", Icon: ShieldCheck },
    { label: "Provider real", value: data.providers.some((provider) => provider.licensed && provider.configured) ? "SIM" : "NAO", Icon: Radio },
    { label: "Scheduler ativo", value: data.schedulerActive ? "SIM" : "NAO", Icon: Timer },
    { label: "Dataset size", value: data.datasetSize, Icon: Trophy },
    { label: "Tips liquidadas", value: data.settledTips, Icon: CheckCircle2 },
    { label: "Attribution", value: attribution.status, Icon: Trophy },
    { label: "Segmentos", value: attribution.segmentsAnalyzed, Icon: CheckCircle2 },
    { label: "Adaptive", value: adaptive.status, Icon: ShieldCheck },
    { label: "Ajustes", value: adaptive.adjustmentsApplied, Icon: Timer },
    { label: "Data Quality", value: dataQuality.classification, Icon: ShieldCheck },
    { label: "DQ Score", value: dataQuality.score, Icon: Gauge },
  ];

  return <>
    <div className="mb-7"><p className="label mb-2 text-neon">Production checklist</p><h1 className="text-3xl font-black md:text-4xl">Go Live Preparation</h1><p className="mt-2 text-sm text-zinc-500">Auditoria objetiva do ambiente antes da operacao real.</p></div>
    <section className="card mb-6 grid items-center gap-6 p-7 md:grid-cols-[auto_1fr]"><div className="grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(#45e68a ${data.score}%,#1c2922 0)` }}><div className="grid h-28 w-28 place-items-center rounded-full bg-panel text-center"><div><strong className="text-4xl">{data.score}</strong><p className="label">/100</p></div></div></div><div><Gauge className="text-neon"/><p className="label mt-3">Readiness Score</p><h2 className="mt-1 text-2xl font-black">{data.classification}</h2><p className="mt-2 text-xs text-zinc-500">Health: {data.healthStatus} - atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(data.generatedAt))}</p></div></section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{cards.map(({ label, value, Icon }) => <div className="card p-5" key={label}><Icon size={17} className="text-neon"/><p className="label mt-4">{label}</p><strong className="mt-2 block text-xl">{value}</strong></div>)}</div>
    <section className="card mt-6 p-5"><p className="text-sm font-black uppercase">Performance Attribution</p><p className="mt-2 text-xs text-zinc-500">{attribution.totalTipsAnalyzed}/{attribution.minimumSample} TipResult reais analisados. Status: <b className="text-white">{attribution.status}</b>.</p></section>
    <section className="card mt-6 p-5"><p className="text-sm font-black uppercase">Adaptive Strategy</p><p className="mt-2 text-xs text-zinc-500">{adaptive.totalTipsAnalyzed}/{adaptive.minimumSample} TipResult reais analisados. Ajustes aplicados: <b className="text-white">{adaptive.adjustmentsApplied}</b>.</p></section>
    <section className="card mt-6 p-5"><p className="text-sm font-black uppercase">Data Quality</p><p className="mt-2 text-xs text-zinc-500">Score {dataQuality.score}/100 ({dataQuality.classification}). Alertas: <b className="text-white">{dataQuality.alertsFound}</b>. Nenhum dado e corrigido automaticamente.</p></section>
    <section className="card mt-6 p-5"><p className="text-sm font-black uppercase">Composicao do score</p><div className="mt-5 space-y-4">{data.categories.map((category) => <div key={category.name}><div className="mb-2 flex justify-between text-xs"><b>{category.name}</b><span>{category.score}/{category.max}</span></div><div className="h-2 rounded-full bg-zinc-900"><div className="h-full rounded-full bg-neon" style={{ width: `${category.score / category.max * 100}%` }}/></div></div>)}</div></section>
    <section className="card mt-6 overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase">Checklist completo</p></div><div className="divide-y divide-line/60">{data.checklist.map((check) => <div className="flex items-center gap-3 p-4" key={check.item}>{check.ok ? <CheckCircle2 className="text-neon" size={17}/> : <CircleX className="text-red-400" size={17}/>}<div><b className="text-xs">{check.item}</b><p className="mt-1 text-[10px] text-zinc-600">{check.detail}</p></div></div>)}</div></section>
    <div className="mt-6 rounded-xl border border-line p-4 text-[11px] text-zinc-500">Prontidao tecnica nao promete lucro nem garante green. Previsoes continuam probabilisticas e exigem gestao responsavel.</div>
  </>;
}
