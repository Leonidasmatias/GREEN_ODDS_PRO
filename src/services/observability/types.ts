// Fase 3.5 - Observabilidade e Validacao em Producao.
// Tipos centrais compartilhados por todos os modulos de observabilidade.
// Nenhum tipo aqui importa Prisma nem modulos do Intelligence Engine.
// Nenhum campo aqui carrega recomendacao de aposta, edge, EV ou Kelly -
// esta camada mede QUALIDADE DE DADOS e SAUDE OPERACIONAL, nunca
// oportunidade de aposta.

export type SyncRunStatus = "success" | "partial" | "failed";

/** Snapshot persistivel de uma execucao do BetsApiSyncService (Fase 3), capturado por composicao via SyncRunTracker. */
export type SyncRun = {
  id: string;
  provider: string;
  mode: "dry-run" | "sandbox" | "live";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: SyncRunStatus;
  pagesFetched: number;
  eventsReceived: number;
  confirmedEsoccer: number;
  probableEsoccer: number;
  rejected: number;
  duplicated: number;
  imported: number;
  updated: number;
  errors: string[];
  rateLimitRemaining: number | null;
};

export type FieldQualityMetric = {
  field: string;
  critical: boolean;
  presentCount: number;
  totalCount: number;
  completenessRatio: number;
};

export type LeagueQualityMetric = {
  league: string;
  totalMatches: number;
  completenessRatio: number;
  confirmedEsoccerRatio: number;
};

/**
 * Snapshot agregado de qualidade de dados sobre uma amostra de
 * InternalMatchDTO/eventos brutos. Todos os 6 sub-scores e o overallScore
 * estao na escala 0..100 (corrigido nesta revisao - antes era 0..1),
 * conforme a formula obrigatoria documentada em DataQualityEngine.ts e em
 * docs/OBSERVABILITY_AND_PRODUCTION_VALIDATION.md, Secao 8. PROVISORIOS,
 * sujeitos a recalibracao apos operacao real.
 */
export type DataQualitySnapshot = {
  id: string;
  generatedAt: string;
  sampleSize: number;
  completenessScore: number;
  consistencyScore: number;
  classificationScore: number;
  duplicationScore: number;
  freshnessScore: number;
  providerReliabilityScore: number;
  overallScore: number;
  fieldMetrics: FieldQualityMetric[];
  leagueMetrics: LeagueQualityMetric[];
  inconsistencies: string[];
};

export type ProviderOperationalMetric = {
  provider: string;
  windowStart: string;
  windowEnd: string;
  totalRequests: number;
  /** Janelas cujo SyncRun.status === "success". */
  successfulRequests: number;
  /** Janelas cujo SyncRun.status === "partial" (falha parcial - contada separadamente de failedRequests desde a correcao do DataQualityEngine). */
  partialRequests: number;
  /** Janelas cujo SyncRun.status === "failed" (falha total). */
  failedRequests: number;
  retryCount: number;
  fallbackCount: number;
  rateLimitHits: number;
  lastError: string | null;
};

export type AlertSeverity = "info" | "warning" | "critical";

/** 16 tipos nomeados de alerta (Secao "Alertas" da missao Fase 3.5). */
export type ObservabilityAlertType =
  | "LOW_COMPLETENESS"
  | "LOW_CONSISTENCY"
  | "LOW_CLASSIFICATION_CONFIDENCE"
  | "HIGH_DUPLICATE_RATE"
  | "HIGH_ERROR_RATE"
  | "HIGH_LATENCY_P95"
  | "RATE_LIMIT_EXHAUSTED"
  | "RATE_LIMIT_FREQUENT_HITS"
  | "SYNC_RUN_FAILED"
  | "SYNC_RUN_PARTIAL"
  | "PROVIDER_UNAVAILABLE"
  | "FALLBACK_HOST_USED_FREQUENTLY"
  | "FIXTURE_STRUCTURAL_DRIFT"
  | "LOW_SAMPLE_SIZE"
  | "STALE_SYNC"
  | "CONFIGURATION_INVALID";

export type ObservabilityAlert = {
  type: ObservabilityAlertType;
  severity: AlertSeverity;
  message: string;
  triggeredAt: string;
  context: Record<string, unknown>;
};

export type ProductionReadinessStatus = "ready" | "conditionally_ready" | "not_ready" | "insufficient_data";

/**
 * recommendedNextAction usa um vocabulario fechado e nunca sugere ação de
 * aposta (nunca "bet", "edge", "ev", "kelly", "stake"). Apenas orienta
 * proximos passos operacionais de observacao/coleta.
 */
export type RecommendedNextAction =
  | "collect_more_data"
  | "investigate_active_alerts"
  | "monitor_before_expanding_persistence"
  | "safe_to_expand_observation_window"
  | "resolve_configuration_before_proceeding";

export type ProductionReadinessResult = {
  status: ProductionReadinessStatus;
  overallScore: number | null;
  sampleSize: number;
  criticalAlertCount: number;
  warningAlertCount: number;
  recommendedNextAction: RecommendedNextAction;
  reasons: string[];
  evaluatedAt: string;
};

export type LatencyPercentiles = {
  count: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  averageMs: number | null;
};

export type FixtureComparisonResult = {
  comparedAt: string;
  liveFieldCount: number;
  fixtureFieldCount: number;
  missingInLive: string[];
  missingInFixture: string[];
  typeMismatches: string[];
  structurallyEquivalent: boolean;
};
