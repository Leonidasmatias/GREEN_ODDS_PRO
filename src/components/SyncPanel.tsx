"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw, Server, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatDateTimeBrt } from "@/lib/timezone";

interface SystemStatus {
  apiConfigured: boolean;
  databaseConfigured: boolean;
  databaseConnected: boolean;
  mode: string;
  provider: string;
  lastSync: string | null;
  lastStatus: string;
  warning: string | null;
  requestsRemaining: number | null;
}

const emptyStatus: SystemStatus = { apiConfigured: false, databaseConfigured: false, databaseConnected: false, mode: "REAL", provider: "none", lastSync: null, lastStatus: "LOADING", warning: null, requestsRemaining: null };

export function SyncPanel() {
  const [status, setStatus] = useState<SystemStatus>(emptyStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/sync/odds", { cache: "no-store" });
      setStatus(await response.json() as SystemStatus);
    } catch { setMessage("Nao foi possivel consultar o status do sistema."); }
  }, []);
  useEffect(() => { void loadStatus(); }, [loadStatus]);

  async function synchronize() {
    setLoading(true); setMessage(null);
    try {
      const response = await fetch("/api/sync/odds", { method: "POST" });
      const result = await response.json() as { eventsReceived?: number; snapshotsCreated?: number; tipsCreated?: number; warning?: string };
      setMessage(response.ok ? `${result.eventsReceived ?? 0} jogos, ${result.snapshotsCreated ?? 0} snapshots e ${result.tipsCreated ?? 0} tips processados.` : result.warning ?? "A sincronizacao falhou.");
      await loadStatus();
    } catch { setMessage("A sincronizacao falhou. Nenhuma partida sera exibida."); }
    finally { setLoading(false); }
  }

  async function settle() {
    setLoading(true); setMessage(null);
    try {
      const response = await fetch("/api/settle", { method: "POST" });
      const result = await response.json() as { processed?: number; greens?: number; reds?: number; warning?: string; error?: string };
      setMessage(response.ok ? `${result.processed ?? 0} tips liquidadas: ${result.greens ?? 0} greens e ${result.reds ?? 0} reds.${result.warning ? ` ${result.warning}` : ""}` : result.error ?? "Falha na liquidacao.");
    } catch { setMessage("Nao foi possivel liquidar as tips agora."); }
    finally { setLoading(false); }
  }

  const cards = [
    { label: "API de odds", value: status.apiConfigured ? "Configurada" : "Sem chave", ok: status.apiConfigured, icon: Server },
    { label: "Banco de dados", value: status.databaseConnected ? "Conectado" : "Offline", ok: status.databaseConnected, icon: Database },
    { label: "Modo atual", value: "Real", ok: status.mode === "REAL", icon: ShieldCheck },
    { label: "Ultima sincronizacao", value: formatDateTimeBrt(status.lastSync, "Ainda nao executada"), ok: status.lastStatus === "SUCCESS", icon: RefreshCw },
  ];

  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({label,value,ok,icon:Icon}) => <div key={label} className="card p-5"><div className="flex items-center justify-between"><p className="label">{label}</p><Icon size={17} className={ok ? "text-neon" : "text-amber-300"}/></div><strong className="mt-4 block text-lg text-white">{value}</strong><span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[8px] font-black uppercase ${ok ? "border-neon/20 bg-neon/10 text-neon" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>{ok ? "Operacional" : "Atencao"}</span></div>)}</div>
    <section className="card mt-6 p-6"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><div><p className="label text-neon">Sincronizacao manual</p><h2 className="mt-2 text-xl font-black">The Odds API</h2><p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">Busca odds licenciadas, normaliza o mercado, salva snapshots e registra tips reais. Sem chave ou em caso de falha, a lista permanece vazia.</p>{status.requestsRemaining !== null && <p className="mt-2 text-[10px] text-gold">Creditos restantes informados pela API: {status.requestsRemaining}</p>}</div><div className="flex flex-col gap-2 sm:flex-row"><button onClick={settle} disabled={loading || !status.apiConfigured || !status.databaseConnected} title={!status.apiConfigured || !status.databaseConnected ? "PENDING_RESULTS: provider ou banco indisponivel" : "Liquidar resultados reais pendentes"} className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-white/[.03] px-5 py-4 text-[10px] font-black uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50">Liquidar resultados</button><button onClick={synchronize} disabled={loading || !status.apiConfigured || !status.databaseConnected} title={!status.apiConfigured || !status.databaseConnected ? "INSUFFICIENT_REAL_DATA: provider ou banco indisponivel" : "Sincronizar odds reais agora"} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-neon px-6 py-4 text-xs font-black uppercase tracking-wider text-black disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> {loading ? "Processando" : "Sincronizar odds agora"}</button></div></div>{(message || status.warning) && <div className="mt-5 flex gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[.05] p-4 text-xs text-amber-200"><TriangleAlert size={16} className="shrink-0"/><span>{message ?? status.warning}</span></div>}</section>
  </>;
}
