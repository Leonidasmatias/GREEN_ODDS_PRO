// Fase 3.5 - Observabilidade e Validacao em Producao.
// DataCompletenessAnalyzer: mede, por campo, a proporcao de
// InternalMatchDTO (ja normalizados pelo ProviderNormalizer da Fase 2)
// em que o campo esta presente e nao-vazio. Campos "criticos" definem o
// completenessScore agregado; campos "importantes" sao reportados mas
// nao entram na media (documentado como decisao PROVISORIA - Secao
// "Qualidade de Dados" da missao/documentacao).

import type { InternalMatchDTO } from "../../providers/types/dto.ts";
import type { FieldQualityMetric } from "./types.ts";

export type CompletenessFieldSpec = {
  field: string;
  critical: boolean;
  extract: (match: InternalMatchDTO) => unknown;
};

/** Campos CRITICOS (7): identidade e agendamento minimos de uma partida. */
/** Campos IMPORTANTES (4): placar e nomes de equipe virtual - relevantes, mas nao bloqueantes. */
export const COMPLETENESS_FIELD_SPECS: CompletenessFieldSpec[] = [
  { field: "externalId", critical: true, extract: (m) => m.externalId },
  { field: "provider", critical: true, extract: (m) => m.provider },
  { field: "league.name", critical: true, extract: (m) => m.league?.name },
  { field: "scheduledAt", critical: true, extract: (m) => m.scheduledAt },
  { field: "status", critical: true, extract: (m) => m.status },
  { field: "home.player.nickname", critical: true, extract: (m) => m.home?.player?.nickname },
  { field: "away.player.nickname", critical: true, extract: (m) => m.away?.player?.nickname },
  { field: "homeScore", critical: false, extract: (m) => m.homeScore },
  { field: "awayScore", critical: false, extract: (m) => m.awayScore },
  { field: "home.virtualTeam.name", critical: false, extract: (m) => m.home?.virtualTeam?.name },
  { field: "away.virtualTeam.name", critical: false, extract: (m) => m.away?.virtualTeam?.name },
];

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

/** Calcula, para cada campo especificado, quantos registros da amostra o possuem preenchido. */
export function analyzeCompleteness(matches: InternalMatchDTO[]): FieldQualityMetric[] {
  const totalCount = matches.length;
  return COMPLETENESS_FIELD_SPECS.map((spec) => {
    const presentCount = matches.filter((match) => isPresent(spec.extract(match))).length;
    return {
      field: spec.field,
      critical: spec.critical,
      presentCount,
      totalCount,
      completenessRatio: totalCount === 0 ? 0 : presentCount / totalCount,
    };
  });
}

/**
 * Score agregado (0..1) usado pelo DataQualityEngine. Considera apenas os
 * campos criticos (media simples); se nenhum campo critico for informado
 * (nao deveria acontecer com COMPLETENESS_FIELD_SPECS padrao), cai para a
 * media de todos os campos como salvaguarda.
 */
export function overallCompletenessScore(metrics: FieldQualityMetric[]): number {
  const criticalMetrics = metrics.filter((metric) => metric.critical);
  const relevant = criticalMetrics.length > 0 ? criticalMetrics : metrics;
  if (relevant.length === 0) return 0;
  return relevant.reduce((sum, metric) => sum + metric.completenessRatio, 0) / relevant.length;
}
