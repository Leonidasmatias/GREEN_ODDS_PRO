"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function ProviderSyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function syncNow() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/providers/sync", { method: "POST" });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; warning?: string; callsUsed?: number; callsRemainingToday?: number; creditsRemaining?: number | null };
      setMessage(response.ok
        ? `Sync concluido. Chamadas usadas: ${data.callsUsed ?? 0}. Restantes hoje: ${data.callsRemainingToday ?? "-"}. Creditos: ${data.creditsRemaining ?? "N/A"}.`
        : data.warning ?? "Sync bloqueado pelo modo economico.");
    } catch {
      setMessage("Falha ao executar sync manual.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="flex flex-col gap-3">
    <button onClick={syncNow} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-neon px-5 py-3 text-xs font-black uppercase tracking-wider text-black disabled:cursor-not-allowed disabled:opacity-60">
      <RefreshCw size={15} className={loading ? "animate-spin" : ""}/>
      {loading ? "Sincronizando" : "Sync Now"}
    </button>
    {message && <p className="rounded-xl border border-line p-3 text-[11px] text-zinc-400">{message}</p>}
  </div>;
}
