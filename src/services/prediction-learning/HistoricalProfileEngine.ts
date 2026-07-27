// Fase 5 — Sprint 5.1 — Learning Data Foundation & Drift Detection.
// Historical Profile Engine: valida registros de aprendizado (política
// configurável), agrupa por dimensão e calcula perfis estatísticos —
// reaproveitando INTEGRALMENTE `computeEvaluationMetrics` (Sprint 4.5)
// para todo o cálculo de accuracy/Brier/Log Loss/precisão/recall, nunca
// reimplementado aqui. Nunca recalcula previsões, nunca altera o
// Prediction Engine, nunca acessa Prisma/rede/relógio. Função pura: nunca
// muta os registros recebidos.

import { computeEvaluationMetrics, type OutcomeProbabilityPair } from "../prediction-evaluation/index.ts";
import type { PredictionLearningConfig } from "./PredictionLearningConfig.ts";
import {
  GLOBAL_PROFILE_KEY,
  PROFILE_DIMENSION_ORDER,
  isFiniteNumber,
  type GreenScoreCategory,
  type HistoricalProfile,
  type LearningHistoricalRecord,
  type LearningStatus,
  type LearningWarning,
  type MatchOutcome,
  type ProfileDimension,
  type RejectedLearningRecord,
} from "./types.ts";

export type HistoricalProfileResult = {
  profiles: HistoricalProfile[];
  validRecords: LearningHistoricalRecord[];
  warnings: LearningWarning[];
  rejectedRecords: RejectedLearningRecord[];
  status: LearningStatus;
};

const VALID_OUTCOMES: MatchOutcome[] = ["HOME_WIN", "DRAW", "AWAY_WIN"];
const VALID_GREEN_SCORE_CATEGORIES: GreenScoreCategory[] = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"];
const PROBABILITY_SUM_TOLERANCE = 1e-6;

/**
 * Motivo estruturado de invalidade de UM registro — reimplementação
 * deliberada da validação da Sprint 4.4 (`PredictionValidator.ts`) para a
 * forma achatada de `LearningHistoricalRecord`, incompatível com
 * `PredictionQualityRecord` (que exige um `PredictionResult` completo).
 * Mesmo padrão de "reimplementar por incompatibilidade de forma, nunca
 * duplicar a fórmula" já documentado em `SegmentMetrics.ts` (Sprint 4.5).
 */
function findInvalidLearningReason(record: LearningHistoricalRecord): string | null {
  if (typeof record.matchId !== "string" || record.matchId.trim().length === 0) return "missing_or_empty_matchId";
  if (typeof record.homePlayerId !== "string" || record.homePlayerId.trim().length === 0) return "missing_or_empty_homePlayerId";
  if (typeof record.awayPlayerId !== "string" || record.awayPlayerId.trim().length === 0) return "missing_or_empty_awayPlayerId";
  if (!VALID_OUTCOMES.includes(record.predictedOutcome)) return "invalid_predictedOutcome";
  if (!VALID_OUTCOMES.includes(record.actualOutcome)) return "invalid_actualOutcome";

  const { homeWin, draw, awayWin } = record.probabilities;
  for (const [name, value] of Object.entries({ homeWin, draw, awayWin })) {
    if (!isFiniteNumber(value) || value < 0 || value > 1) return `invalid_probability_${name}`;
  }
  if (Math.abs(homeWin + draw + awayWin - 1) > PROBABILITY_SUM_TOLERANCE) return "probabilities_do_not_sum_to_one";

  if (!isFiniteNumber(record.confidence) || record.confidence < 0 || record.confidence > 100) return "invalid_confidence";
  if (!VALID_GREEN_SCORE_CATEGORIES.includes(record.greenScoreCategory)) return "invalid_greenScoreCategory";

  if (record.sequenceKey !== null && typeof record.sequenceKey !== "number" && typeof record.sequenceKey !== "string") {
    return "invalid_sequenceKey_type";
  }

  return null;
}

/** Deduplica preservando a primeira ocorrência (ordem determinística de
 * entrada); ocorrências subsequentes do mesmo `matchId` são reportadas
 * como duplicatas, nunca silenciosamente sobrescritas. */
function deduplicateByMatchId(records: LearningHistoricalRecord[]): { unique: LearningHistoricalRecord[]; duplicateMatchIds: string[] } {
  const seen = new Set<string>();
  const unique: LearningHistoricalRecord[] = [];
  const duplicateMatchIds: string[] = [];
  for (const record of records) {
    if (seen.has(record.matchId)) {
      duplicateMatchIds.push(record.matchId);
      continue;
    }
    seen.add(record.matchId);
    unique.push(record);
  }
  return { unique, duplicateMatchIds };
}

export function toEvaluationPair(record: LearningHistoricalRecord): OutcomeProbabilityPair {
  return {
    matchId: record.matchId,
    probabilities: record.probabilities,
    confidence: record.confidence,
    actualOutcome: record.actualOutcome,
  };
}

function statusForSampleSize(sampleSize: number, minimumRecords: number): LearningStatus {
  if (sampleSize === 0) return "EMPTY";
  if (sampleSize < minimumRecords) return "INSUFFICIENT_SAMPLE";
  return "OK";
}

type SequenceKeyType = "string" | "number";

/** Reaproveitada por `WindowComparisonEngine` — única fonte de verdade
 * para detectar o tipo homogêneo de `sequenceKey` presente num conjunto
 * de registros (`null` quando ausente ou quando os tipos são mistos). */
export function detectSequenceKeyType(records: LearningHistoricalRecord[]): SequenceKeyType | null {
  let detected: SequenceKeyType | null = null;
  for (const record of records) {
    if (record.sequenceKey === null) continue;
    const type: SequenceKeyType = typeof record.sequenceKey === "number" ? "number" : "string";
    if (detected === null) detected = type;
    else if (detected !== type) return null;
  }
  return detected;
}

function compareSequenceKeys(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

/** `null` quando nenhum registro do grupo possui `sequenceKey`, ou quando
 * os tipos presentes são incompatíveis entre si — nunca uma ordem
 * inventada. */
function firstAndLastSequenceKey(
  records: LearningHistoricalRecord[],
): { first: string | number | null; last: string | number | null; warning: LearningWarning | null } {
  const keyType = detectSequenceKeyType(records);
  if (keyType === null) {
    const hasAnySequenceKey = records.some((record) => record.sequenceKey !== null);
    return {
      first: null,
      last: null,
      warning: hasAnySequenceKey ? { code: "MIXED_SEQUENCE_KEY_TYPES", dimension: null, key: null, details: null } : null,
    };
  }
  const withKey = records.filter((record) => record.sequenceKey !== null);
  const sorted = [...withKey].sort((a, b) => compareSequenceKeys(a.sequenceKey as string | number, b.sequenceKey as string | number));
  return { first: sorted[0]?.sequenceKey ?? null, last: sorted[sorted.length - 1]?.sequenceKey ?? null, warning: null };
}

function buildProfile(
  dimension: ProfileDimension,
  key: string,
  records: LearningHistoricalRecord[],
  config: PredictionLearningConfig,
): HistoricalProfile {
  const metrics = computeEvaluationMetrics(records.map(toEvaluationPair));
  const status = statusForSampleSize(records.length, config.minimumRecordsPerProfile);
  const { first, last, warning } = firstAndLastSequenceKey(records);

  const warnings: LearningWarning[] = [];
  if (status !== "OK") {
    warnings.push({
      code: "PROFILE_INSUFFICIENT_SAMPLE",
      dimension,
      key,
      details: `${dimension}:${key} sampleSize=${records.length}`,
    });
  }
  if (warning) warnings.push({ ...warning, dimension, key });

  return { dimension, key, totalRecords: records.length, validRecords: records.length, status, metrics, firstSequenceKey: first, lastSequenceKey: last, warnings };
}

function sortedEntries(groups: Map<string, LearningHistoricalRecord[]>): [string, LearningHistoricalRecord[]][] {
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function groupBySingleKey(
  records: LearningHistoricalRecord[],
  keyOf: (record: LearningHistoricalRecord) => string | null,
): Map<string, LearningHistoricalRecord[]> {
  const groups = new Map<string, LearningHistoricalRecord[]>();
  for (const record of records) {
    const key = keyOf(record);
    if (key === null) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(record);
    else groups.set(key, [record]);
  }
  return groups;
}

function globalProfiles(records: LearningHistoricalRecord[], config: PredictionLearningConfig): HistoricalProfile[] {
  return [buildProfile("GLOBAL", GLOBAL_PROFILE_KEY, records, config)];
}

function playerProfiles(records: LearningHistoricalRecord[], config: PredictionLearningConfig): HistoricalProfile[] {
  const groups = new Map<string, LearningHistoricalRecord[]>();
  for (const record of records) {
    for (const playerId of [record.homePlayerId, record.awayPlayerId]) {
      const bucket = groups.get(playerId);
      if (bucket) bucket.push(record);
      else groups.set(playerId, [record]);
    }
  }
  return sortedEntries(groups).map(([key, group]) => buildProfile("PLAYER", key, group, config));
}

function leagueProfiles(records: LearningHistoricalRecord[], config: PredictionLearningConfig): HistoricalProfile[] {
  const groups = groupBySingleKey(records, (record) => record.league);
  return sortedEntries(groups).map(([key, group]) => buildProfile("LEAGUE", key, group, config));
}

function virtualTeamProfiles(records: LearningHistoricalRecord[], config: PredictionLearningConfig): HistoricalProfile[] {
  const groups = new Map<string, LearningHistoricalRecord[]>();
  for (const record of records) {
    for (const team of [record.virtualTeamHome, record.virtualTeamAway]) {
      if (team === null) continue;
      const bucket = groups.get(team);
      if (bucket) bucket.push(record);
      else groups.set(team, [record]);
    }
  }
  return sortedEntries(groups).map(([key, group]) => buildProfile("VIRTUAL_TEAM", key, group, config));
}

function periodProfiles(records: LearningHistoricalRecord[], config: PredictionLearningConfig): HistoricalProfile[] {
  const groups = groupBySingleKey(records, (record) => record.period);
  return sortedEntries(groups).map(([key, group]) => buildProfile("PERIOD", key, group, config));
}

function homeAwayKey(predictedOutcome: MatchOutcome): "HOME" | "AWAY" | "NEUTRAL" {
  if (predictedOutcome === "HOME_WIN") return "HOME";
  if (predictedOutcome === "AWAY_WIN") return "AWAY";
  return "NEUTRAL";
}

const HOME_AWAY_KEYS: ("HOME" | "AWAY" | "NEUTRAL")[] = ["HOME", "AWAY", "NEUTRAL"];

function homeAwayProfiles(records: LearningHistoricalRecord[], config: PredictionLearningConfig): HistoricalProfile[] {
  return HOME_AWAY_KEYS.map((key) => buildProfile("HOME_AWAY", key, records.filter((record) => homeAwayKey(record.predictedOutcome) === key), config));
}

function predictedOutcomeProfiles(records: LearningHistoricalRecord[], config: PredictionLearningConfig): HistoricalProfile[] {
  return VALID_OUTCOMES.map((key) => buildProfile("PREDICTED_OUTCOME", key, records.filter((record) => record.predictedOutcome === key), config));
}

function greenScoreProfiles(records: LearningHistoricalRecord[], config: PredictionLearningConfig): HistoricalProfile[] {
  return VALID_GREEN_SCORE_CATEGORIES.map((key) => buildProfile("GREEN_SCORE", key, records.filter((record) => record.greenScoreCategory === key), config));
}

/** Rótulo da faixa de confiança a partir de `config.confidenceBuckets` —
 * mesma convenção da Sprint 4.5 (última faixa inclusiva em ambas as
 * extremidades). */
function confidenceBucketLabel(confidence: number, boundaries: number[]): string | null {
  if (!isFiniteNumber(confidence)) return null;
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const isLast = i === boundaries.length - 2;
    if (confidence >= start && (isLast ? confidence <= end : confidence < end)) return `${start}-${end}`;
  }
  return null;
}

function confidenceBucketProfiles(records: LearningHistoricalRecord[], config: PredictionLearningConfig): HistoricalProfile[] {
  const groups = groupBySingleKey(records, (record) => confidenceBucketLabel(record.confidence, config.confidenceBuckets));
  const boundaries = config.confidenceBuckets;
  const labels: string[] = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) labels.push(`${boundaries[i]}-${boundaries[i + 1]}`);
  return labels.map((key) => buildProfile("CONFIDENCE_BUCKET", key, groups.get(key) ?? [], config));
}

/**
 * Calcula `HistoricalProfile[]` para todas as dimensões habilitadas em
 * `config.enabledDimensions`, na ordem fixa das dimensões e, dentro de
 * cada uma, em ordem determinística de chave. Assume que `records` já
 * passou por validação (nunca revalida) — usada tanto para o dataset
 * completo quanto para fatias de janela (`WindowComparisonEngine`).
 */
export function computeHistoricalProfiles(records: LearningHistoricalRecord[], config: PredictionLearningConfig): HistoricalProfile[] {
  const builders: Record<ProfileDimension, () => HistoricalProfile[]> = {
    GLOBAL: () => globalProfiles(records, config),
    PLAYER: () => playerProfiles(records, config),
    LEAGUE: () => leagueProfiles(records, config),
    VIRTUAL_TEAM: () => virtualTeamProfiles(records, config),
    HOME_AWAY: () => homeAwayProfiles(records, config),
    PERIOD: () => periodProfiles(records, config),
    PREDICTED_OUTCOME: () => predictedOutcomeProfiles(records, config),
    GREEN_SCORE: () => greenScoreProfiles(records, config),
    CONFIDENCE_BUCKET: () => confidenceBucketProfiles(records, config),
  };

  const result: HistoricalProfile[] = [];
  for (const dimension of PROFILE_DIMENSION_ORDER) {
    if (!config.enabledDimensions.includes(dimension)) continue;
    result.push(...builders[dimension]());
  }
  return result;
}

/**
 * Ponto de entrada principal: deduplica, valida (política configurável) e
 * constrói os perfis históricos completos a partir de um dataset bruto.
 * Nunca lança exceção por causa da qualidade dos dados — apenas por
 * configuração inválida (delegado a `validatePredictionLearningConfig`,
 * chamado por `LearningReport`). Nunca muta `records`.
 */
export function buildHistoricalProfiles(records: LearningHistoricalRecord[], config: PredictionLearningConfig): HistoricalProfileResult {
  const warnings: LearningWarning[] = [];
  const rejectedRecords: RejectedLearningRecord[] = [];

  const { unique, duplicateMatchIds } = deduplicateByMatchId(records);
  for (const matchId of duplicateMatchIds) {
    warnings.push({ code: "DUPLICATE_MATCH_ID", dimension: null, key: null, details: `duplicate matchId: ${matchId}` });
    if (config.invalidRecordPolicy === "collect") rejectedRecords.push({ matchId, reason: "duplicate_match_id" });
  }

  const validRecords: LearningHistoricalRecord[] = [];
  let hasInvalid = false;
  for (const record of unique) {
    const reason = findInvalidLearningReason(record);
    if (reason === null) {
      validRecords.push(record);
      continue;
    }
    hasInvalid = true;
    warnings.push({ code: "INVALID_RECORD_EXCLUDED", dimension: null, key: null, details: `${record.matchId}:${reason}` });
    if (config.invalidRecordPolicy === "collect") rejectedRecords.push({ matchId: record.matchId, reason });
  }

  const hasAnyDataIssue = duplicateMatchIds.length > 0 || hasInvalid;
  const totalRecords = records.length;
  const isDatasetEmpty = totalRecords === 0;

  if (config.invalidRecordPolicy === "reject" && hasAnyDataIssue) {
    return { profiles: [], validRecords: [], warnings, rejectedRecords, status: "REJECTED" };
  }

  if (isDatasetEmpty) {
    warnings.push({ code: "EMPTY_DATASET", dimension: null, key: null, details: null });
    return { profiles: [], validRecords: [], warnings, rejectedRecords, status: "EMPTY" };
  }

  const profiles = computeHistoricalProfiles(validRecords, config);

  let status: LearningStatus;
  if (validRecords.length === 0) {
    status = "EMPTY";
    warnings.push({ code: "EMPTY_DATASET", dimension: null, key: null, details: "no valid records after validation" });
  } else if (validRecords.length < config.minimumRecordsPerProfile) {
    status = "INSUFFICIENT_SAMPLE";
    warnings.push({ code: "INSUFFICIENT_SAMPLE_SIZE", dimension: null, key: null, details: `validRecords=${validRecords.length}` });
  } else {
    status = "OK";
  }

  return { profiles, validRecords, warnings, rejectedRecords, status };
}
