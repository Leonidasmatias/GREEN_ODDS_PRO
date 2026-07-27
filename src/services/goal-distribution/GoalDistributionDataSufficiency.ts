// Fase 4 — Sprint 4.2 — Goal Distribution Engine Foundation.
// Data Sufficiency: avalia se há evidência suficiente para confiar na
// distribuição de gols, sem jamais fabricar confiança quando o histórico é
// curto ou ausente. Reaproveita o mesmo conceito e a mesma escala de
// `ConfidenceEngine.confidenceScore` (Módulo 8, Fase 1.5) já usados pela
// `PredictionDataSufficiency` da Sprint 4.1 — reimplementado aqui porque a
// forma da requisição (`GoalDistributionRequest`/`GoalFeatureTrace`) é
// distinta, mas o `DataSufficiencyResult` devolvido é o mesmo tipo,
// reaproveitado sem alteração. Função pura: nenhum acesso a Prisma, rede
// ou relógio do sistema.

import type { GoalDistributionConfig } from "./GoalDistributionConfig.ts";
import type { DataSufficiencyResult, DataSufficiencyStatus, GoalDistributionPlayerInputs, HeadToHeadResult } from "./types.ts";

const STATUS_RANK: Record<DataSufficiencyStatus, number> = {
  INSUFFICIENT: 0,
  LIMITED: 1,
  SUFFICIENT: 2,
  STRONG: 3,
};

function capStatus(status: DataSufficiencyStatus, capAt: DataSufficiencyStatus): DataSufficiencyStatus {
  return STATUS_RANK[status] <= STATUS_RANK[capAt] ? status : capAt;
}

/** Percorre um valor (DTO simples do Intelligence Engine: números,
 * strings, objetos aninhados, arrays e null) e coleta todos os números
 * encontrados, para detectar NaN/Infinity em qualquer indicador
 * fornecido pelo chamador. */
function collectNumbers(value: unknown, acc: number[]): void {
  if (typeof value === "number") {
    acc.push(value);
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, acc);
    return;
  }
  for (const [, nested] of Object.entries(value)) {
    collectNumbers(nested, acc);
  }
}

function hasInvalidNumber(...values: unknown[]): boolean {
  const numbers: number[] = [];
  for (const value of values) collectNumbers(value, numbers);
  return numbers.some((value) => !Number.isFinite(value));
}

/**
 * Avalia a suficiência de dados da requisição de distribuição de gols.
 * Regras, em ordem:
 *
 * 1. Amostra zero de qualquer jogador (estreante) força `INSUFFICIENT`,
 *    independente de qualquer outro indicador.
 * 2. Caso contrário, o piso é determinado pelo menor `confidenceScore`
 *    (Módulo 8) entre os dois jogadores — ausência de `confidence` para
 *    um lado é tratada como o pior caso (0), nunca assumida como boa.
 * 3. Ausência de H2H (quando `config.headToHeadEnabled` está ligado), de
 *    amostra mandante/visitante mínima, ou de qualquer número inválido
 *    (NaN/Infinity) nos indicadores fornecidos rebaixam (nunca elevam) o
 *    status, cada um com um aviso nomeado. H2H desabilitado por
 *    configuração nunca gera aviso — é uma escolha deliberada, não uma
 *    lacuna de dados.
 */
export function evaluateGoalDistributionDataSufficiency(
  homePlayer: GoalDistributionPlayerInputs,
  awayPlayer: GoalDistributionPlayerInputs,
  headToHead: HeadToHeadResult | null,
  config: GoalDistributionConfig,
): DataSufficiencyResult {
  const thresholds = config.dataSufficiencyThresholds;
  const warnings: string[] = [];

  const homeSampleSize = homePlayer.matchesCount;
  const awaySampleSize = awayPlayer.matchesCount;
  const headToHeadSampleSize = headToHead?.matchesCount ?? 0;
  const sampleSize = Math.min(homeSampleSize, awaySampleSize);

  let status: DataSufficiencyStatus;

  const homeIsDebutant = homeSampleSize === 0;
  const awayIsDebutant = awaySampleSize === 0;

  if (homeIsDebutant && awayIsDebutant) {
    status = "INSUFFICIENT";
    warnings.push("both_players_debutant");
  } else if (homeIsDebutant || awayIsDebutant) {
    status = "INSUFFICIENT";
    warnings.push(homeIsDebutant ? "home_player_debutant" : "away_player_debutant");
  } else {
    const homeConfidence = homePlayer.confidence?.confidenceScore ?? null;
    const awayConfidence = awayPlayer.confidence?.confidenceScore ?? null;

    if (homeConfidence === null) warnings.push("home_confidence_unavailable");
    if (awayConfidence === null) warnings.push("away_confidence_unavailable");

    const minConfidence = Math.min(homeConfidence ?? 0, awayConfidence ?? 0);

    if (minConfidence >= thresholds.minConfidenceForStrong) status = "STRONG";
    else if (minConfidence >= thresholds.minConfidenceForSufficient) status = "SUFFICIENT";
    else if (minConfidence >= thresholds.minConfidenceForLimited) status = "LIMITED";
    else status = "INSUFFICIENT";
  }

  if (config.headToHeadEnabled && headToHeadSampleSize === 0) {
    warnings.push("no_head_to_head_history");
    status = capStatus(status, "SUFFICIENT");
  }

  const homeSplit = homePlayer.homeAway?.home ?? null;
  const awaySplit = awayPlayer.homeAway?.away ?? null;
  const homeAwaySplitInsufficient =
    !homeSplit ||
    !awaySplit ||
    homeSplit.matchesCount < thresholds.minHomeAwaySampleSize ||
    awaySplit.matchesCount < thresholds.minHomeAwaySampleSize;
  if (homeAwaySplitInsufficient) {
    warnings.push("insufficient_home_away_split_data");
    status = capStatus(status, "SUFFICIENT");
  }

  if (
    hasInvalidNumber(
      homePlayer.rating,
      homePlayer.form,
      homePlayer.homeAway,
      homePlayer.momentum,
      homePlayer.strength,
      homePlayer.confidence,
      homePlayer.greenScore,
      homePlayer.goalsRates,
      awayPlayer.rating,
      awayPlayer.form,
      awayPlayer.homeAway,
      awayPlayer.momentum,
      awayPlayer.strength,
      awayPlayer.confidence,
      awayPlayer.greenScore,
      awayPlayer.goalsRates,
      headToHead,
    )
  ) {
    warnings.push("invalid_numeric_indicator_ignored");
    status = capStatus(status, "LIMITED");
  }

  return {
    status,
    sampleSize,
    homeSampleSize,
    awaySampleSize,
    headToHeadSampleSize,
    warnings,
  };
}
