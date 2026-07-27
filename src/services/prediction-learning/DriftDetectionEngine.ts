// Fase 5 — Sprint 5.1 — Learning Data Foundation & Drift Detection.
// Drift Detection Engine: compara perfis históricos de duas janelas
// (baseline/current) já construídos por `HistoricalProfileEngine` e
// emite sinais técnicos de drift — nunca recalcula métricas (reaproveita
// `HistoricalProfile.metrics`, já calculado via `computeEvaluationMetrics`
// da Sprint 4.5). Nunca declara drift com amostra insuficiente. Função
// pura: nenhum acesso a Prisma, rede, relógio do sistema, `Math.random()`
// ou UUID — o `id` de cada sinal é composto deterministicamente.

import { PROFILE_DIMENSION_ORDER, isFiniteNumber, type DriftDirection, type DriftSeverity, type DriftSignal, type DriftSignalType, type HistoricalProfile } from "./types.ts";
import type { PredictionLearningConfig } from "./PredictionLearningConfig.ts";

type DriftMetricKey = "accuracy" | "brierScore" | "logLoss" | "averageConfidence";

const DRIFT_METRICS: DriftMetricKey[] = ["accuracy", "brierScore", "logLoss", "averageConfidence"];

function thresholdFor(metric: DriftMetricKey, config: PredictionLearningConfig): number {
  if (metric === "accuracy") return config.accuracyDriftThreshold;
  if (metric === "brierScore") return config.brierDriftThreshold;
  if (metric === "logLoss") return config.logLossDriftThreshold;
  return config.confidenceDriftThreshold;
}

/** `HIGHER_IS_BETTER` para accuracy; `LOWER_IS_BETTER` para Brier/Log
 * Loss; `averageConfidence` nunca é interpretado isoladamente como
 * melhora ou piora — sempre `NEUTRAL`. */
function directionFor(metric: DriftMetricKey, baselineValue: number, currentValue: number): DriftDirection {
  if (metric === "averageConfidence") return "NEUTRAL";
  if (metric === "accuracy") return currentValue > baselineValue ? "IMPROVEMENT" : "DEGRADATION";
  return currentValue < baselineValue ? "IMPROVEMENT" : "DEGRADATION";
}

function typeFor(metric: DriftMetricKey, direction: DriftDirection): DriftSignalType {
  if (metric === "averageConfidence") return "CONFIDENCE_SHIFT";
  if (direction === "IMPROVEMENT") return "PERFORMANCE_IMPROVEMENT";
  return metric === "accuracy" ? "PERFORMANCE_DEGRADATION" : "CALIBRATION_DEGRADATION";
}

/**
 * Severidade a partir da magnitude do delta relativa ao limiar
 * configurado: dentro da tolerância numérica não há sinal (tratado antes
 * desta função); entre a tolerância e `threshold * warningMultiplier` é
 * `INFO`; até `threshold * criticalMultiplier` é `WARNING`; acima disso é
 * `CRITICAL`. Aplicado uniformemente independente da direção (melhora ou
 * piora) — a severidade mede magnitude da mudança, não se ela é boa ou
 * ruim.
 */
function severityFor(magnitude: number, threshold: number, config: PredictionLearningConfig): DriftSeverity {
  if (magnitude >= threshold * config.criticalSeverityMultiplier) return "CRITICAL";
  if (magnitude >= threshold * config.warningSeverityMultiplier) return "WARNING";
  return "INFO";
}

function buildSignalId(dimension: string, key: string, type: DriftSignalType, metric: string): string {
  return `${dimension}:${key}:${type}:${metric}`;
}

function buildMetricSignal(
  profileDimension: HistoricalProfile["dimension"],
  key: string,
  metric: DriftMetricKey,
  baseline: HistoricalProfile,
  current: HistoricalProfile,
  config: PredictionLearningConfig,
): DriftSignal | null {
  const baselineValue = baseline.metrics[metric];
  const currentValue = current.metrics[metric];
  if (!isFiniteNumber(baselineValue) || !isFiniteNumber(currentValue)) return null;

  const absoluteDelta = currentValue - baselineValue;
  const magnitude = Math.abs(absoluteDelta);
  if (magnitude <= config.numericTolerance) return null;

  const threshold = thresholdFor(metric, config);
  const direction = directionFor(metric, baselineValue, currentValue);
  const type = typeFor(metric, direction);
  const severity = severityFor(magnitude, threshold, config);
  const relativeDelta = Math.abs(baselineValue) > config.numericTolerance ? (absoluteDelta / baselineValue) * 100 : null;

  return {
    id: buildSignalId(profileDimension, key, type, metric),
    dimension: profileDimension,
    key,
    type,
    severity,
    metric,
    baselineValue,
    currentValue,
    absoluteDelta,
    relativeDelta,
    threshold,
    direction,
    reason: `${metric} changed by ${absoluteDelta} (baseline=${baselineValue}, current=${currentValue}), threshold=${threshold}`,
    baselineRecords: baseline.validRecords,
    currentRecords: current.validRecords,
  };
}

function buildSampleInsufficientSignal(
  profileDimension: HistoricalProfile["dimension"],
  key: string,
  baseline: HistoricalProfile,
  current: HistoricalProfile,
  config: PredictionLearningConfig,
): DriftSignal {
  return {
    id: buildSignalId(profileDimension, key, "SAMPLE_INSUFFICIENT", "sampleSize"),
    dimension: profileDimension,
    key,
    type: "SAMPLE_INSUFFICIENT",
    severity: "INFO",
    metric: "sampleSize",
    baselineValue: baseline.validRecords,
    currentValue: current.validRecords,
    absoluteDelta: current.validRecords - baseline.validRecords,
    relativeDelta: null,
    threshold: config.minimumRecordsForDrift,
    direction: "NEUTRAL",
    reason: `insufficient sample for drift detection (baselineRecords=${baseline.validRecords}, currentRecords=${current.validRecords}, minimumRecordsForDrift=${config.minimumRecordsForDrift})`,
    baselineRecords: baseline.validRecords,
    currentRecords: current.validRecords,
  };
}

function buildPresenceSignal(
  profileDimension: HistoricalProfile["dimension"],
  key: string,
  type: "PROFILE_EMERGED" | "PROFILE_DISAPPEARED",
  baseline: HistoricalProfile | undefined,
  current: HistoricalProfile | undefined,
): DriftSignal {
  return {
    id: buildSignalId(profileDimension, key, type, "presence"),
    dimension: profileDimension,
    key,
    type,
    severity: "INFO",
    metric: "presence",
    baselineValue: null,
    currentValue: null,
    absoluteDelta: null,
    relativeDelta: null,
    threshold: 0,
    direction: "NEUTRAL",
    reason: type === "PROFILE_EMERGED" ? `profile ${profileDimension}:${key} present only in the current window` : `profile ${profileDimension}:${key} present only in the baseline window`,
    baselineRecords: baseline?.validRecords ?? 0,
    currentRecords: current?.validRecords ?? 0,
  };
}

function profileMapKey(profile: HistoricalProfile): string {
  return `${profile.dimension}::${profile.key}`;
}

/**
 * Une as chaves de `baselineProfiles`/`currentProfiles` e as ordena
 * canonicamente (dimensão em ordem fixa, depois chave em ordem
 * alfabética) — nunca pela ordem de chegada nas listas de entrada.
 * Resultado estável independentemente da ordem de `baselineProfiles`/
 * `currentProfiles`.
 */
function orderedUnionKeys(baselineProfiles: HistoricalProfile[], currentProfiles: HistoricalProfile[]): string[] {
  const seen = new Map<string, { dimension: HistoricalProfile["dimension"]; key: string }>();
  for (const profile of [...baselineProfiles, ...currentProfiles]) {
    const mapKey = profileMapKey(profile);
    if (!seen.has(mapKey)) seen.set(mapKey, { dimension: profile.dimension, key: profile.key });
  }
  return [...seen.entries()]
    .sort(([, a], [, b]) => {
      const rankA = PROFILE_DIMENSION_ORDER.indexOf(a.dimension);
      const rankB = PROFILE_DIMENSION_ORDER.indexOf(b.dimension);
      if (rankA !== rankB) return rankA - rankB;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    })
    .map(([mapKey]) => mapKey);
}

/**
 * Detecta sinais de drift comparando perfis de duas janelas (baseline e
 * current) já construídos. Nunca declara drift para uma dimensão+chave
 * cuja amostra (em qualquer um dos lados) esteja abaixo de
 * `config.minimumRecordsForDrift` — emite apenas um sinal
 * `SAMPLE_INSUFFICIENT` nesse caso. Resultado determinístico
 * independente da ordem de `baselineProfiles`/`currentProfiles`.
 */
export function detectDrift(baselineProfiles: HistoricalProfile[], currentProfiles: HistoricalProfile[], config: PredictionLearningConfig): DriftSignal[] {
  const baselineMap = new Map(baselineProfiles.map((profile) => [profileMapKey(profile), profile]));
  const currentMap = new Map(currentProfiles.map((profile) => [profileMapKey(profile), profile]));

  const signals: DriftSignal[] = [];
  for (const mapKey of orderedUnionKeys(baselineProfiles, currentProfiles)) {
    const baseline = baselineMap.get(mapKey);
    const current = currentMap.get(mapKey);

    if (baseline && !current) {
      signals.push(buildPresenceSignal(baseline.dimension, baseline.key, "PROFILE_DISAPPEARED", baseline, current));
      continue;
    }
    if (!baseline && current) {
      signals.push(buildPresenceSignal(current.dimension, current.key, "PROFILE_EMERGED", baseline, current));
      continue;
    }
    if (!baseline || !current) continue;

    if (baseline.validRecords < config.minimumRecordsForDrift || current.validRecords < config.minimumRecordsForDrift) {
      signals.push(buildSampleInsufficientSignal(baseline.dimension, baseline.key, baseline, current, config));
      continue;
    }

    for (const metric of DRIFT_METRICS) {
      const signal = buildMetricSignal(baseline.dimension, baseline.key, metric, baseline, current, config);
      if (signal) signals.push(signal);
    }
  }

  return signals;
}
