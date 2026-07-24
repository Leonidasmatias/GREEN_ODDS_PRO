// Fase 3.5 - Observabilidade e Validacao em Producao.
// Configuracao centralizada da camada de observabilidade. Por padrao a
// observabilidade fica DESATIVADA (OBSERVABILITY_ENABLED=false) e usa
// armazenamento em memoria — nada e persistido em banco real sem
// configuracao explicita. Nenhuma variavel aqui controla credenciais da
// BetsAPI (essa camada nunca acessa BETSAPI_TOKEN).
//
// CORRECAO (pos-auditoria da Fase 3.5): a formula do DataQualityEngine foi
// corrigida para incluir os 6 sub-scores obrigatorios (completeness,
// consistency, classification, duplication, freshness, providerReliability)
// na escala 0..100. Isso adicionou 2 pesos novos (OBSERVABILITY_FRESHNESS_WEIGHT,
// OBSERVABILITY_PROVIDER_RELIABILITY_WEIGHT) e 1 variavel nova
// (OBSERVABILITY_STALE_DATA_MINUTES), e mudou a ESCALA (nao o nome) de
// OBSERVABILITY_READINESS_MIN_SCORE de 0..1 (default 0.75) para 0..100
// (default 75), pois esse limiar agora e comparado diretamente contra
// overallScore/completenessScore/etc, que passaram a ser 0..100.

import type { AlertSeverity } from "./types.ts";

export type ObservabilityStorageMode = "memory" | "prisma";

/**
 * Pesos centralizados da formula obrigatoria do DataQualityEngine. Somam
 * exatamente 1 (renormalizados automaticamente se a soma configurada
 * desviar). PROVISORIOS, documentados na Secao 8 de
 * docs/OBSERVABILITY_AND_PRODUCTION_VALIDATION.md.
 */
export type ObservabilityQualityWeights = {
  completeness: number;
  consistency: number;
  classification: number;
  duplicate: number;
  freshness: number;
  providerReliability: number;
};

export type ObservabilityConfig = {
  enabled: boolean;
  retentionDays: number;
  sampleSizeMax: number;
  alertsEnabled: boolean;
  alertMinSeverity: AlertSeverity;
  storageMode: ObservabilityStorageMode;
  weights: ObservabilityQualityWeights;
  readinessMinSampleSize: number;
  /** Escala 0..100 (nao 0..1) - comparado diretamente contra DataQualitySnapshot.overallScore/etc. */
  readinessMinScore: number;
  latencyP95ThresholdMs: number;
  errorRateThreshold: number;
  duplicateRateThreshold: number;
  /** Minutos ate que dados/sincronizacao deixem de ser considerados "frescos" (FreshnessScore.ts). */
  staleDataMinutes: number;
};

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_SAMPLE_SIZE_MAX = 500;
const DEFAULT_STORAGE_MODE: ObservabilityStorageMode = "memory";

// Pesos da formula obrigatoria (Secao 8): somam exatamente 1.
const DEFAULT_WEIGHT_COMPLETENESS = 0.25;
const DEFAULT_WEIGHT_CONSISTENCY = 0.2;
const DEFAULT_WEIGHT_CLASSIFICATION = 0.2;
const DEFAULT_WEIGHT_DUPLICATE = 0.15;
const DEFAULT_WEIGHT_FRESHNESS = 0.1;
const DEFAULT_WEIGHT_PROVIDER_RELIABILITY = 0.1;

const DEFAULT_READINESS_MIN_SAMPLE_SIZE = 30;
/** Escala 0..100 desde a correcao (era 0.75 em escala 0..1). */
const DEFAULT_READINESS_MIN_SCORE = 75;
const DEFAULT_LATENCY_P95_THRESHOLD_MS = 5000;
const DEFAULT_ERROR_RATE_THRESHOLD = 0.1;
const DEFAULT_DUPLICATE_RATE_THRESHOLD = 0.05;
const DEFAULT_ALERT_MIN_SEVERITY: AlertSeverity = "warning";
const DEFAULT_STALE_DATA_MINUTES = 60;

const VALID_STORAGE_MODES: ObservabilityStorageMode[] = ["memory", "prisma"];
const VALID_SEVERITIES: AlertSeverity[] = ["info", "warning", "critical"];
const WEIGHT_SUM_TOLERANCE = 1e-6;

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.trim().toLowerCase() === "true";
}

function parseNonNegativeInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return defaultValue;
  return parsed;
}

function parseRatio(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return defaultValue;
  return parsed;
}

/** Igual a parseRatio, mas para valores na escala 0..100 (usado por readinessMinScore desde a correcao). */
function parseScore0to100(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return defaultValue;
  return parsed;
}

/**
 * Carrega a ObservabilityConfig a partir de variaveis de ambiente (18
 * variaveis nomeadas apos a correcao dos 2 sub-scores/1 janela de frescor,
 * todas com default seguro). Os pesos do DataQualityEngine sao normalizados
 * para somar exatamente 1 caso a soma informada se desvie (protege contra
 * configuracao manual inconsistente sem nunca lancar erro em runtime de
 * producao).
 */
export function loadObservabilityConfig(env: Record<string, string | undefined> = process.env): ObservabilityConfig {
  const storageModeRaw = (env.OBSERVABILITY_STORAGE_MODE ?? DEFAULT_STORAGE_MODE).trim().toLowerCase();
  const storageMode = VALID_STORAGE_MODES.includes(storageModeRaw as ObservabilityStorageMode)
    ? (storageModeRaw as ObservabilityStorageMode)
    : DEFAULT_STORAGE_MODE;

  const severityRaw = (env.OBSERVABILITY_ALERT_MIN_SEVERITY ?? DEFAULT_ALERT_MIN_SEVERITY).trim().toLowerCase();
  const alertMinSeverity = VALID_SEVERITIES.includes(severityRaw as AlertSeverity)
    ? (severityRaw as AlertSeverity)
    : DEFAULT_ALERT_MIN_SEVERITY;

  const rawWeights = {
    completeness: parseRatio(env.OBSERVABILITY_COMPLETENESS_WEIGHT, DEFAULT_WEIGHT_COMPLETENESS),
    consistency: parseRatio(env.OBSERVABILITY_CONSISTENCY_WEIGHT, DEFAULT_WEIGHT_CONSISTENCY),
    classification: parseRatio(env.OBSERVABILITY_CLASSIFICATION_WEIGHT, DEFAULT_WEIGHT_CLASSIFICATION),
    duplicate: parseRatio(env.OBSERVABILITY_DUPLICATE_WEIGHT, DEFAULT_WEIGHT_DUPLICATE),
    freshness: parseRatio(env.OBSERVABILITY_FRESHNESS_WEIGHT, DEFAULT_WEIGHT_FRESHNESS),
    providerReliability: parseRatio(env.OBSERVABILITY_PROVIDER_RELIABILITY_WEIGHT, DEFAULT_WEIGHT_PROVIDER_RELIABILITY),
  };
  const weightSum =
    rawWeights.completeness +
    rawWeights.consistency +
    rawWeights.classification +
    rawWeights.duplicate +
    rawWeights.freshness +
    rawWeights.providerReliability;
  const weights: ObservabilityQualityWeights =
    weightSum > WEIGHT_SUM_TOLERANCE
      ? {
          completeness: rawWeights.completeness / weightSum,
          consistency: rawWeights.consistency / weightSum,
          classification: rawWeights.classification / weightSum,
          duplicate: rawWeights.duplicate / weightSum,
          freshness: rawWeights.freshness / weightSum,
          providerReliability: rawWeights.providerReliability / weightSum,
        }
      : {
          completeness: DEFAULT_WEIGHT_COMPLETENESS,
          consistency: DEFAULT_WEIGHT_CONSISTENCY,
          classification: DEFAULT_WEIGHT_CLASSIFICATION,
          duplicate: DEFAULT_WEIGHT_DUPLICATE,
          freshness: DEFAULT_WEIGHT_FRESHNESS,
          providerReliability: DEFAULT_WEIGHT_PROVIDER_RELIABILITY,
        };

  return {
    enabled: parseBoolean(env.OBSERVABILITY_ENABLED, false),
    retentionDays: parseNonNegativeInt(env.OBSERVABILITY_RETENTION_DAYS, DEFAULT_RETENTION_DAYS),
    sampleSizeMax: parseNonNegativeInt(env.OBSERVABILITY_SAMPLE_SIZE_MAX, DEFAULT_SAMPLE_SIZE_MAX),
    alertsEnabled: parseBoolean(env.OBSERVABILITY_ALERTS_ENABLED, false),
    alertMinSeverity,
    storageMode,
    weights,
    readinessMinSampleSize: parseNonNegativeInt(env.OBSERVABILITY_READINESS_MIN_SAMPLE_SIZE, DEFAULT_READINESS_MIN_SAMPLE_SIZE),
    readinessMinScore: parseScore0to100(env.OBSERVABILITY_READINESS_MIN_SCORE, DEFAULT_READINESS_MIN_SCORE),
    latencyP95ThresholdMs: parseNonNegativeInt(env.OBSERVABILITY_LATENCY_P95_THRESHOLD_MS, DEFAULT_LATENCY_P95_THRESHOLD_MS),
    errorRateThreshold: parseRatio(env.OBSERVABILITY_ERROR_RATE_THRESHOLD, DEFAULT_ERROR_RATE_THRESHOLD),
    duplicateRateThreshold: parseRatio(env.OBSERVABILITY_DUPLICATE_RATE_THRESHOLD, DEFAULT_DUPLICATE_RATE_THRESHOLD),
    staleDataMinutes: parseNonNegativeInt(env.OBSERVABILITY_STALE_DATA_MINUTES, DEFAULT_STALE_DATA_MINUTES),
  };
}
