import { CheckCircle2, CircleX, ShieldCheck } from "lucide-react";
import { getReadinessReport } from "@/services/liveDataService";
import { getPerformanceAttributionReport } from "@/services/performanceAttributionEngine";

export const dynamic = "force-dynamic";

export default async function ReadinessPage() {
  const [data, attribution] = await Promise.all([getReadinessReport(), getPerformanceAttributionReport()]);
  const checks = [
    ...data.checks,
    { label: "Performance Attribution", ready: attribution.status === "READY", detail: `${attribution.totalTipsAnalyzed}/${attribution.minimumSample} TipResult reais WON/LOST/VOID; ${attribution.segmentsAnalyzed} segmentos.` },
  ];

  return <>
    <div className="mb-7"><p className="label mb-2 text-neon">Readiness report</p><h1 className="text-3xl font-black md:text-4xl">Prontidao para producao</h1><p className="mt-2 text-sm text-zinc-500">Avaliacao objetiva de banco, APIs, scheduler, treinamento, dataset e atribuicao de performance.</p></div>
    <div className={`card mb-6 flex items-center gap-4 p-6 ${data.ready ? "border-neon/25" : "border-amber-300/20"}`}><ShieldCheck className={data.ready ? "text-neon" : "text-amber-300"}/><div><p className="label">Status final</p><strong className="text-2xl">{data.ready ? "PRODUCAO PRONTA" : "AINDA NAO PRONTA"}</strong></div></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{checks.map((check) => <div className="card p-5" key={check.label}>{check.ready ? <CheckCircle2 className="text-neon"/> : <CircleX className="text-red-400"/>}<p className="mt-4 text-xs font-black">{check.label}</p><p className="mt-2 text-[10px] leading-relaxed text-zinc-600">{check.detail}</p></div>)}</div>
    <section className="card mt-6 overflow-hidden"><div className="border-b border-line p-5"><p className="text-sm font-black uppercase">Provedores</p></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Provider</th><th>Licenciado</th><th>Configurado</th><th>Status</th><th>Latencia</th><th>Falhas</th><th>Limite</th></tr></thead><tbody>{data.providers.map((provider) => <tr key={provider.id} className="border-b border-line/60"><td className="px-5 py-4 font-black">{provider.id}</td><td>{provider.licensed ? "Sim" : "Nao"}</td><td>{provider.configured ? "Sim" : "Nao"}</td><td>{provider.status}</td><td>{provider.latencyMs ?? "-"} ms</td><td>{provider.failures}</td><td>{provider.remainingLimit ?? "-"}</td></tr>)}</tbody></table></div></section>
    <div className="mt-6 rounded-xl border border-line p-4 text-[11px] text-zinc-500">Prontidao tecnica nao representa promessa de lucro ou green garantido. Toda previsao permanece probabilistica.</div>
  </>;
}
