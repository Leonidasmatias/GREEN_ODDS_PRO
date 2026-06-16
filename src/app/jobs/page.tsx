import { Activity, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { getJobMonitor } from "@/services/schedulerService";

export const dynamic = "force-dynamic";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value)) : "-";

function jobMeta(metadata: string | null) {
  if (!metadata) return "-";
  try {
    const parsed = JSON.parse(metadata) as { settlement?: { tipsProcessed?: number; tipsSettled?: number }; segmentsAnalyzed?: number; insightsGenerated?: number; risksDetected?: number; tipsBlocked?: number; adjustmentsGenerated?: number; adjustmentsApplied?: number; blockedSegments?: number; score?: number; classification?: string; alertsFound?: number; criticalCount?: number };
    if (parsed.settlement) return `${parsed.settlement.tipsProcessed ?? 0}/${parsed.settlement.tipsSettled ?? 0}`;
    if (parsed.segmentsAnalyzed != null || parsed.insightsGenerated != null) return `segments ${parsed.segmentsAnalyzed ?? 0} / insights ${parsed.insightsGenerated ?? 0}`;
    if (parsed.adjustmentsGenerated != null || parsed.adjustmentsApplied != null) return `adjust ${parsed.adjustmentsGenerated ?? 0}/${parsed.adjustmentsApplied ?? 0} / blocked ${parsed.blockedSegments ?? 0}`;
    if (parsed.score != null || parsed.alertsFound != null) return `DQ ${parsed.score ?? "-"} ${parsed.classification ?? ""} / alerts ${parsed.alertsFound ?? 0} / critical ${parsed.criticalCount ?? 0}`;
    if (parsed.risksDetected != null || parsed.tipsBlocked != null) return `risks ${parsed.risksDetected ?? 0} / blocked ${parsed.tipsBlocked ?? 0}`;
    return "-";
  } catch {
    return "-";
  }
}

export default async function JobsPage() {
  const data = await getJobMonitor();
  const cards = [
    { label: "Jobs executados", value: data.summary.executed, Icon: CheckCircle2 },
    { label: "Pendentes", value: data.summary.pending, Icon: Clock3 },
    { label: "Falhas", value: data.summary.failed, Icon: AlertTriangle },
    { label: "Tempo medio", value: `${data.summary.averageDurationMs} ms`, Icon: Activity },
  ];

  return <>
    <div className="mb-7"><p className="label mb-2 text-neon">Production operations</p><h1 className="text-3xl font-black md:text-4xl">Job Monitor</h1><p className="mt-2 text-sm text-zinc-500">Execucoes persistidas do scheduler e tempos reais de processamento.</p></div>
    <div className="grid gap-4 md:grid-cols-4">{cards.map(({ label, value, Icon }) => <div className="card p-5" key={label}><Icon className="text-neon" size={17}/><p className="label mt-4">{label}</p><strong className="mt-2 block text-2xl">{value}</strong></div>)}</div>
    <div className="card mt-4 p-4 text-xs text-zinc-500">Odds: {data.frequenciesMinutes.odds} min · Settlement: {data.frequenciesMinutes.settlement} min · Ultima sincronizacao: <b className="text-white">{date(data.summary.lastSync)}</b></div>
    <section className="card mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Job</th><th>Status</th><th>Agendado</th><th>Inicio</th><th>Fim</th><th>Duracao</th><th>Mensagem</th><th>Metricas</th></tr></thead>
          <tbody>{data.runs.map((run) => <tr key={run.id} className="border-b border-line/60"><td className="px-5 py-4 font-black">{run.name}</td><td className={run.status === "FAILED" ? "text-red-400" : "text-neon"}>{run.status}</td><td>{date(run.scheduledAt)}</td><td>{date(run.startedAt)}</td><td>{date(run.completedAt)}</td><td>{run.durationMs ?? 0} ms</td><td className="text-zinc-500">{run.message ?? "-"}</td><td className="text-zinc-500">{jobMeta(run.metadata)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
    <div className="mt-6 rounded-xl border border-line p-4 text-[11px] text-zinc-500">Operacao e metricas nao representam promessa de lucro ou garantia de green. Aposte com responsabilidade.</div>
  </>;
}
