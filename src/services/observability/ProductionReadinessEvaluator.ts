// Fase 3.5 - Observabilidade e Validacao em Producao.
// ProductionReadinessEvaluator: converte o DataQualitySnapshot mais
// recente e a lista de alertas ativos em um veredito operacional de
// prontidao. NUNCA e uma recomendacao financeira ou de aposta - apenas
// uma leitura de "os dados e a integracao estao estaveis o suficiente
// para observar com mais confianca", com um vocabulario fechado de
// proximos passos (RecommendedNextAction) que nunca menciona aposta,
// edge, EV, Kelly ou stake.
//
// CRITERIOS (PROVISORIOS, documentados para recalibracao):
//   insufficient_data     -> sampleSize < readinessMinSampleSize (ou sem snapshot)
//   not_ready              -> ha alerta CONFIGURATION_INVALID ou critico ativo,
//                             OU overallScore < readinessMinScore * NOT_READY_SCORE_FLOOR_RATIO
//   ready                  -> overallScore >= readinessMinScore E nenhum alerta warning/critical
//   conditionally_ready    -> qualquer outro caso (score aceitavel mas com ressalvas)

import type { ObservabilityConfig } from "./ObservabilityConfig.ts";
import type {
  DataQualitySnapshot,
  ObservabilityAlert,
  ProductionReadinessResult,
  RecommendedNextAction,
} from "./types.ts";

const NOT_READY_SCORE_FLOOR_RATIO = 0.6;

export type ReadinessEvaluationInput = {
  snapshot: DataQualitySnapshot | null;
  alerts: ObservabilityAlert[];
  now?: () => Date;
};

function countBySeverity(alerts: ObservabilityAlert[]): { critical: number; warning: number } {
  return {
    critical: alerts.filter((alert) => alert.severity === "critical").length,
    warning: alerts.filter((alert) => alert.severity === "warning").length,
  };
}

function buildResult(
  status: ProductionReadinessResult["status"],
  overallScore: number | null,
  sampleSize: number,
  criticalAlertCount: number,
  warningAlertCount: number,
  recommendedNextAction: RecommendedNextAction,
  reasons: string[],
  evaluatedAt: string,
): ProductionReadinessResult {
  return { status, overallScore, sampleSize, criticalAlertCount, warningAlertCount, recommendedNextAction, reasons, evaluatedAt };
}

export function evaluateProductionReadiness(input: ReadinessEvaluationInput, config: ObservabilityConfig): ProductionReadinessResult {
  const now = input.now ?? (() => new Date());
  const evaluatedAt = now().toISOString();
  const sampleSize = input.snapshot?.sampleSize ?? 0;
  const { critical: criticalAlertCount, warning: warningAlertCount } = countBySeverity(input.alerts);
  const overallScore = input.snapshot?.overallScore ?? null;
  const hasConfigurationIssue = input.alerts.some((alert) => alert.type === "CONFIGURATION_INVALID");
  const reasons: string[] = [];

  if (!input.snapshot || sampleSize < config.readinessMinSampleSize) {
    reasons.push(`Amostra insuficiente: ${sampleSize} < minimo configurado (${config.readinessMinSampleSize}).`);
    return buildResult("insufficient_data", overallScore, sampleSize, criticalAlertCount, warningAlertCount, "collect_more_data", reasons, evaluatedAt);
  }

  if (hasConfigurationIssue) {
    reasons.push("Configuracao invalida detectada (alerta CONFIGURATION_INVALID ativo).");
    return buildResult("not_ready", overallScore, sampleSize, criticalAlertCount, warningAlertCount, "resolve_configuration_before_proceeding", reasons, evaluatedAt);
  }

  const scoreFloor = config.readinessMinScore * NOT_READY_SCORE_FLOOR_RATIO;
  if (criticalAlertCount > 0 || (overallScore !== null && overallScore < scoreFloor)) {
    if (criticalAlertCount > 0) reasons.push(`${criticalAlertCount} alerta(s) critico(s) ativo(s).`);
    if (overallScore !== null && overallScore < scoreFloor) reasons.push(`overallScore (${overallScore.toFixed(2)}) abaixo do piso minimo (${scoreFloor.toFixed(2)}).`);
    return buildResult("not_ready", overallScore, sampleSize, criticalAlertCount, warningAlertCount, "investigate_active_alerts", reasons, evaluatedAt);
  }

  if (overallScore !== null && overallScore >= config.readinessMinScore && warningAlertCount === 0) {
    reasons.push(`overallScore (${overallScore.toFixed(2)}) atende o minimo configurado (${config.readinessMinScore.toFixed(2)}) sem alertas ativos.`);
    return buildResult("ready", overallScore, sampleSize, criticalAlertCount, warningAlertCount, "safe_to_expand_observation_window", reasons, evaluatedAt);
  }

  reasons.push("Score aceitavel mas com ressalvas (alertas de warning ativos e/ou score abaixo do ideal) - manter em observacao.");
  return buildResult("conditionally_ready", overallScore, sampleSize, criticalAlertCount, warningAlertCount, "monitor_before_expanding_persistence", reasons, evaluatedAt);
}
