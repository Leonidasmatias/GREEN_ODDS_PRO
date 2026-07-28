// Imports relativos (não `@/`) neste arquivo especificamente: ele precisa
// ser executável tanto pelo bundler do Next.js quanto diretamente pelo
// `node --test` (sem bundler) nos testes de lógica pura — `node --test`
// não resolve o alias `@/`. Componentes/páginas continuam usando `@/`
// normalmente, conforme o padrão já adotado pelo projeto.
import { formatDateTimeBrt } from "./timezone.ts";
import type { DriftSignalType, ProfileDimension, RecommendationType, RiskLevel, StrategyStatus } from "./intelligenceTypes.ts";
import type { AlertLevel, AlertType, MonitoringStatus, TimelineEventType, TrendType } from "../services/prediction-observability/index.ts";

/** Rótulos padrão para valor ausente — NUNCA `0` ou string vazia quando o
 * dado realmente não existe. Usado por todo o painel de inteligência. */
export const NOT_AVAILABLE = "Não disponível";
export const INSUFFICIENT_DATA = "Sem dados suficientes";

/** Formata um número já em escala 0–100 como percentual (ex.: `71.5` -> `"71.5%"`). */
export function formatPercentageScore(value: number | null, decimals = 1): string {
  if (value === null || Number.isNaN(value)) return NOT_AVAILABLE;
  return `${value.toFixed(decimals)}%`;
}

/** Formata um multiplicador sugerido (ex.: `0.8` -> `"0.80x"`). */
export function formatMultiplier(value: number | null, decimals = 2): string {
  if (value === null || Number.isNaN(value)) return NOT_AVAILABLE;
  return `${value.toFixed(decimals)}x`;
}

/** Formata um número inteiro simples (contagens). */
export function formatCount(value: number | null): string {
  if (value === null || Number.isNaN(value)) return NOT_AVAILABLE;
  return value.toLocaleString("pt-BR");
}

/** Formata uma data ISO já fornecida pelo relatório — nunca gera a data
 * atual. Reaproveita `formatDateTimeBrt` (nunca duplica a lógica de fuso). */
export function formatReportDate(value: string | null | undefined): string {
  return formatDateTimeBrt(value, NOT_AVAILABLE);
}

const DIMENSION_LABELS: Record<ProfileDimension, string> = {
  GLOBAL: "Global",
  PLAYER: "Jogador",
  LEAGUE: "Liga",
  VIRTUAL_TEAM: "Equipe Virtual",
  HOME_AWAY: "Mandante/Visitante",
  PERIOD: "Período",
  PREDICTED_OUTCOME: "Resultado Previsto",
  GREEN_SCORE: "Green Score",
  CONFIDENCE_BUCKET: "Faixa de Confiança",
};

export function formatDimension(dimension: ProfileDimension): string {
  return DIMENSION_LABELS[dimension];
}

const MONITORING_STATUS_LABELS: Record<MonitoringStatus, string> = {
  STABLE: "Estável",
  WARNING: "Alerta",
  CRITICAL: "Crítico",
  IMPROVING: "Melhorando",
  DISABLED: "Desabilitado",
  NEW: "Novo",
};

export function formatMonitoringStatus(status: MonitoringStatus): string {
  return MONITORING_STATUS_LABELS[status];
}

const STRATEGY_STATUS_LABELS: Record<StrategyStatus, { label: string; description: string }> = {
  NORMAL: { label: "Normal", description: "Nenhum sinal relevante de degradação detectado no modelo." },
  WATCH: { label: "Observação", description: "Sinais leves de instabilidade ou confiabilidade global abaixo do esperado — acompanhar de perto." },
  WARNING: { label: "Alerta", description: "Degradação de severidade relevante detectada em ao menos um perfil." },
  CRITICAL: { label: "Crítico", description: "Degradação crítica detectada — recomenda-se atenção imediata." },
};

export function formatStrategyStatus(status: StrategyStatus): { label: string; description: string } {
  return STRATEGY_STATUS_LABELS[status];
}

const RECOMMENDATION_LABELS: Record<RecommendationType, string> = {
  REDUCE_CONFIDENCE: "Reduzir confiança",
  INCREASE_MONITORING: "Aumentar monitoramento",
  TEMPORARILY_DISABLE_PROFILE: "Desabilitar temporariamente",
  PROFILE_STABLE: "Perfil estável",
  PROFILE_IMPROVING: "Perfil melhorando",
  NEEDS_MORE_DATA: "Necessita mais dados",
};

export function formatRecommendation(type: RecommendationType): string {
  return RECOMMENDATION_LABELS[type];
}

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Risco baixo",
  MEDIUM: "Risco médio",
  HIGH: "Risco alto",
  CRITICAL: "Risco crítico",
};

export function formatRisk(level: RiskLevel): string {
  return RISK_LABELS[level];
}

const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  INFO: "Informativo",
  WARNING: "Alerta",
  CRITICAL: "Crítico",
};

export function formatAlertLevel(level: AlertLevel): string {
  return ALERT_LEVEL_LABELS[level];
}

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  DRIFT_CRITICAL: "Drift crítico",
  LOW_RELIABILITY: "Confiabilidade baixa",
  PROFILE_DISABLED: "Perfil desabilitado",
  HIGH_RISK: "Risco alto",
  IMPROVING_PROFILE: "Perfil em melhora",
  NEW_PROFILE: "Novo perfil",
  SAMPLE_TOO_SMALL: "Amostra insuficiente",
};

export function formatAlertType(type: AlertType): string {
  return ALERT_TYPE_LABELS[type];
}

const TREND_LABELS: Record<TrendType, { label: string; description: string }> = {
  INCREASING_STABILITY: { label: "Estabilidade crescente", description: "Comportamento observado sem sinais de degradação." },
  DECREASING_STABILITY: { label: "Estabilidade decrescente", description: "Comportamento observado com sinais leves de degradação." },
  CONTINUOUS_DRIFT: { label: "Deriva contínua", description: "Comportamento observado com degradação simultânea em múltiplas métricas." },
  RECOVERY: { label: "Recuperação", description: "Comportamento observado com melhoria, ainda abaixo do limiar de estabilidade plena." },
  DETERIORATION: { label: "Deterioração", description: "Comportamento observado com degradação relevante e sem melhoria compensatória." },
  NEWLY_CREATED_PROFILE: { label: "Perfil recém-criado", description: "Comportamento observado: ainda sem histórico anterior suficiente." },
};

export function formatTrend(trend: TrendType): { label: string; description: string } {
  return TREND_LABELS[trend];
}

const TIMELINE_EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  STRATEGY_CHANGE: "Estratégia",
  RISK_CHANGE: "Risco",
  RELIABILITY_CHANGE: "Confiabilidade",
  RECOMMENDATION_CHANGE: "Recomendação",
  DRIFT_CHANGE: "Drift",
};

export function formatTimelineEventType(type: TimelineEventType): string {
  return TIMELINE_EVENT_TYPE_LABELS[type];
}

const DRIFT_SIGNAL_TYPE_LABELS: Record<DriftSignalType, string> = {
  PERFORMANCE_DEGRADATION: "Degradação de performance",
  PERFORMANCE_IMPROVEMENT: "Melhoria de performance",
  CALIBRATION_DEGRADATION: "Degradação de calibração",
  CONFIDENCE_SHIFT: "Alteração de confiança",
  SAMPLE_INSUFFICIENT: "Amostra insuficiente",
  PROFILE_DISAPPEARED: "Perfil desaparecido",
  PROFILE_EMERGED: "Perfil emergente",
};

export function formatDriftSignalType(type: DriftSignalType): string {
  return DRIFT_SIGNAL_TYPE_LABELS[type];
}

export function formatProfileLabel(dimension: ProfileDimension | null, key: string | null): string {
  if (dimension === null || key === null) return "Global";
  return `${formatDimension(dimension)} · ${key}`;
}
