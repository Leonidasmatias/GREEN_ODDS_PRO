"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CopyCheck, Database, FileCheck2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";

type AuditData = {
  summary: { snapshots: number; settlements: number; failedSyncs: number; duplicatesAvoided: number; matches: number; tips: number; datasetRows: number; databaseIntegrity: string };
  logs: Array<{ id: string; category: string; status: string; message: string; metadata: string | null; createdAt: string }>;
  checkedAt: string;
  error?: string;
};

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

export function AuditDashboard({ initialData }: { initialData: AuditData }) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() { setRefreshing(true); try { const response = await fetch("/api/audit", { cache: "no-store" }); setData(await response.json() as AuditData); } finally { setRefreshing(false); } }
  useEffect(() => { const timer = window.setInterval(refresh, 60_000); return () => window.clearInterval(timer); }, []);
  const cards = [
    ["Snapshots coletados", data.summary.snapshots, Database, "text-gold"], ["Liquidações executadas", data.summary.settlements, FileCheck2, "text-neon"], ["Falhas de sincronização", data.summary.failedSyncs, TriangleAlert, data.summary.failedSyncs ? "text-red-400" : "text-neon"], ["Duplicidades evitadas", data.summary.duplicatesAvoided, CopyCheck, "text-neon"], ["Partidas no banco", data.summary.matches, CheckCircle2, "text-white"], ["Tips registradas", data.summary.tips, ShieldCheck, "text-white"], ["Linhas para ML", data.summary.datasetRows, Database, "text-gold"], ["Integridade do banco", data.summary.databaseIntegrity, ShieldCheck, data.summary.databaseIntegrity === "ÍNTEGRO" ? "text-neon" : "text-red-400"],
  ] as const;
  return <>
    <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="label mb-2 text-neon">Auditoria completa</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">Integridade operacional</h1><p className="mt-2 max-w-2xl text-sm text-zinc-500">Rastreabilidade de sincronizações, liquidações, prevenção de duplicidade e preparação do dataset.</p></div><button onClick={refresh} className="flex items-center gap-2 rounded-xl border border-line bg-white/[.03] px-4 py-3 text-[10px] font-black uppercase"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""}/>Executar auditoria</button></div>
    {data.error && <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/[.05] p-4 text-xs text-red-300">{data.error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,Icon,tone]) => <div className="card p-5" key={label}><div className="flex items-center justify-between"><p className="label">{label}</p><Icon size={16} className={tone}/></div><strong className={`mt-4 block text-2xl ${tone}`}>{value}</strong></div>)}</div>
    <section className="card mt-6 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5"><div><p className="text-sm font-black uppercase tracking-wider">Log de auditoria</p><p className="mt-1 text-[10px] text-zinc-600">Eventos operacionais mais recentes</p></div><span className="text-[10px] text-zinc-600">Verificado em {formatDate(data.checkedAt)}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-line text-[9px] uppercase text-zinc-600"><th className="px-5 py-3">Data</th><th>Categoria</th><th>Status</th><th>Evento</th></tr></thead><tbody>{data.logs.length ? data.logs.map((log) => <tr key={log.id} className="border-b border-line/60"><td className="px-5 py-4 text-zinc-500">{formatDate(log.createdAt)}</td><td className="font-black">{log.category}</td><td className={log.status === "FAILED" ? "font-black text-red-400" : "font-black text-neon"}>{log.status}</td><td>{log.message}</td></tr>) : <tr><td colSpan={4} className="px-5 py-10 text-center text-zinc-600">Nenhum evento registrado. A próxima sincronização ou liquidação alimentará este log.</td></tr>}</tbody></table></div></section>
    <div className="mt-6 rounded-xl border border-line bg-white/[.02] p-4 text-[11px] leading-relaxed text-zinc-500">Esta auditoria avalia consistência operacional e não representa promessa de lucro ou garantia de green. Aposte com responsabilidade.</div>
  </>;
}
