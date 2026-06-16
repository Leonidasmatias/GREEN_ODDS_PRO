import type { Risk } from "@/lib/types";

const riskStyles: Record<Risk, string> = {
  Baixo: "border-neon/25 bg-neon/10 text-neon",
  Médio: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  Alto: "border-red-500/25 bg-red-500/10 text-red-400",
};

export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${riskStyles[risk]}`}>
      {risk}
    </span>
  );
}
