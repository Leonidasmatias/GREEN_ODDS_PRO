// Fase 5 — Sprint 5.2 — Adaptive Intelligence & Recommendation Framework.
// Strategy Engine: classifica o estado GERAL do modelo (não por perfil) a
// partir da severidade agregada dos sinais de drift, do status do perfil
// GLOBAL (Sprint 5.1) e da confiabilidade global — nunca recalcula
// métricas. Função pura: nenhum acesso a Prisma, rede, relógio do sistema
// ou número aleatório.
//
// Regra determinística (primeira que casar vence):
//   - qualquer sinal de degradação CRITICAL em qualquer perfil -> CRITICAL
//   - qualquer sinal de degradação WARNING em qualquer perfil  -> WARNING
//   - sinal de degradação INFO, OU perfil GLOBAL != OK, OU
//     confiabilidade do perfil GLOBAL abaixo do limiar          -> WATCH
//   - nenhuma das anteriores                                    -> NORMAL

import { GLOBAL_PROFILE_KEY } from "../prediction-learning/index.ts";
import type { PredictionAdaptationConfig } from "./PredictionAdaptationConfig.ts";
import type { DriftSignal, HistoricalProfile, ReliabilityRanking, StrategyStatus } from "./types.ts";

function hasDegradationOfSeverity(driftSignals: DriftSignal[], severity: DriftSignal["severity"]): boolean {
  return driftSignals.some((signal) => signal.direction === "DEGRADATION" && signal.severity === severity);
}

/**
 * Classifica o estado geral do modelo. Nunca representa uma recomendação
 * de aposta — apenas o quão de perto o modelo deveria ser observado.
 */
export function classifyStrategy(
  profiles: HistoricalProfile[],
  driftSignals: DriftSignal[],
  reliabilityRanking: ReliabilityRanking,
  config: PredictionAdaptationConfig,
): StrategyStatus {
  if (hasDegradationOfSeverity(driftSignals, "CRITICAL")) return "CRITICAL";
  if (hasDegradationOfSeverity(driftSignals, "WARNING")) return "WARNING";

  const globalProfile = profiles.find((profile) => profile.dimension === "GLOBAL" && profile.key === GLOBAL_PROFILE_KEY);
  const globalRanking = reliabilityRanking.entries.find(
    (entry) => entry.dimension === "GLOBAL" && entry.key === GLOBAL_PROFILE_KEY,
  );

  const globalStatusNotOk = !globalProfile || globalProfile.status !== "OK";
  const globalReliabilityLow = globalRanking !== undefined && globalRanking.reliabilityScore < config.strategyLowReliabilityThreshold;

  if (hasDegradationOfSeverity(driftSignals, "INFO") || globalStatusNotOk || globalReliabilityLow) return "WATCH";

  return "NORMAL";
}
