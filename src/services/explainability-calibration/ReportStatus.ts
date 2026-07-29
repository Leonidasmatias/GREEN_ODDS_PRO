// Sprint 9.1.1 — Calibration Data Integrity & Report Hardening, Etapa 7.
// Status geral do relatório: um único valor, computado exclusivamente a
// partir da proveniência do dataset (Etapa 2) — nunca digitado à mão em
// nenhum lugar do relatório ou do CLI. Resume, em uma palavra, se o
// relatório pode ser lido como orientação operacional ou apenas como
// demonstração/observação técnica.

import type { DatasetProvenance } from "./DatasetProvenance.ts";
import { MIN_SAMPLE_FOR_ELIGIBLE_REVIEW, MIN_SAMPLE_FOR_OBSERVATIONAL_READING } from "./RecommendationEligibility.ts";

export type ReportStatus = "BLOCKED_NO_REAL_DATA" | "BLOCKED_INSUFFICIENT_SAMPLE" | "DEMONSTRATION" | "OBSERVATIONAL" | "READY_FOR_HUMAN_REVIEW";

/**
 * Regras, avaliadas nesta ordem:
 *
 * 1. Origem `SYNTHETIC` (nenhum registro real tageado): se uma consulta
 *    real chegou a ser tentada (`realDataAttempted`), o dataset acabou
 *    sendo 100% sintético porque não existe dado real ainda —
 *    `BLOCKED_NO_REAL_DATA`. Se a consulta real nunca foi tentada (ex.:
 *    sem `DATABASE_URL`), o relatório é puramente uma demonstração do
 *    pipeline — `DEMONSTRATION`.
 * 2. Amostra válida abaixo de `MIN_SAMPLE_FOR_OBSERVATIONAL_READING` (com
 *    origem `REAL` ou `MIXED`) → `BLOCKED_INSUFFICIENT_SAMPLE`.
 * 3. Origem `MIXED` com amostra suficiente → `OBSERVATIONAL` (nunca
 *    `READY_FOR_HUMAN_REVIEW` — a presença de dado sintético misturado
 *    sempre limita a leitura a observacional).
 * 4. Origem `REAL` com amostra abaixo de `MIN_SAMPLE_FOR_ELIGIBLE_REVIEW`
 *    → `OBSERVATIONAL`.
 * 5. Origem `REAL` com amostra >= `MIN_SAMPLE_FOR_ELIGIBLE_REVIEW` →
 *    `READY_FOR_HUMAN_REVIEW`.
 */
export function determineReportStatus(provenance: DatasetProvenance): ReportStatus {
  if (provenance.origin === "SYNTHETIC") {
    return provenance.realDataAttempted ? "BLOCKED_NO_REAL_DATA" : "DEMONSTRATION";
  }
  if (provenance.validRecordCount < MIN_SAMPLE_FOR_OBSERVATIONAL_READING) {
    return "BLOCKED_INSUFFICIENT_SAMPLE";
  }
  if (provenance.origin === "MIXED") {
    return "OBSERVATIONAL";
  }
  if (provenance.validRecordCount < MIN_SAMPLE_FOR_ELIGIBLE_REVIEW) {
    return "OBSERVATIONAL";
  }
  return "READY_FOR_HUMAN_REVIEW";
}
