// Sprint 9.1.1 — Calibration Data Integrity & Report Hardening, Etapa 3.
// Política de elegibilidade de recomendação: decide, a partir da
// proveniência do dataset (Etapa 2) e do tamanho de amostra observado,
// se uma sugestão de threshold pode ser lida como algo além de uma
// demonstração técnica. Função pura — nunca aplica nada, apenas
// classifica. A amostra mínima aqui é uma constante isolada desta
// sprint, documentada e nunca compartilhada com nenhum threshold da
// Sprint 9.0 (`predictionExplanationConstants.ts` continua intocado).

import type { DatasetOrigin } from "./DatasetProvenance.ts";

export type RecommendationEligibility = "DEMONSTRATION_ONLY" | "INSUFFICIENT_SAMPLE" | "OBSERVATIONAL" | "ELIGIBLE_FOR_REVIEW";

/** Abaixo disto, nenhuma leitura estatística é considerada — nem mesmo
 * observacional — independentemente da origem dos dados. Constante de
 * calibração isolada: não é (e nunca deve virar) um threshold de
 * produção da Sprint 9.0. */
export const MIN_SAMPLE_FOR_OBSERVATIONAL_READING = 10;

/** Abaixo disto, dados reais puros ainda não são considerados prontos
 * para revisão humana como possível ajuste de produção — permanecem
 * "observacionais". Constante de calibração isolada, mesma ressalva
 * acima. */
export const MIN_SAMPLE_FOR_ELIGIBLE_REVIEW = 30;

/**
 * Regras (nunca alteráveis por configuração externa, para que a
 * classificação seja sempre auditável a partir deste único arquivo):
 *
 * 1. Origem `SYNTHETIC` → sempre `DEMONSTRATION_ONLY`, qualquer que seja
 *    o tamanho da amostra (dado sintético nunca vira recomendação real).
 * 2. Amostra abaixo de `MIN_SAMPLE_FOR_OBSERVATIONAL_READING` → sempre
 *    `INSUFFICIENT_SAMPLE`, mesmo com origem `REAL`.
 * 3. Origem `MIXED` → nunca `ELIGIBLE_FOR_REVIEW` (a presença de
 *    qualquer registro sintético já impede a leitura como calibração
 *    real plena); no máximo `OBSERVATIONAL`.
 * 4. Origem `REAL` com amostra >= `MIN_SAMPLE_FOR_ELIGIBLE_REVIEW` →
 *    `ELIGIBLE_FOR_REVIEW`. Entre os dois limites → `OBSERVATIONAL`.
 */
export function determineRecommendationEligibility(origin: DatasetOrigin, sampleSize: number): RecommendationEligibility {
  if (origin === "SYNTHETIC") return "DEMONSTRATION_ONLY";
  if (sampleSize < MIN_SAMPLE_FOR_OBSERVATIONAL_READING) return "INSUFFICIENT_SAMPLE";
  if (origin === "MIXED") return "OBSERVATIONAL";
  if (sampleSize < MIN_SAMPLE_FOR_ELIGIBLE_REVIEW) return "OBSERVATIONAL";
  return "ELIGIBLE_FOR_REVIEW";
}

/** Verdadeiro apenas quando a elegibilidade permite que a recomendação
 * apareça na seção "Resultado operacional" do relatório — nunca para
 * `DEMONSTRATION_ONLY`/`INSUFFICIENT_SAMPLE`, que só podem aparecer sob
 * "Demonstração técnica" ou como bloqueio explícito. */
export function isOperationalEligibility(eligibility: RecommendationEligibility): boolean {
  return eligibility === "OBSERVATIONAL" || eligibility === "ELIGIBLE_FOR_REVIEW";
}
