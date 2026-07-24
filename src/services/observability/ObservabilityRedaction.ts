// Fase 3.5 - Observabilidade e Validacao em Producao.
// Sanitizacao reutilizada por todos os relatorios/alertas de
// observabilidade. Reaproveita as funcoes de redacao ja criadas na
// Fase 3 (BetsApiRedaction) em vez de duplicar a logica de remocao de
// token — esta camada nunca acessa o token real, mas mensagens de erro
// sanitizadas do BetsApiSyncService/BetsApiClient podem chegar aqui e
// devem permanecer seguras em qualquer relatorio ou alerta gerado.

import { redactDeep, redactErrorMessage } from "../../providers/betsapi/BetsApiRedaction.ts";

/** Sanitiza uma mensagem de erro solta antes de anexar a um SyncRun/alerta/relatorio. */
export function sanitizeObservabilityMessage(message: string): string {
  return redactErrorMessage(message);
}

/** Sanitiza recursivamente qualquer contexto estruturado (ex.: context de ObservabilityAlert) antes de serializar. */
export function sanitizeObservabilityContext(value: unknown): unknown {
  return redactDeep(value);
}

/**
 * Sanitiza um relatorio inteiro (objeto arbitrario) antes de ser
 * convertido para JSON ou Markdown, garantindo que nenhum token ou
 * padrao `token=...` residual escape para um artefato observavel.
 */
export function sanitizeObservabilityReport<T>(report: T): T {
  return redactDeep(report) as T;
}
