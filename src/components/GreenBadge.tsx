import type { GreenClassification } from "@/lib/types";

const styles: Record<GreenClassification, string> = {
  "ELITE GREEN": "border-neon/40 bg-neon/15 text-neon",
  "GREEN PREMIUM": "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  "GREEN FORTE": "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  MODERADO: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
  EVITAR: "border-red-500/30 bg-red-500/10 text-red-400",
};

const dots: Record<GreenClassification, string> = {
  "ELITE GREEN": "bg-neon",
  "GREEN PREMIUM": "bg-cyan-400",
  "GREEN FORTE": "bg-emerald-400",
  MODERADO: "bg-yellow-400",
  EVITAR: "bg-red-500",
};

export function GreenBadge({ classification }: { classification: GreenClassification }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${styles[classification]}`}><span className={`h-1.5 w-1.5 rounded-full ${dots[classification]}`}/>{classification}</span>;
}
