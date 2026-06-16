interface ScoreBarProps {
  score: number;
  compact?: boolean;
}

export function ScoreBar({ score, compact = false }: ScoreBarProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const color = safeScore >= 70 ? "bg-neon" : safeScore >= 50 ? "bg-amber-300" : "bg-red-400";

  return (
    <div className={compact ? "min-w-24" : "w-full"} aria-label={`Score ${safeScore} de 100`}>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Score</span>
        <strong className="text-sm text-white">{safeScore}<span className="text-[9px] text-zinc-600">/100</span></strong>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${safeScore}%` }} />
      </div>
    </div>
  );
}
