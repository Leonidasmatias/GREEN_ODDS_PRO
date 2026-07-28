import { History } from "lucide-react";
import type { TimelineEventViewModel } from "@/lib/intelligenceTypes";

const TIMELINE_TYPE_TONE: Record<TimelineEventViewModel["type"], string> = {
  STRATEGY_CHANGE: "border-neon/25 bg-neon/10 text-neon",
  RISK_CHANGE: "border-amber-300/25 bg-amber-300/10 text-amber-300",
  RELIABILITY_CHANGE: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  RECOMMENDATION_CHANGE: "border-gold/25 bg-gold/10 text-gold",
  DRIFT_CHANGE: "border-orange-400/25 bg-orange-400/10 text-orange-300",
};

/**
 * Linha do tempo técnica — a ordem é EXATAMENTE a recebida do
 * `TimelineEngine` (Sprint 5.3), nunca reordenada pelo frontend.
 */
export function IntelligenceTimeline({ events }: { events: TimelineEventViewModel[] }) {
  return (
    <section className="card p-5 md:p-6" aria-labelledby="timeline-heading">
      <div className="mb-5 flex items-center gap-2">
        <History size={14} className="text-neon" aria-hidden="true" />
        <div>
          <p id="timeline-heading" className="text-sm font-black uppercase tracking-wider">Linha do tempo técnica</p>
          <p className="mt-1 text-[10px] text-zinc-600">Ordem exatamente como recebida do backend</p>
        </div>
      </div>
      {events.length > 0 ? (
        <ol className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-2 rounded-xl border border-line bg-white/[.02] p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${TIMELINE_TYPE_TONE[event.type]}`}>
                  {event.typeLabel}
                </span>
                <div>
                  <p className="text-xs text-zinc-300">{event.description}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">{event.profileLabel}</p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-zinc-500">{event.timestampLabel}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-6 text-center text-xs text-zinc-600">Nenhum evento na linha do tempo nesta execução.</p>
      )}
    </section>
  );
}
