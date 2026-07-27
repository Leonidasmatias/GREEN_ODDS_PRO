// Fase 4 — Sprint 4.3 — Prediction Orchestrator.
// Módulo principal: ponto de entrada único (`predictMatch`) que executa,
// em ordem, o Prediction Engine (Sprint 4.1), o Goal Distribution Engine
// (Sprint 4.2, recebendo o resultado do primeiro como
// `predictionContext` — nunca lido por ele, apenas transportado para
// validação cruzada futura) e o Prediction Aggregator desta sprint,
// produzindo um `PredictionResult` completo. Não gera EV, Kelly, stake,
// gestão de banca ou recomendação de aposta.
//
// Determinismo: para a mesma `request`/`config`, o resultado numérico é
// sempre idêntico. `now` é injetável e usado apenas para preencher
// `generatedAt` (no Prediction Engine, no Goal Distribution Engine e em
// `metadata`) — nunca para influenciar probabilidades, pesos, confiança
// ou Green Score.

import { createHash } from "node:crypto";
import { predictMatchOutcome } from "../prediction/index.ts";
import { predictGoalDistribution } from "../goal-distribution/index.ts";
import { aggregate } from "./PredictionAggregator.ts";
import { buildPredictionExplanation } from "./PredictionExplanation.ts";
import {
  DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG,
  validatePredictionOrchestratorConfig,
  type PredictionOrchestratorConfig,
} from "./PredictionOrchestratorConfig.ts";
import type { PredictionOrchestratorMetadata, PredictionOrchestratorRequest, PredictionResult } from "./types.ts";

/**
 * Serializa um valor de forma determinística (chaves de objetos
 * ordenadas alfabeticamente, recursivamente) para que o hash de
 * configuração não dependa da ordem de construção do objeto em memória.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;

  const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
  const entries = sortedKeys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(",")}}`;
}

/** Hash SHA-256 determinístico da configuração — usa apenas `node:crypto`
 * (módulo nativo do Node, nenhuma dependência nova adicionada). */
export function computeConfigurationHash(config: PredictionOrchestratorConfig): string {
  return createHash("sha256").update(stableStringify(config)).digest("hex");
}

export function predictMatch(
  request: PredictionOrchestratorRequest,
  config: PredictionOrchestratorConfig = DEFAULT_PREDICTION_ORCHESTRATOR_CONFIG,
  now: () => Date = () => new Date(),
): PredictionResult {
  validatePredictionOrchestratorConfig(config);

  const prediction = predictMatchOutcome(
    { homePlayer: request.homePlayer, awayPlayer: request.awayPlayer, headToHead: request.headToHead },
    config.predictionConfig,
    now,
  );

  const goalDistribution = predictGoalDistribution(
    {
      homePlayer: request.homePlayer,
      awayPlayer: request.awayPlayer,
      headToHead: request.headToHead,
      predictionContext: prediction,
    },
    config.goalDistributionConfig,
    now,
  );

  const finalPrediction = aggregate(prediction, goalDistribution, config);
  const explanation = buildPredictionExplanation(prediction, goalDistribution, config.explanation);

  const metadata: PredictionOrchestratorMetadata = {
    predictionModelVersion: prediction.modelVersion,
    goalDistributionModelVersion: goalDistribution.modelVersion,
    orchestratorModelVersion: config.modelVersion,
    generatedAt: now().toISOString(),
    configurationHash: computeConfigurationHash(config),
  };

  return {
    prediction,
    goalDistribution,
    greenScore: finalPrediction.greenScore,
    confidence: finalPrediction.confidence,
    quality: finalPrediction.dataQuality,
    warnings: finalPrediction.warnings,
    explanation,
    metadata,
  };
}
