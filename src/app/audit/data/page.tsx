import { CheckCircle2, CircleX, Database } from "lucide-react";
import { getDataAudit } from "@/services/productionCertificationService";

export const dynamic = "force-dynamic";

export default async function DataAuditPage() {
  const data = await getDataAudit();
  return <>
    <div className="mb-7">
      <p className="label mb-2 text-neon">Auditoria de dados</p>
      <h1 className="text-3xl font-black md:text-4xl">Data Integrity Audit</h1>
      <p className="mt-2 text-sm text-zinc-500">Verifica se tips, resultados e dataset foram gerados apenas a partir de registros reais.</p>
    </div>
    <section className="card mb-6 flex items-center gap-4 p-6">
      <Database className={data.status === "APPROVED" ? "text-neon" : "text-red-400"}/>
      <div>
        <p className="label">Status</p>
        <strong className="text-2xl">{data.status === "APPROVED" ? "DADOS APROVADOS" : "RISCO EM DADOS"}</strong>
        <p className="mt-1 text-[11px] text-zinc-600">Ambiente production: {data.production ? "sim" : "nao"}</p>
      </div>
    </section>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {data.checks.map((check) => <div className="card p-5" key={check.item}>
        {check.ok ? <CheckCircle2 className="text-neon"/> : <CircleX className="text-red-400"/>}
        <p className="mt-4 text-xs font-black">{check.item}</p>
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">{check.detail}</p>
      </div>)}
    </div>
    <section className="card mt-6 p-5">
      <p className="text-sm font-black uppercase">Resumo tecnico</p>
      <div className="mt-4 grid gap-3 text-xs md:grid-cols-4">
        <span>Matches mock: <b>{data.summary.mockMatches}</b></span>
        <span>Snapshots mock: <b>{data.summary.mockSnapshots}</b></span>
        <span>Tips mock: <b>{data.summary.tipsOnMockMatches}</b></span>
        <span>Dataset: <b>{data.summary.datasetRows}</b></span>
      </div>
    </section>
    <div className="mt-6 rounded-xl border border-line p-4 text-[11px] text-zinc-500">Este relatorio nao cria historico, resultados ou performance sintetica. Previsoes permanecem probabilisticas e nao garantem lucro.</div>
  </>;
}
