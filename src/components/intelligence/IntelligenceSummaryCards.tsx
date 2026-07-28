import { CheckCircle2, CircleSlash, Eye, Gauge, Layers3, Percent, ShieldCheck, TrendingUp, TriangleAlert, OctagonAlert } from "lucide-react";
import type { SummaryCardViewModel } from "@/lib/intelligenceTypes";

const ICONS: Record<SummaryCardViewModel["icon"], React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>> = {
  profiles: Layers3,
  monitored: Eye,
  stable: CheckCircle2,
  warning: TriangleAlert,
  critical: OctagonAlert,
  improving: TrendingUp,
  disabled: CircleSlash,
  reliability: ShieldCheck,
  risk: Gauge,
  confidence: Percent,
};

const TONES: Record<SummaryCardViewModel["icon"], string> = {
  profiles: "text-white",
  monitored: "text-cyan-200",
  stable: "text-neon",
  warning: "text-amber-300",
  critical: "text-red-400",
  improving: "text-cyan-200",
  disabled: "text-zinc-500",
  reliability: "text-neon",
  risk: "text-amber-300",
  confidence: "text-gold",
};

export function IntelligenceSummaryCards({ cards }: { cards: SummaryCardViewModel[] }) {
  return (
    <section aria-label="Cards de resumo do modelo" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = ICONS[card.icon];
        const tone = TONES[card.icon];
        return (
          <div key={card.key} className="card p-5">
            <div className="flex items-start justify-between">
              <p className="label">{card.label}</p>
              <Icon size={16} className={tone} aria-hidden={true} />
            </div>
            <p className={`mt-3 break-words text-2xl font-black tracking-tight ${tone}`}>{card.value}</p>
          </div>
        );
      })}
    </section>
  );
}
