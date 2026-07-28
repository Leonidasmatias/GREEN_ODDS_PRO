function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`card animate-pulse bg-white/[.02] ${className}`} aria-hidden="true" />;
}

export default function PredictionCenterLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando Prediction Center">
      <div className="mb-2 h-16 animate-pulse rounded-2xl bg-white/[.02]" aria-hidden="true" />
      <SkeletonCard className="h-24" />
      <div className="space-y-6">
        <SkeletonCard className="h-32" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} className="h-28" />
          ))}
        </div>
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-40" />
      </div>
      <span className="sr-only">Carregando previsões do Prediction Center…</span>
    </div>
  );
}
