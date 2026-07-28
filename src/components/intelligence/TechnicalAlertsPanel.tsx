import { BellRing } from "lucide-react";
import type { AlertViewModel } from "@/lib/intelligenceTypes";
import { alertLevelStyles } from "./intelligenceStatusStyles";

/**
 * Painel de alertas técnicos — puramente informativo. Nenhum botão de
 * ação (aplicar recomendação, recalibrar, bloquear perfil etc.) é
 * exibido aqui, por design.
 */
export function TechnicalAlertsPanel({ alerts }: { alerts: AlertViewModel[] }) {
  return (
    <section className="card p-5 md:p-6" aria-labelledby="alerts-heading">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p id="alerts-heading" className="text-sm font-black uppercase tracking-wider">Alertas técnicos</p>
          <p className="mt-1 text-[10px] text-zinc-600">Sinais informativos — nenhuma ação é executada automaticamente</p>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-[10px] font-black text-zinc-400">{alerts.length}</span>
      </div>
      {alerts.length > 0 ? (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li key={alert.id} className="rounded-xl border border-line bg-white/[.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BellRing size={14} className="text-zinc-500" aria-hidden="true" />
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${alertLevelStyles[alert.level]}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                    {alert.levelLabel}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400">
                    {alert.typeLabel} <span className="text-zinc-600">({alert.type})</span>
                  </span>
                </div>
                <span className="text-[10px] font-bold text-zinc-500">{alert.profileLabel}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{alert.message}</p>
              <p className="mt-2 text-[10px] text-zinc-600">Timestamp: {alert.timestampLabel}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-xs text-zinc-600">Nenhum alerta técnico nesta execução.</p>
      )}
    </section>
  );
}
