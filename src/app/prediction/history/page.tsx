import { Suspense } from "react";
import { requireRouteAccess } from "@/services/authService";
import { PredictionHistoryDashboard } from "@/components/prediction-history/PredictionHistoryDashboard";
import { PredictionHistoryLoadingFallback } from "./loading";

export const dynamic = "force-dynamic";

/**
 * Server Component intencionalmente mínimo: apenas o gate de acesso
 * (mesmo padrão de `/prediction`). Nenhum dado é buscado aqui — a
 * missão exige que a UI consuma exclusivamente a API pública da Sprint
 * 8.1 (`GET /api/predictions*`), e um Server Component fazendo fetch da
 * própria API exigiria URL absoluta (limitação conhecida do Next.js
 * para self-fetch), frágil e desnecessária já que toda a interação
 * (filtros/paginação/detalhe/Timeline) é client-side de qualquer forma.
 * `<Suspense>` é exigido pelo Next.js porque `PredictionHistoryDashboard`
 * usa `useSearchParams()`.
 */
export default async function PredictionHistoryPage() {
  await requireRouteAccess("/prediction/history");

  return (
    <Suspense fallback={<PredictionHistoryLoadingFallback />}>
      <PredictionHistoryDashboard />
    </Suspense>
  );
}
