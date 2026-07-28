// Lógica de filtro/ordenação da tabela de monitoramento de perfis
// (`/intelligence`). Extraída como funções puras, livres de DOM, para
// serem testáveis pela infraestrutura de testes já existente
// (`node --test`, sem `@testing-library`/jsdom). Opera SOMENTE sobre os
// dados já recebidos (`ProfileRowViewModel[]`) — nunca recalcula
// classificações, nunca busca dados adicionais.

// Imports relativos (não `@/`) — mesma justificativa documentada em
// `intelligenceFormatters.ts` (executável também por `node --test`).
import type { ProfileDimension, ProfileRowViewModel, RecommendationType, RiskLevel } from "./intelligenceTypes.ts";
import type { MonitoringStatus, TrendType } from "../services/prediction-observability/index.ts";

export type ProfileTableFilters = {
  search: string;
  dimension: ProfileDimension | "ALL";
  status: MonitoringStatus | "ALL";
  risk: RiskLevel | "ALL" | "NONE";
  recommendation: RecommendationType | "ALL" | "NONE";
  trend: TrendType | "ALL" | "NONE";
};

export const DEFAULT_PROFILE_TABLE_FILTERS: ProfileTableFilters = {
  search: "",
  dimension: "ALL",
  status: "ALL",
  risk: "ALL",
  recommendation: "ALL",
  trend: "ALL",
};

export type ProfileTableSortKey = "reliability" | "risk" | "driftCount" | "name";
export type ProfileTableSortDirection = "asc" | "desc";

const RISK_ORDER: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

/** Filtra `rows` — nunca muta o array/objetos recebidos. */
export function filterProfileRows(rows: ProfileRowViewModel[], filters: ProfileTableFilters): ProfileRowViewModel[] {
  const search = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (search.length > 0) {
      const haystack = `${row.dimensionLabel} ${row.key} ${row.statusLabel}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.dimension !== "ALL" && row.dimensionCode !== filters.dimension) return false;
    if (filters.status !== "ALL" && row.status !== filters.status) return false;
    if (filters.risk === "NONE" && row.riskCode !== null) return false;
    if (filters.risk !== "ALL" && filters.risk !== "NONE" && row.riskCode !== filters.risk) return false;
    if (filters.recommendation === "NONE" && row.recommendationCode !== null) return false;
    if (filters.recommendation !== "ALL" && filters.recommendation !== "NONE" && row.recommendationCode !== filters.recommendation) return false;
    if (filters.trend === "NONE" && row.trendCode !== null) return false;
    if (filters.trend !== "ALL" && filters.trend !== "NONE" && row.trendCode !== filters.trend) return false;
    return true;
  });
}

/** Ordena uma NOVA cópia de `rows` — nunca muta o array recebido.
 * Valores `null` (confiabilidade/risco ausentes) sempre vão para o final,
 * independente da direção, para nunca serem confundidos com o menor
 * valor real. */
export function sortProfileRows(rows: ProfileRowViewModel[], sortKey: ProfileTableSortKey, direction: ProfileTableSortDirection): ProfileRowViewModel[] {
  const factor = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    switch (sortKey) {
      case "reliability": {
        if (a.reliabilityValue === null && b.reliabilityValue === null) return 0;
        if (a.reliabilityValue === null) return 1;
        if (b.reliabilityValue === null) return -1;
        return (a.reliabilityValue - b.reliabilityValue) * factor;
      }
      case "risk": {
        const rankA = a.riskCode === null ? null : RISK_ORDER[a.riskCode];
        const rankB = b.riskCode === null ? null : RISK_ORDER[b.riskCode];
        if (rankA === null && rankB === null) return 0;
        if (rankA === null) return 1;
        if (rankB === null) return -1;
        return (rankA - rankB) * factor;
      }
      case "driftCount":
        return (a.driftSignalsCount - b.driftSignalsCount) * factor;
      case "name":
        return a.key.localeCompare(b.key) * factor;
      default:
        return 0;
    }
  });
}
