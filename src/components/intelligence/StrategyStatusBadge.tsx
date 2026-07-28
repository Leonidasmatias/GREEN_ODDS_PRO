import type { StrategyStatus } from "@/lib/intelligenceTypes";
import { strategyStatusStyles } from "./intelligenceStatusStyles";

export function StrategyStatusBadge({ status, label }: { status: StrategyStatus; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${strategyStatusStyles[status]}`}
      aria-label={`Estratégia atual: ${label} (${status})`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      Estratégia: {label}
      <span className="text-[9px] font-bold opacity-70">{status}</span>
    </span>
  );
}
