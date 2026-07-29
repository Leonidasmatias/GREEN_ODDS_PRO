// Sprint 9.1 — Explainability Calibration & Backtest, Etapa 7.
// Sprint 9.1.1 — Calibration Data Integrity & Report Hardening, Etapas 6-7.
// Gera o conteúdo Markdown do relatório de calibração a partir de um
// `BacktestResult` já calculado — nunca calcula nada aqui, apenas
// formata. Função pura (string in, string out); a escrita em
// `docs/CALIBRATION_REPORT.md` é responsabilidade exclusiva do script
// `scripts/calibration.mjs`.
//
// Sprint 9.1.1: a origem dos dados (`REAL`/`SYNTHETIC`/`MIXED`) nunca é
// mais informada pelo chamador como uma string solta — vem sempre de
// `result.provenance.origin`, já computada a partir das tags que o CLI
// atribuiu a cada previsão. O relatório agora separa explicitamente
// "Resultado operacional" (só existe quando `reportStatus` permite) de
// "Demonstração técnica do otimizador" (sempre presente, sempre rotulada
// como não-operacional), para que nenhuma sugestão sintética possa ser
// lida como uma recomendação real.

import type { BacktestResult, EligibleThresholdRecommendation } from "./BacktestRunner.ts";
import { isOperationalEligibility } from "./RecommendationEligibility.ts";

export type CalibrationReportOptions = {
  generatedAt: string;
  /** Descrição em linguagem natural de como o dataset foi obtido (ex.:
   * "12 previsões reais encontradas..." ou "dataset sintético embutido
   * neste script"). A classificação REAL/SYNTHETIC/MIXED em si nunca vem
   * daqui — vem sempre de `result.provenance.origin`, computada a partir
   * das tags de proveniência de cada registro. */
  sourceDescription: string;
};

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function accuracyCell(validRecords: number, accuracy: number): string {
  return validRecords > 0 ? pct(accuracy) : "N/A (sem amostra)";
}

function impactCell(impact: number, sideAValidRecords: number, sideBValidRecords: number): string {
  if (sideAValidRecords === 0 || sideBValidRecords === 0) return "N/A (sem amostra em um dos lados)";
  return `${impact >= 0 ? "+" : ""}${(impact * 100).toFixed(1)}pp`;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    OK: "OK",
    INSUFFICIENT_SAMPLE: "Amostra insuficiente",
    EMPTY: "Vazio",
    REJECTED: "Rejeitado",
  };
  return labels[status] ?? status;
}

const ORIGIN_LABELS: Record<string, string> = {
  REAL: "Dados reais de produção",
  SYNTHETIC: "Dataset sintético de demonstração",
  MIXED: "Mistura de dados reais e sintéticos",
};

const REPORT_STATUS_LABELS: Record<string, string> = {
  BLOCKED_NO_REAL_DATA: "BLOQUEADO — nenhum dado real disponível",
  BLOCKED_INSUFFICIENT_SAMPLE: "BLOQUEADO — amostra histórica insuficiente",
  DEMONSTRATION: "Demonstração (sem tentativa de dado real)",
  OBSERVATIONAL: "Observacional (leitura preliminar, não conclusiva)",
  READY_FOR_HUMAN_REVIEW: "Pronto para revisão humana",
};

const ELIGIBILITY_LABELS: Record<string, string> = {
  DEMONSTRATION_ONLY: "Apenas demonstração",
  INSUFFICIENT_SAMPLE: "Amostra insuficiente",
  OBSERVATIONAL: "Observacional",
  ELIGIBLE_FOR_REVIEW: "Elegível para revisão",
};

function outcomeLabel(outcome: string): string {
  const labels: Record<string, string> = {
    RECOMMENDED: "Sugestão encontrada",
    NO_VARIATION: "Parâmetro sem variação na amostra",
    SINGLE_OUTCOME_CLASS: "Amostra com uma única classe de resultado",
    INSUFFICIENT_SAMPLE: "Amostra insuficiente para qualquer ponto de corte",
  };
  return labels[outcome] ?? outcome;
}

function confidenceCalibrationSection(result: BacktestResult): string {
  const rows = result.analysis.confidenceCalibration
    .map((segment) => `| ${segment.segment.key} | ${segment.metrics.validRecords} | ${pct(segment.metrics.accuracy)} | ${statusLabel(segment.status)} |`)
    .join("\n");
  return `## 4. Confidence\n\n| Faixa de Confidence | Amostra | Acurácia real | Status |\n|---|---|---|---|\n${rows}\n`;
}

function qualitySection(result: BacktestResult): string {
  const rows = result.analysis.qualityCalibration
    .map((item) => `| ${item.grade.replace("_PLUS", "+")} | ${item.sampleSize} | ${accuracyCell(item.sampleSize, item.metrics.accuracy)} |`)
    .join("\n");
  return (
    `## 5. Quality\n\n` +
    `Escala monotonicamente calibrada (A+ >= A >= ... >= D, com tolerância, considerando apenas notas com amostra suficiente): **${result.analysis.qualityScaleMonotonic ? "sim" : "não confirmada com os dados atuais"}**.\n\n` +
    `| Nota | Amostra | Acurácia real |\n|---|---|---|\n${rows}\n`
  );
}

function riskSection(result: BacktestResult): string {
  const rows = result.analysis.riskCalibration
    .map(
      (item) =>
        `| ${item.code} | ${item.frequency} (${pct(item.frequencyRate)}) | ${accuracyCell(item.metricsWithRisk.validRecords, item.metricsWithRisk.accuracy)} | ${accuracyCell(item.metricsWithoutRisk.validRecords, item.metricsWithoutRisk.accuracy)} | ${impactCell(item.accuracyImpact, item.metricsWithRisk.validRecords, item.metricsWithoutRisk.validRecords)} |`,
    )
    .join("\n");
  return (
    `## 6. Risk\n\n` +
    `| Código | Frequência | Acurácia com risco | Acurácia sem risco | Impacto |\n|---|---|---|---|---|\n${rows}\n\n` +
    `Impacto positivo indica que o risco de fato correlaciona com acurácia menor nos dados observados (comportamento esperado de um risco genuíno).\n`
  );
}

function factorImportanceSection(result: BacktestResult): string {
  const rows = result.analysis.factorImportance
    .map(
      (item) =>
        `| ${item.code} | ${item.availableSampleSize} | ${accuracyCell(item.metricsWhenAvailable.validRecords, item.metricsWhenAvailable.accuracy)} | ${accuracyCell(item.metricsWhenUnavailable.validRecords, item.metricsWhenUnavailable.accuracy)} | ${impactCell(item.accuracyImpact, item.metricsWhenAvailable.validRecords, item.metricsWhenUnavailable.validRecords)} |`,
    )
    .join("\n");
  return (
    `## 7. Factor Importance\n\n` +
    `| Fator | Amostra disponível | Acurácia quando disponível | Acurácia quando indisponível | Impacto |\n|---|---|---|---|---|\n${rows}\n`
  );
}

function blockedOperationalMessage(result: BacktestResult): string {
  if (result.reportStatus === "BLOCKED_NO_REAL_DATA") {
    return "**CALIBRAÇÃO REAL BLOQUEADA — NENHUM DADO REAL DISPONÍVEL.**\n\nUma consulta a dados reais foi tentada, mas nenhuma previsão real com resultado real correspondente foi encontrada. Nenhuma recomendação operacional pode ser emitida a partir deste relatório.";
  }
  if (result.reportStatus === "BLOCKED_INSUFFICIENT_SAMPLE") {
    return `**CALIBRAÇÃO REAL BLOQUEADA — AMOSTRA HISTÓRICA INSUFICIENTE.**\n\nExistem dados reais, mas a amostra válida (${result.provenance.validRecordCount} registro(s)) está abaixo do mínimo exigido para qualquer leitura operacional. Nenhuma recomendação operacional pode ser emitida a partir deste relatório.`;
  }
  return "Esta execução não tentou consultar dados reais (nenhum `DATABASE_URL` configurado, ou execução explicitamente em modo demonstração). O resultado abaixo é inteiramente sintético — ver Seção 9 (Demonstração técnica do otimizador). Nenhuma recomendação operacional existe nesta execução.";
}

function operationalResultSection(result: BacktestResult): string {
  const header = `## 8. Resultado operacional\n\n`;
  const statusLine = `Status geral do relatório: **${REPORT_STATUS_LABELS[result.reportStatus] ?? result.reportStatus}**.\n\n`;

  if (result.reportStatus === "BLOCKED_NO_REAL_DATA" || result.reportStatus === "BLOCKED_INSUFFICIENT_SAMPLE" || result.reportStatus === "DEMONSTRATION") {
    return `${header}${statusLine}${blockedOperationalMessage(result)}\n`;
  }

  const operational = result.recommendations.filter((rec) => isOperationalEligibility(rec.eligibility));
  if (operational.length === 0) {
    return `${header}${statusLine}Nenhum parâmetro reuniu amostra suficiente para uma leitura operacional nesta execução — ver Seção 9 para o detalhamento técnico de cada parâmetro.\n`;
  }

  const rows = operational
    .map((rec) => operationalRecommendationBlock(rec))
    .join("\n");

  const reviewNote =
    result.reportStatus === "READY_FOR_HUMAN_REVIEW"
      ? "Estas sugestões estão prontas para revisão humana — **nenhuma foi ou será aplicada automaticamente** a nenhum arquivo de produção."
      : "Leitura observacional preliminar — amostra ainda não atinge o mínimo para ser tratada como pronta para revisão de produção (ou dataset misto com dado sintético). **Nenhuma sugestão abaixo deve informar uma alteração de produção.**";

  return `${header}${statusLine}${rows}\n${reviewNote}\n`;
}

function operationalRecommendationBlock(rec: EligibleThresholdRecommendation): string {
  const base = `### ${rec.parameterName}\n\n- **Elegibilidade**: ${ELIGIBILITY_LABELS[rec.eligibility] ?? rec.eligibility}\n- **Amostra analisada**: ${rec.sampleSize} registros\n`;
  if (rec.outcome !== "RECOMMENDED") {
    return `${base}- **Resultado**: ${outcomeLabel(rec.outcome)} — ${rec.reason}\n`;
  }
  return (
    `${base}` +
    `- **Current**: ${rec.currentValue}\n` +
    `- **Historical Suggestion**: ${rec.suggestedValue}\n` +
    `- **Evidence score**: ${rec.evidenceScore}/100 (heurística de tamanho de amostra — não é um p-value nem uma probabilidade)\n` +
    `- **Reason**: ${rec.reason}\n`
  );
}

function technicalDemonstrationSection(result: BacktestResult): string {
  const rows = result.recommendations
    .map((rec) => {
      const base = `### ${rec.parameterName}\n\n- **Current**: ${rec.currentValue}\n- **Amostra analisada**: ${rec.sampleSize} registros\n- **Resultado do otimizador**: ${outcomeLabel(rec.outcome)}\n`;
      if (rec.outcome !== "RECOMMENDED") {
        return `${base}- **Detalhe**: ${rec.reason}\n`;
      }
      return `${base}- **Valor sugerido pelo otimizador**: ${rec.suggestedValue}\n- **Separação de acurácia**: ${((rec.accuracySeparation ?? 0) * 100).toFixed(1)}pp\n- **Evidence score**: ${rec.evidenceScore}/100\n- **Detalhe**: ${rec.reason}\n`;
    })
    .join("\n");

  return (
    `## 9. Demonstração técnica do otimizador\n\n` +
    `**Esta seção nunca representa uma recomendação de produção — mesmo quando a amostra é real.** ` +
    `Ela existe apenas para tornar o mecanismo do otimizador auditável: mostra, para cada parâmetro, exatamente o que o cálculo produziu, ` +
    `incluindo os casos em que nenhuma sugestão numérica foi possível. Sugestões aqui só podem informar produção depois de passar pela ` +
    `Seção 8 (Resultado operacional) e por revisão humana explícita.\n\n${rows}\n`
  );
}

/**
 * Constrói o Markdown completo do relatório. Determinístico: a mesma
 * entrada sempre produz a mesma saída.
 */
export function buildCalibrationReportMarkdown(result: BacktestResult, options: CalibrationReportOptions): string {
  const global = result.analysis.confidenceCalibration.reduce(
    (acc, segment) => ({ correct: acc.correct + segment.metrics.correct, total: acc.total + segment.metrics.validRecords }),
    { correct: 0, total: 0 },
  );
  const globalAccuracy = global.total > 0 ? global.correct / global.total : 0;

  const provenance = result.provenance;
  const originLabel = ORIGIN_LABELS[provenance.origin] ?? provenance.origin;
  const hasOperationalRecommendations = result.recommendations.some((rec) => isOperationalEligibility(rec.eligibility) && rec.outcome === "RECOMMENDED");
  const productionChangesPermitted = "Não — nenhum relatório de calibração aplica alterações de produção automaticamente, em nenhum status.";

  return `# Calibration Report — Explainability

Sprint 9.1 — Explainability Calibration & Backtest. Sprint 9.1.1 —
Calibration Data Integrity & Report Hardening. Relatório gerado
automaticamente por \`npm run calibration\` (\`scripts/calibration.mjs\`).
**Nenhum threshold de produção foi alterado por este relatório** — todos
os valores em \`src/services/prediction-explanation/predictionExplanationConstants.ts\`
permanecem exatamente como estavam antes desta execução.

Gerado em: ${options.generatedAt}

## 1. Resumo executivo

- Origem dos dados: **${originLabel}** — ${options.sourceDescription}
- Status geral do relatório: **${REPORT_STATUS_LABELS[result.reportStatus] ?? result.reportStatus}**
- Existem recomendações operacionais nesta execução: **${hasOperationalRecommendations ? "sim" : "não"}**
- Alterações de produção permitidas a partir deste relatório: **${productionChangesPermitted}**
- Status da avaliação (join/validação): **${statusLabel(result.status)}**
- Registros válidos analisados: **${result.datasetSummary.validRecords}**
- Acurácia global observada: **${pct(globalAccuracy)}**

## 2. Dataset e proveniência

- Identificador: \`${result.datasetId}\`
- Origem computada: **${provenance.origin}** (${provenance.realCount} registro(s) reais, ${provenance.syntheticCount} registro(s) sintéticos, de ${provenance.totalCount} previsões fornecidas)
- Consulta a dado real tentada nesta execução: ${provenance.realDataAttempted ? "sim" : "não"}
- Previsões fornecidas: ${result.datasetSummary.totalPredictions}
- Resultados reais fornecidos: ${result.datasetSummary.totalActuals}
- Registros casados (previsão + resultado): ${result.datasetSummary.matchedRecords}
- Registros válidos (após validação estrutural): ${result.datasetSummary.validRecords}
- Registros ignorados/descartados: ${result.datasetSummary.ignoredRecords}
- Motivos de descarte: ${provenance.discardReasons.length === 0 ? "nenhum" : provenance.discardReasons.map((r) => `${r.code} (${r.count})`).join(", ")}
- Período coberto (registros válidos): ${provenance.periodStart && provenance.periodEnd ? `${provenance.periodStart} a ${provenance.periodEnd}` : "N/A (sem registros válidos)"}
- Ligas distintas: ${provenance.leagueCount}
- Jogadores distintos: ${provenance.playerCount}

## 3. Distribuição e avisos

Avisos encontrados durante o join/validação: ${result.warnings.length === 0 ? "nenhum" : result.warnings.map((w) => w.code).join(", ")}.
Registros rejeitados: ${result.rejectedRecords.length}.

${confidenceCalibrationSection(result)}
${qualitySection(result)}
${riskSection(result)}
${factorImportanceSection(result)}
${operationalResultSection(result)}
${technicalDemonstrationSection(result)}
## 10. Conclusões

${
  result.reportStatus === "READY_FOR_HUMAN_REVIEW" || result.reportStatus === "OBSERVATIONAL"
    ? "A amostra analisada permite leitura estatística preliminar dos pontos acima. Nenhuma conclusão aqui substitui validação contínua com mais dados, nem autoriza alteração automática de produção."
    : `Status "${REPORT_STATUS_LABELS[result.reportStatus] ?? result.reportStatus}": este relatório não sustenta nenhuma conclusão operacional. As tabelas acima refletem exatamente os dados fornecidos (reais, sintéticos, ou a ausência deles), sem extrapolação.`
}

## 11. Limitações

- Todos os thresholds recomendados são heurísticas estatísticas simples (separação de acurácia por threshold), nunca Machine Learning, nunca um teste de hipótese formal.
- \`evidenceScore\` é uma heurística baseada em tamanho de amostra, não um p-value, não um intervalo de confiança, não uma probabilidade de o efeito ser real.
- Este relatório nunca altera nenhum arquivo de configuração de produção.
- Resultados com amostra pequena são estatisticamente ruidosos — nunca devem ser interpretados como definitivos.
- Nenhuma previsão foi recalculada para gerar este relatório — todos os dados vêm de snapshots já persistidos.
- Dataset com origem \`MIXED\` nunca é elegível para revisão como ajuste de produção (Seção 8), mesmo com amostra grande — apenas leitura observacional.
- Ver \`docs/CALIBRATION_METHODOLOGY.md\` para a metodologia completa (fórmulas, limites de amostra, política de elegibilidade).
`;
}
