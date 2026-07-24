// Fase 3.5 - Observabilidade e Validacao em Producao.
// AlertRuleEngine: avalia 16 tipos nomeados de alerta operacional/de
// qualidade de dados sobre as metricas ja calculadas pelos demais modulos
// desta camada. Nenhuma regra aqui gera recomendacao de aposta - todos os
// alertas sao sobre SAUDE DE DADOS e SAUDE OPERACIONAL da integracao.
// Quando ObservabilityConfig.alertsEnabled === false, nenhum alerta e
// avaliado (retorna lista vazia) - o motor fica inerte por padrao.

import type { ObservabilityConfig } from "./ObservabilityConfig.ts";
import type {
  AlertSeverity,
  DataQualitySnapshot,
  FixtureComparisonResult,
  LatencyPercentiles,
  ObservabilityAlert,
  ObservabilityAlertType,
  ProviderOperationalMetric,
  SyncRun,
} from "./types.ts";
import type { RateLimitMetricsResult } from "./RateLimitMetrics.ts";

// Constantes PROVISORIAS nao cobertas por variavel de ambiente dedicada
// (o orcamento de 15 variaveis de ObservabilityConfig foi reservado para
// os limiares mais criticos) - documentadas em
// docs/OBSERVABILITY_AND_PRODUCTION_VALIDATION.md, Secao "Limitacoes".
const RATE_LIMIT_FREQUENT_HITS_THRESHOLD = 3;
const FALLBACK_HOST_FREQUENCY_THRESHOLD = 0.2;
const STALE_SYNC_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export type AlertEvaluationInput = {
  snapshot: DataQualitySnapshot | null;
  latestSyncRun: SyncRun | null;
  lastSuccessfulSyncAt: string | null;
  providerMetric: ProviderOperationalMetric | null;
  rateLimitMetrics: RateLimitMetricsResult | null;
  latency: LatencyPercentiles | null;
  fixtureComparison: FixtureComparisonResult | null;
  configurationIssues?: string[];
  now?: () => Date;
};

const SEVERITY_RANK: Record<AlertSeverity, number> = { info: 0, warning: 1, critical: 2 };

function makeAlert(
  type: ObservabilityAlertType,
  severity: AlertSeverity,
  message: string,
  triggeredAt: string,
  context: Record<string, unknown>,
): ObservabilityAlert {
  return { type, severity, message, triggeredAt, context };
}

/** Avalia todas as 16 regras de alerta e devolve apenas as que atingem o alertMinSeverity configurado (ou [] se alertsEnabled=false). */
export function evaluateAlerts(input: AlertEvaluationInput, config: ObservabilityConfig): ObservabilityAlert[] {
  if (!config.alertsEnabled) return [];

  const now = input.now ?? (() => new Date());
  const triggeredAt = now().toISOString();
  const alerts: ObservabilityAlert[] = [];

  const { snapshot } = input;
  if (snapshot) {
    if (snapshot.completenessScore < config.readinessMinScore) {
      alerts.push(
        makeAlert("LOW_COMPLETENESS", "warning", `Completude de dados (${snapshot.completenessScore.toFixed(2)}) abaixo do limiar configurado.`, triggeredAt, {
          completenessScore: snapshot.completenessScore,
          threshold: config.readinessMinScore,
        }),
      );
    }
    if (snapshot.consistencyScore < config.readinessMinScore) {
      alerts.push(
        makeAlert("LOW_CONSISTENCY", "warning", `Consistencia de dados (${snapshot.consistencyScore.toFixed(2)}) abaixo do limiar configurado.`, triggeredAt, {
          consistencyScore: snapshot.consistencyScore,
          threshold: config.readinessMinScore,
          inconsistencies: snapshot.inconsistencies,
        }),
      );
    }
    if (snapshot.classificationScore < config.readinessMinScore) {
      alerts.push(
        makeAlert(
          "LOW_CLASSIFICATION_CONFIDENCE",
          "warning",
          `Confianca de classificacao eSoccer (${snapshot.classificationScore.toFixed(2)}) abaixo do limiar configurado.`,
          triggeredAt,
          { classificationScore: snapshot.classificationScore, threshold: config.readinessMinScore },
        ),
      );
    }
    // duplicationScore esta em escala 0..100 (ver DataQualityEngine.ts) - convertido para taxa 0..1 antes de comparar com duplicateRateThreshold (que permanece 0..1, pois mede uma taxa bruta, nao um score da formula).
    const duplicateRate = 1 - snapshot.duplicationScore / 100;
    if (duplicateRate > config.duplicateRateThreshold) {
      alerts.push(
        makeAlert("HIGH_DUPLICATE_RATE", "warning", `Taxa de duplicidade (${duplicateRate.toFixed(3)}) acima do limiar configurado.`, triggeredAt, {
          duplicateRate,
          threshold: config.duplicateRateThreshold,
        }),
      );
    }
    if (snapshot.sampleSize < config.readinessMinSampleSize) {
      alerts.push(
        makeAlert("LOW_SAMPLE_SIZE", "info", `Amostra atual (${snapshot.sampleSize}) abaixo do minimo configurado para avaliacoes confiaveis.`, triggeredAt, {
          sampleSize: snapshot.sampleSize,
          threshold: config.readinessMinSampleSize,
        }),
      );
    }
  }

  const { providerMetric } = input;
  if (providerMetric && providerMetric.totalRequests > 0) {
    const errorRate = providerMetric.failedRequests / providerMetric.totalRequests;
    if (errorRate > config.errorRateThreshold) {
      alerts.push(
        makeAlert("HIGH_ERROR_RATE", "critical", `Taxa de erro do provider (${errorRate.toFixed(3)}) acima do limiar configurado.`, triggeredAt, {
          errorRate,
          threshold: config.errorRateThreshold,
          provider: providerMetric.provider,
        }),
      );
    }
    if (providerMetric.failedRequests === providerMetric.totalRequests) {
      alerts.push(
        makeAlert("PROVIDER_UNAVAILABLE", "critical", `Todas as ${providerMetric.totalRequests} janela(s) recentes do provider falharam.`, triggeredAt, {
          provider: providerMetric.provider,
          lastError: providerMetric.lastError,
        }),
      );
    }
    const fallbackRate = providerMetric.fallbackCount / providerMetric.totalRequests;
    if (fallbackRate > FALLBACK_HOST_FREQUENCY_THRESHOLD) {
      alerts.push(
        makeAlert("FALLBACK_HOST_USED_FREQUENTLY", "warning", `Host de fallback usado em ${(fallbackRate * 100).toFixed(1)}% das janelas recentes.`, triggeredAt, {
          fallbackRate,
        }),
      );
    }
  }

  if (input.latency && input.latency.p95 !== null && input.latency.p95 > config.latencyP95ThresholdMs) {
    alerts.push(
      makeAlert("HIGH_LATENCY_P95", "warning", `Latencia p95 (${input.latency.p95}ms) acima do limiar configurado.`, triggeredAt, {
        p95: input.latency.p95,
        threshold: config.latencyP95ThresholdMs,
      }),
    );
  }

  if (input.rateLimitMetrics) {
    if (input.rateLimitMetrics.blockedCount > 0) {
      alerts.push(
        makeAlert("RATE_LIMIT_EXHAUSTED", "critical", `${input.rateLimitMetrics.blockedCount} chamada(s) bloqueada(s) por reserva de rate limit atingida.`, triggeredAt, {
          blockedCount: input.rateLimitMetrics.blockedCount,
        }),
      );
    } else if (input.rateLimitMetrics.reserveReachedCount >= RATE_LIMIT_FREQUENT_HITS_THRESHOLD) {
      alerts.push(
        makeAlert(
          "RATE_LIMIT_FREQUENT_HITS",
          "warning",
          `Reserva de rate limit atingida ${input.rateLimitMetrics.reserveReachedCount} vezes recentemente.`,
          triggeredAt,
          { reserveReachedCount: input.rateLimitMetrics.reserveReachedCount },
        ),
      );
    }
  }

  if (input.latestSyncRun?.status === "failed") {
    alerts.push(
      makeAlert("SYNC_RUN_FAILED", "critical", `A ultima execucao de sync (${input.latestSyncRun.id}) falhou.`, triggeredAt, {
        syncRunId: input.latestSyncRun.id,
        errors: input.latestSyncRun.errors,
      }),
    );
  } else if (input.latestSyncRun?.status === "partial") {
    alerts.push(
      makeAlert("SYNC_RUN_PARTIAL", "warning", `A ultima execucao de sync (${input.latestSyncRun.id}) terminou parcialmente com erros.`, triggeredAt, {
        syncRunId: input.latestSyncRun.id,
        errors: input.latestSyncRun.errors,
      }),
    );
  }

  if (input.fixtureComparison && !input.fixtureComparison.structurallyEquivalent) {
    alerts.push(
      makeAlert("FIXTURE_STRUCTURAL_DRIFT", "critical", "Estrutura de dados reais divergiu da estrutura esperada (fixture).", triggeredAt, {
        missingInLive: input.fixtureComparison.missingInLive,
        missingInFixture: input.fixtureComparison.missingInFixture,
        typeMismatches: input.fixtureComparison.typeMismatches,
      }),
    );
  }

  if (input.lastSuccessfulSyncAt) {
    const elapsedMs = now().getTime() - new Date(input.lastSuccessfulSyncAt).getTime();
    if (elapsedMs > STALE_SYNC_THRESHOLD_MS) {
      alerts.push(
        makeAlert("STALE_SYNC", "warning", `Nenhuma sincronizacao bem-sucedida ha mais de ${Math.round(elapsedMs / (60 * 60 * 1000))}h.`, triggeredAt, {
          lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
          elapsedMs,
        }),
      );
    }
  }

  for (const issue of input.configurationIssues ?? []) {
    alerts.push(makeAlert("CONFIGURATION_INVALID", "critical", issue, triggeredAt, {}));
  }

  const minRank = SEVERITY_RANK[config.alertMinSeverity];
  return alerts.filter((alert) => SEVERITY_RANK[alert.severity] >= minRank);
}
