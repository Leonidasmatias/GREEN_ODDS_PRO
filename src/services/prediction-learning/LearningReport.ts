// Fase 5 — Sprint 5.1 — Learning Data Foundation & Drift Detection.
// Módulo principal: orquestra `HistoricalProfileEngine` +
// `WindowComparisonEngine` + `DriftDetectionEngine` +
// `ReliabilityRankingEngine` em um único `LearningReport` serializável.
// Nunca lê `Date.now()`/relógio do sistema, gera UUID aleatório ou
// qualquer valor dependente do ambiente — `reportId`/`generatedAt` são
// sempre fornecidos pelo chamador. Arredondamento (`config.decimalPlaces`)
// é aplicado apenas nesta camada de serialização, nunca durante o
// cálculo interno das métricas, e nunca sobre `config`.

import { buildHistoricalProfiles, computeHistoricalProfiles } from "./HistoricalProfileEngine.ts";
import { compareWindowSlices, sliceBySequenceWindow } from "./WindowComparisonEngine.ts";
import { detectDrift } from "./DriftDetectionEngine.ts";
import { buildReliabilityRanking } from "./ReliabilityRankingEngine.ts";
import { validatePredictionLearningConfig, type PredictionLearningConfig } from "./PredictionLearningConfig.ts";
import { isFiniteNumber, worseLearningStatus, type LearningDataset, type LearningReport, type LearningReportOptions } from "./types.ts";

function roundNumber(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/** Arredonda recursivamente todo número finito encontrado em `value` para
 * `decimalPlaces` casas decimais — aplicado uma única vez, no final da
 * montagem do relatório, nunca durante o cálculo interno. Números não
 * finitos são preservados sem alteração, nunca silenciosamente zerados. */
function roundDeep<T>(value: T, decimalPlaces: number): T {
  if (typeof value === "number") {
    return (isFiniteNumber(value) ? roundNumber(value, decimalPlaces) : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => roundDeep(item, decimalPlaces)) as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = roundDeep(entryValue, decimalPlaces);
    }
    return result as T;
  }
  return value;
}

/**
 * Monta o relatório final de aprendizado/drift. Lança
 * `PredictionLearningConfigurationError` para uma configuração inválida
 * (delegado a `validatePredictionLearningConfig`); nunca lança por causa
 * da qualidade dos dados — datasets vazios ou inválidos produzem um
 * relatório com `status` apropriado, nunca uma exceção.
 */
export function buildLearningReport(dataset: LearningDataset, config: PredictionLearningConfig, options: LearningReportOptions): LearningReport {
  validatePredictionLearningConfig(config);

  const profileResult = buildHistoricalProfiles(dataset.records, config);

  const baselineSlice = sliceBySequenceWindow(profileResult.validRecords, options.baselineWindow);
  const currentSlice = sliceBySequenceWindow(profileResult.validRecords, options.currentWindow);
  const baselineProfiles = computeHistoricalProfiles(baselineSlice.records, config);
  const currentProfiles = computeHistoricalProfiles(currentSlice.records, config);

  // Reaproveita as fatias já calculadas acima (`baselineSlice`/`currentSlice`)
  // em vez de chamar `compareLearningWindows` (que fatiaria novamente a
  // partir dos registros brutos) — evita recomputar o mesmo fatiamento.
  const windowComparison = compareWindowSlices(options.baselineWindow, baselineSlice, options.currentWindow, currentSlice, config);
  const driftSignals = detectDrift(baselineProfiles, currentProfiles, config);
  const reliabilityRankings = buildReliabilityRanking(currentProfiles, config, driftSignals);

  const warnings = [...profileResult.warnings, ...windowComparison.baseline.warnings, ...windowComparison.current.warnings];

  const datasetSummary = {
    datasetId: dataset.datasetId,
    totalRecords: dataset.records.length,
    validRecords: profileResult.validRecords.length,
    ignoredRecords: dataset.records.length - profileResult.validRecords.length,
    baselineRecords: baselineSlice.records.length,
    currentRecords: currentSlice.records.length,
  };

  const status = worseLearningStatus(profileResult.status, windowComparison.status);

  // `config` é deliberadamente excluído do arredondamento — mesma razão
  // documentada em `EvaluationReport.ts` (Sprint 4.5): arredondar
  // `numericTolerance`/limiares de drift junto com as métricas calculadas
  // poderia corrompê-los silenciosamente.
  const roundedPortion = roundDeep(
    {
      datasetSummary,
      historicalProfiles: profileResult.profiles,
      windowComparisons: [windowComparison],
      driftSignals,
      reliabilityRankings,
    },
    config.decimalPlaces,
  );

  return {
    reportId: options.reportId,
    generatedAt: options.generatedAt ?? null,
    modelVersion: config.modelVersion,
    config,
    ...roundedPortion,
    warnings,
    rejectedRecords: profileResult.rejectedRecords,
    status,
  };
}
