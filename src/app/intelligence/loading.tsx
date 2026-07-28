function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`card animate-pulse bg-white/[.02] ${className}`} aria-hidden="true" />;
}

export default function IntelligenceLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando painel de inteligência">
      <div className="mb-2 h-24 animate-pulse rounded-2xl bg-white/[.02]" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <SkeletonCard key={index} className="h-24" />
        ))}
      </div>
      <SkeletonCard className="h-32" />
      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-56" />
      </div>
      <SkeletonCard className="h-72" />
      <span className="sr-only">Carregando dados do relatório de observabilidade…</span>
    </div>
  );
}
