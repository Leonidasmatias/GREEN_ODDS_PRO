function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`card animate-pulse bg-white/[.02] ${className}`} aria-hidden="true" />;
}

/** Reaproveitado como `fallback` do `<Suspense>` que envolve
 * `PredictionHistoryDashboard` em `page.tsx` (necessário porque o
 * Dashboard usa `useSearchParams()`), além de servir como o
 * `loading.tsx` padrão de segmento do App Router. */
export function PredictionHistoryLoadingFallback() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando histórico de previsões">
      <div className="mb-2 h-16 animate-pulse rounded-2xl bg-white/[.02]" aria-hidden="true" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} className="h-20" />
        ))}
      </div>
      <SkeletonCard className="h-40" />
      <SkeletonCard className="h-64" />
      <span className="sr-only">Carregando histórico de previsões…</span>
    </div>
  );
}

export default function PredictionHistoryLoading() {
  return <PredictionHistoryLoadingFallback />;
}
