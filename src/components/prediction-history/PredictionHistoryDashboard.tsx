"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { listPredictions, PredictionApiError } from "@/lib/predictionApiClient";
import type { PredictionQueryPage } from "@/lib/predictionApiClient";
import { DEFAULT_FILTER_VALUES, PredictionHistoryFilters, type PredictionHistoryFilterValues } from "./PredictionHistoryFilters";
import { PredictionHistoryList } from "./PredictionHistoryList";
import { PredictionHistoryPagination } from "./PredictionHistoryPagination";
import { PredictionHistoryEmptyState } from "./PredictionHistoryEmptyState";
import { PredictionHistoryErrorState } from "./PredictionHistoryErrorState";
import { PredictionHistoryDetailPanel } from "./PredictionHistoryDetailPanel";
import { PredictionHistoryTimeline } from "./PredictionHistoryTimeline";

const ORDER_BY_VALUES: readonly PredictionHistoryFilterValues["orderBy"][] = ["generatedAt", "createdAt"];
const ORDER_DIRECTION_VALUES: readonly PredictionHistoryFilterValues["orderDirection"][] = ["asc", "desc"];

/** Lê os filtros/offset atuais a partir da URL — a URL é a fonte de
 * verdade; nenhum filtro é mantido apenas em estado local sem
 * necessidade. Valores fora do domínio conhecido caem no padrão em vez
 * de gerar um estado inválido. */
function parseFiltersFromSearchParams(searchParams: URLSearchParams): { filters: PredictionHistoryFilterValues; offset: number } {
  const orderByRaw = searchParams.get("orderBy");
  const orderDirectionRaw = searchParams.get("orderDirection");
  const offsetRaw = Number(searchParams.get("offset"));

  return {
    filters: {
      matchId: searchParams.get("matchId") ?? "",
      playerId: searchParams.get("playerId") ?? "",
      league: searchParams.get("league") ?? "",
      period: searchParams.get("period") ?? "",
      orderBy: (ORDER_BY_VALUES as readonly string[]).includes(orderByRaw ?? "") ? (orderByRaw as PredictionHistoryFilterValues["orderBy"]) : DEFAULT_FILTER_VALUES.orderBy,
      orderDirection: (ORDER_DIRECTION_VALUES as readonly string[]).includes(orderDirectionRaw ?? "") ? (orderDirectionRaw as PredictionHistoryFilterValues["orderDirection"]) : DEFAULT_FILTER_VALUES.orderDirection,
      limit: searchParams.get("limit") ?? "",
    },
    offset: Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0,
  };
}

function buildSearchParams(filters: PredictionHistoryFilterValues, offset: number): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.matchId) params.set("matchId", filters.matchId);
  if (filters.playerId) params.set("playerId", filters.playerId);
  if (filters.league) params.set("league", filters.league);
  if (filters.period) params.set("period", filters.period);
  if (filters.orderBy !== DEFAULT_FILTER_VALUES.orderBy) params.set("orderBy", filters.orderBy);
  if (filters.orderDirection !== DEFAULT_FILTER_VALUES.orderDirection) params.set("orderDirection", filters.orderDirection);
  if (filters.limit) params.set("limit", filters.limit);
  if (offset > 0) params.set("offset", String(offset));
  return params;
}

function hasActiveFilters(filters: PredictionHistoryFilterValues): boolean {
  return Boolean(filters.matchId || filters.playerId || filters.league || filters.period);
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; page: PredictionQueryPage };

type Overlay = { type: "detail"; id: string } | { type: "timeline"; matchId: string } | null;

export function PredictionHistoryDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { filters, offset } = useMemo(() => parseFiltersFromSearchParams(searchParams), [searchParams]);
  const queryKey = searchParams.toString();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [overlay, setOverlay] = useState<Overlay>(null);

  const fetchPage = useCallback(
    (signal?: AbortSignal) => {
      setState({ status: "loading" });
      listPredictions(
        {
          matchId: filters.matchId || undefined,
          playerId: filters.playerId || undefined,
          league: filters.league || undefined,
          period: filters.period || undefined,
          orderBy: filters.orderBy,
          orderDirection: filters.orderDirection,
          limit: filters.limit ? Number(filters.limit) : undefined,
          offset,
        },
        signal,
      )
        .then((page) => setState({ status: "success", page }))
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          const message = error instanceof PredictionApiError ? error.message : "Não foi possível carregar o histórico de previsões.";
          setState({ status: "error", message });
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchPage(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  function navigate(nextFilters: PredictionHistoryFilterValues, nextOffset: number) {
    const params = buildSearchParams(nextFilters, nextOffset);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const handleApply = (values: PredictionHistoryFilterValues) => navigate(values, 0);
  const handleClear = () => navigate(DEFAULT_FILTER_VALUES, 0);
  const handlePrevious = () => navigate(filters, Math.max(0, offset - (state.status === "success" ? state.page.limit : 0)));
  const handleNext = () => navigate(filters, offset + (state.status === "success" ? state.page.limit : 0));
  const handleRetry = () => fetchPage();

  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="space-y-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/prediction" className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-500 hover:text-zinc-300">
            <ArrowLeft size={12} aria-hidden="true" /> Voltar ao Prediction Center
          </Link>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Histórico de Previsões</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">Consulta das previsões já persistidas, com filtros, paginação e Timeline por partida.</p>
        </div>
      </div>

      {process.env.NODE_ENV === "development" && (
        <div role="status" className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-xs font-bold text-gold">
          Histórico temporário (ambiente de desenvolvimento): os dados podem ser reiniciados durante atualizações do ambiente.
        </div>
      )}

      {state.status === "success" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total encontrado" value={state.page.total} />
          <StatCard label="Nesta página" value={state.page.items.length} />
          <StatCard label="Fixture (nesta página)" value={state.page.items.filter((item) => item.source === "fixture").length} />
          <StatCard label="Real (nesta página)" value={state.page.items.filter((item) => item.source === "real").length} />
        </div>
      )}

      <PredictionHistoryFilters initialValues={filters} onApply={handleApply} onClear={handleClear} />

      {state.status === "error" && <PredictionHistoryErrorState message={state.message} onRetry={handleRetry} />}

      {state.status === "loading" && (
        <div className="card space-y-4 p-4">
          <PredictionHistoryList
            items={[]}
            loading
            onOpenDetail={(id) => setOverlay({ type: "detail", id })}
            onOpenTimeline={(matchId) => setOverlay({ type: "timeline", matchId })}
          />
        </div>
      )}

      {state.status === "success" && state.page.items.length > 0 && (
        <div className="card space-y-4 p-4">
          <PredictionHistoryList
            items={state.page.items}
            loading={false}
            onOpenDetail={(id) => setOverlay({ type: "detail", id })}
            onOpenTimeline={(matchId) => setOverlay({ type: "timeline", matchId })}
          />
          <PredictionHistoryPagination page={state.page} onPrevious={handlePrevious} onNext={handleNext} />
        </div>
      )}

      {state.status === "success" && state.page.items.length === 0 && (
        <PredictionHistoryEmptyState hasActiveFilters={filtersActive} onClearFilters={handleClear} />
      )}

      {overlay?.type === "detail" && <PredictionHistoryDetailPanel id={overlay.id} onClose={() => setOverlay(null)} />}
      {overlay?.type === "timeline" && (
        <PredictionHistoryTimeline matchId={overlay.matchId} onClose={() => setOverlay(null)} onOpenDetail={(id) => setOverlay({ type: "detail", id })} />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className="metric mt-2">{value}</p>
    </div>
  );
}
