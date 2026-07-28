// Camada única de obtenção de dados para o Dashboard de Inteligência
// (`/intelligence`, Sprint 6.0). Consome exclusivamente a API pública de
// `@/services/prediction-observability`. Nenhuma lógica de predição,
// avaliação, aprendizado, adaptação ou observabilidade é recalculada
// aqui — apenas obtém (hoje, a fixture de demonstração — nenhuma fonte
// real de `ObservabilityReport` existe ainda, confirmado por auditoria)
// e valida a presença dos campos essenciais antes de repassar ao
// adaptador de apresentação.

// Imports relativos (não `@/`) — este serviço precisa ser executável
// também por `node --test` (sem bundler), mesma justificativa documentada
// em `intelligenceFormatters.ts`.
import { OBSERVABILITY_REPORT_FIXTURE } from "../data/observabilityReport.fixture.ts";
import type { IntelligenceDashboardDataResult, IntelligenceSourceKind } from "../lib/intelligenceTypes.ts";
import type { ObservabilityReport } from "./prediction-observability/index.ts";

const GENERIC_ERROR_MESSAGE = "Não foi possível carregar o relatório de observabilidade.";

/** Confirma a presença dos campos essenciais sem validar regras de
 * negócio (isso é responsabilidade exclusiva da Sprint 5.3) — apenas
 * garante que a página não quebre por um relatório estruturalmente
 * incompleto. */
function hasEssentialFields(report: ObservabilityReport): boolean {
  return (
    typeof report.reportId === "string" &&
    typeof report.modelVersion === "string" &&
    Array.isArray(report.monitoredProfiles) &&
    Array.isArray(report.alerts) &&
    Array.isArray(report.trendAnalysis) &&
    Array.isArray(report.timeline) &&
    report.dashboardMetrics !== undefined &&
    report.metadata !== undefined
  );
}

/**
 * Obtém o `ObservabilityReport` disponível hoje (fixture de
 * demonstração) e devolve um resultado tipado, sempre indicando se a
 * fonte é real ou demonstrativa. Nunca lança exceção — falhas viram
 * `status: "error"` com mensagem genérica (o erro técnico detalhado
 * nunca é exposto ao usuário final).
 *
 * `reportOverride` existe exclusivamente para permitir que os testes
 * exercitem de verdade os ramos `empty`/`error`/`catch` desta própria
 * função (a fixture real é sempre válida e não-vazia, tornando esses
 * ramos inalcançáveis sem um ponto de injeção). Nenhum chamador de
 * produção passa este argumento — `/intelligence` sempre chama sem
 * argumentos, preservando exatamente o comportamento anterior.
 */
export async function getIntelligenceDashboardData(reportOverride?: ObservabilityReport): Promise<IntelligenceDashboardDataResult> {
  const source: IntelligenceSourceKind = "fixture";

  try {
    const report = reportOverride ?? OBSERVABILITY_REPORT_FIXTURE;

    if (!hasEssentialFields(report)) {
      return { status: "error", message: GENERIC_ERROR_MESSAGE };
    }

    if (report.monitoredProfiles.length === 0) {
      return { status: "empty", source };
    }

    return { status: "success", source, report };
  } catch {
    return { status: "error", message: GENERIC_ERROR_MESSAGE };
  }
}
