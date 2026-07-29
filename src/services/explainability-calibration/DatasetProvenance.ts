// Sprint 9.1.1 — Calibration Data Integrity & Report Hardening, Etapa 2.
// Contrato de proveniência do dataset: registra explicitamente se os
// registros analisados vieram de dados REAIS, de dados SINTÉTICOS de
// demonstração, ou de uma mistura dos dois — nunca inferido
// implicitamente pelo relatório, sempre computado aqui a partir de tags
// fornecidas pelo chamador (o único ponto que sabe, de fato, de onde
// cada previsão veio é `scripts/calibration.mjs`). Nenhum valor ausente
// é inventado: contagens sem dado viram `0`/lista vazia, datas sem
// registro válido viram `null` — nunca um placeholder disfarçado de dado.

import type { EvaluationDatasetSummary, EvaluationWarning, HistoricalPredictionRecord } from "../prediction-evaluation/index.ts";

export type DatasetOrigin = "REAL" | "SYNTHETIC" | "MIXED";

/** Tag de proveniência de uma única previsão, fornecida pelo chamador
 * (nunca inferida por este módulo). Toda previsão de um `EvaluationDataset`
 * deve ter uma tag correspondente — é responsabilidade do chamador (o
 * CLI) garantir cobertura total, já que apenas ele sabe se uma previsão
 * veio do Postgres real ou do gerador sintético. */
export type RecordProvenanceTag = { matchId: string; origin: "REAL" | "SYNTHETIC" };

export type DiscardReasonCount = { code: string; count: number };

export type DatasetProvenance = {
  origin: DatasetOrigin;
  /** Total de previsões fornecidas ao dataset (antes de qualquer join/validação). */
  totalCount: number;
  realCount: number;
  syntheticCount: number;
  /** `generatedAt` mais antigo/mais recente entre os registros válidos
   * (casados + estruturalmente válidos). `null` quando não há nenhum
   * registro válido — nunca uma data inventada. */
  periodStart: string | null;
  periodEnd: string | null;
  /** Ligas distintas (não nulas) entre os registros válidos. */
  leagueCount: number;
  /** Jogadores distintos (casa + visitante) entre os registros válidos. */
  playerCount: number;
  validRecordCount: number;
  discardedRecordCount: number;
  /** Avisos de join/validação (Sprint 4.5), agregados por código —
   * exatamente os mesmos avisos já computados, nunca um motivo novo. */
  discardReasons: DiscardReasonCount[];
  /** `true` quando o chamador de fato tentou consultar dados reais
   * (ex.: `DATABASE_URL` configurada e a consulta foi executada), mesmo
   * que o resultado tenha sido zero registros reais. `false` quando a
   * tentativa nem chegou a ser feita (ex.: sem `DATABASE_URL`). Distingue
   * "nunca tentamos buscar dado real" (`DEMONSTRATION`) de "tentamos e
   * não existe dado real ainda" (`BLOCKED_NO_REAL_DATA`) — ver
   * `ReportStatus.ts`. */
  realDataAttempted: boolean;
};

function aggregateDiscardReasons(warnings: EvaluationWarning[]): DiscardReasonCount[] {
  const counts = new Map<string, number>();
  for (const warning of warnings) {
    counts.set(warning.code, (counts.get(warning.code) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([code, count]) => ({ code, count }));
}

function computePeriod(validRecords: HistoricalPredictionRecord[]): { periodStart: string | null; periodEnd: string | null } {
  if (validRecords.length === 0) return { periodStart: null, periodEnd: null };
  const timestamps = validRecords.map((record) => record.snapshot.result.prediction.generatedAt).sort();
  return { periodStart: timestamps[0], periodEnd: timestamps[timestamps.length - 1] };
}

function countDistinctLeagues(validRecords: HistoricalPredictionRecord[]): number {
  return new Set(validRecords.map((record) => record.snapshot.league).filter((league): league is string => league !== null)).size;
}

function countDistinctPlayers(validRecords: HistoricalPredictionRecord[]): number {
  const players = new Set<string>();
  for (const record of validRecords) {
    players.add(record.snapshot.homePlayerId);
    players.add(record.snapshot.awayPlayerId);
  }
  return players.size;
}

/**
 * Computa a proveniência do dataset a partir das tags fornecidas pelo
 * chamador. `origin` é `MIXED` sempre que houver ao menos um registro
 * de cada tipo — mesmo que a maioria seja de um único tipo, pois
 * qualquer mistura já compromete a alegação de "dado 100% real". Quando
 * nenhuma tag é fornecida (dataset vazio), assume `SYNTHETIC` como
 * padrão defensivo — nunca reivindica `REAL` sem evidência explícita.
 */
export function computeDatasetProvenance(
  totalPredictionsCount: number,
  provenanceTags: RecordProvenanceTag[],
  validRecords: HistoricalPredictionRecord[],
  datasetSummary: EvaluationDatasetSummary,
  warnings: EvaluationWarning[],
  realDataAttempted: boolean,
): DatasetProvenance {
  let realCount = 0;
  let syntheticCount = 0;
  for (const tag of provenanceTags) {
    if (tag.origin === "REAL") realCount += 1;
    else syntheticCount += 1;
  }

  const origin: DatasetOrigin = realCount > 0 && syntheticCount > 0 ? "MIXED" : realCount > 0 ? "REAL" : "SYNTHETIC";

  const { periodStart, periodEnd } = computePeriod(validRecords);

  return {
    origin,
    totalCount: totalPredictionsCount,
    realCount,
    syntheticCount,
    periodStart,
    periodEnd,
    leagueCount: countDistinctLeagues(validRecords),
    playerCount: countDistinctPlayers(validRecords),
    validRecordCount: datasetSummary.validRecords,
    discardedRecordCount: datasetSummary.ignoredRecords,
    discardReasons: aggregateDiscardReasons(warnings),
    realDataAttempted,
  };
}
