import { CheckCircle2, CircleX, FileCheck2, Gauge, ShieldCheck } from "lucide-react";
import { CreatorSignature } from "@/components/CreatorSignature";
import { getProductionCertificate } from "@/services/productionCertificationService";
import { formatDateTimeBrt } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function ProductionCertificatePage() {
  const data = await getProductionCertificate();
  return <>
    <div className="mb-7">
      <p className="label mb-2 text-neon">Production certification</p>
      <h1 className="text-3xl font-black md:text-4xl">Certificacao Go Live</h1>
      <p className="mt-2 text-sm text-zinc-500">Auditoria tecnica de infraestrutura, dados, providers, seguranca, jobs, backups e treinamento.</p>
    </div>
    <section className="card mb-6 grid items-center gap-6 p-7 md:grid-cols-[auto_1fr_auto]">
      <div className="grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(#45e68a ${data.productionScore}%,#1c2922 0)` }}>
        <div className="grid h-28 w-28 place-items-center rounded-full bg-panel text-center">
          <div><strong className="text-4xl">{data.productionScore}</strong><p className="label">/100</p></div>
        </div>
      </div>
      <div>
        <Gauge className="text-neon"/>
        <p className="label mt-3">Production Score</p>
        <h2 className="mt-1 text-2xl font-black">{data.classification}</h2>
        <p className="mt-2 text-xs text-zinc-500">Readiness: {data.readinessScore}/100 · gerado em {formatDateTimeBrt(data.generatedAt)}</p>
      </div>
      <ShieldCheck className={data.status === "APPROVED" ? "text-neon" : "text-amber-300"} size={44}/>
    </section>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
      {data.categories.map((category) => <div className="card p-5" key={category.name}>
        <FileCheck2 size={17} className="text-neon"/>
        <p className="label mt-4">{category.name}</p>
        <strong className="mt-2 block text-xl">{category.score}/{category.max}</strong>
      </div>)}
    </div>
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-line p-5"><p className="text-sm font-black uppercase">Checklist de certificacao</p></div>
      <div className="divide-y divide-line/60">
        {data.checklist.map((check) => <div className="flex items-center gap-3 p-4" key={check.item}>
          {check.ok ? <CheckCircle2 className="text-neon" size={17}/> : <CircleX className="text-red-400" size={17}/>}
          <div><b className="text-xs">{check.item}</b><p className="mt-1 text-[10px] text-zinc-600">{check.detail}</p></div>
        </div>)}
      </div>
    </section>
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-line p-5"><p className="text-sm font-black uppercase">Providers auditados</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Provider</th><th>Configurado</th><th>Status</th><th>Latencia</th><th>Falhas</th><th>Limite</th><th>Ultima chamada</th></tr></thead>
          <tbody>{data.providers.map((provider) => <tr key={provider.id} className="border-b border-line/60"><td className="px-5 py-4 font-black">{provider.id}</td><td>{provider.configured ? "Sim" : "Nao"}</td><td>{provider.status}</td><td>{provider.latencyMs ?? "-"} ms</td><td>{provider.failures}</td><td>{provider.remainingLimit ?? "-"}</td><td>{provider.lastCall ?? "-"}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
    <section className="card mt-6 p-5">
      <p className="text-sm font-black uppercase">Operation monitoring</p>
      <p className="mt-2 text-xs text-zinc-500">Modo OPERATION_MONITORING: {data.monitoring.enabled ? "ativo" : "inativo"} · janela: {data.monitoring.windowDays} dias · alertas: {data.monitoring.alerts.length}</p>
    </section>
    <div className="mt-6 rounded-xl border border-line p-4 text-[11px] text-zinc-500">Certificacao tecnica nao promete lucro nem green garantido. O sistema trabalha com previsoes probabilisticas e dados reais auditaveis.</div>
    <div className="mt-6"><CreatorSignature compact/></div>
  </>;
}
