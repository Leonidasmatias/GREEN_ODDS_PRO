// Fase 3.5 - Observabilidade e Validacao em Producao.
// DataConsistencyAnalyzer: roda 6 verificacoes estruturais nomeadas sobre
// uma amostra de InternalMatchDTO, independentes do MatchValidator da
// Fase 2 (que rejeita/aceita no momento da ingestao) - aqui o objetivo e
// so MEDIR e REPORTAR taxas de inconsistencia residual para observabilidade,
// nunca bloquear nem alterar o pipeline.

import type { InternalMatchDTO } from "../../providers/types/dto.ts";

export type ConsistencyCheckName =
  | "home_equals_away_team"
  | "negative_score"
  | "score_present_while_scheduled"
  | "score_missing_while_finished"
  | "invalid_scheduled_at"
  | "missing_league_name";

export const ALL_CONSISTENCY_CHECKS: ConsistencyCheckName[] = [
  "home_equals_away_team",
  "negative_score",
  "score_present_while_scheduled",
  "score_missing_while_finished",
  "invalid_scheduled_at",
  "missing_league_name",
];

export type ConsistencyCheckResult = { check: ConsistencyCheckName; failureCount: number };

export type ConsistencyAnalysisResult = {
  totalCount: number;
  consistentCount: number;
  consistencyRatio: number;
  checks: ConsistencyCheckResult[];
  inconsistencies: string[];
};

function runChecks(match: InternalMatchDTO): ConsistencyCheckName[] {
  const failed: ConsistencyCheckName[] = [];

  if (
    match.home?.virtualTeam?.normalizedName &&
    match.away?.virtualTeam?.normalizedName &&
    match.home.virtualTeam.normalizedName === match.away.virtualTeam.normalizedName
  ) {
    failed.push("home_equals_away_team");
  }

  if ((match.homeScore !== null && match.homeScore < 0) || (match.awayScore !== null && match.awayScore < 0)) {
    failed.push("negative_score");
  }

  if (match.status === "SCHEDULED" && (match.homeScore !== null || match.awayScore !== null)) {
    failed.push("score_present_while_scheduled");
  }

  if (match.status === "FINISHED" && (match.homeScore === null || match.awayScore === null)) {
    failed.push("score_missing_while_finished");
  }

  const scheduledAtMs = Date.parse(match.scheduledAt);
  if (!Number.isFinite(scheduledAtMs)) {
    failed.push("invalid_scheduled_at");
  }

  if (!match.league?.normalizedName || match.league.normalizedName.trim().length === 0) {
    failed.push("missing_league_name");
  }

  return failed;
}

/** Roda as 6 verificacoes nomeadas sobre a amostra e devolve contagens por check + a taxa geral de consistencia (0..1). */
export function analyzeConsistency(matches: InternalMatchDTO[]): ConsistencyAnalysisResult {
  const counts = new Map<ConsistencyCheckName, number>();
  let consistentCount = 0;

  for (const match of matches) {
    const failed = runChecks(match);
    if (failed.length === 0) consistentCount += 1;
    for (const check of failed) counts.set(check, (counts.get(check) ?? 0) + 1);
  }

  const checks = ALL_CONSISTENCY_CHECKS.map((check) => ({ check, failureCount: counts.get(check) ?? 0 }));
  const inconsistencies = checks.filter((result) => result.failureCount > 0).map((result) => `${result.check}:${result.failureCount}`);

  return {
    totalCount: matches.length,
    consistentCount,
    consistencyRatio: matches.length === 0 ? 0 : consistentCount / matches.length,
    checks,
    inconsistencies,
  };
}
