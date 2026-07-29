// Sprint 9.1 — Explainability Calibration & Backtest, Etapas 5-6.
// Sprint 9.1.1 — Calibration Data Integrity & Report Hardening, Etapas 4-5.
// Threshold Optimizer + Recommendation Engine: busca, por estatística
// simples (nunca Machine Learning), o valor de um parâmetro numérico que
// melhor separa registros corretos de incorretos nos dados observados —
// e produz uma RECOMENDAÇÃO, nunca uma alteração automática. Nenhum
// threshold de produção é lido ou escrito por este módulo; os valores
// "atuais" são sempre informados explicitamente pelo chamador (nunca
// importados de `predictionExplanationConstants.ts`, para que este
// módulo nunca dependa silenciosamente do valor vigente). Função pura.
//
// Sprint 9.1.1: esta função agora SEMPRE retorna um resultado (nunca
// `null`) — quando nenhuma sugestão numérica é possível, o `outcome`
// explica exatamente por quê (amostra insuficiente, parâmetro sem
// variação, ou uma única classe de resultado na amostra), para que o
// relatório nunca precise adivinhar o motivo do silêncio. O campo antes
// chamado `recommendationConfidence` foi renomeado para `evidenceScore`:
// o nome antigo sugeria uma confiança estatística formal (intervalo de
// confiança, p-value) que esta heurística nunca calculou — é apenas uma
// função crescente do tamanho da amostra, documentada como tal.

export type ThresholdSample = { value: number; correct: boolean };

/** Por que nenhuma sugestão numérica foi produzida (quando aplicável):
 * - `RECOMMENDED`: um candidato viável foi encontrado.
 * - `NO_VARIATION`: o parâmetro tem menos de 2 valores distintos na
 *   amostra — não há como testar nenhum ponto de corte.
 * - `SINGLE_OUTCOME_CLASS`: todos os registros da amostra têm o mesmo
 *   resultado (todos corretos ou todos incorretos) — não há variação a
 *   ser explicada por nenhum threshold.
 * - `INSUFFICIENT_SAMPLE`: existe variação no parâmetro e no resultado,
 *   mas nenhum ponto de corte candidato reúne `MIN_SAMPLE_PER_SIDE`
 *   registros em ambos os lados. */
export type ThresholdOptimizationOutcome = "RECOMMENDED" | "NO_VARIATION" | "SINGLE_OUTCOME_CLASS" | "INSUFFICIENT_SAMPLE";

export type ThresholdRecommendation = {
  parameterName: string;
  currentValue: number;
  sampleSize: number;
  outcome: ThresholdOptimizationOutcome;
  /** `null` sempre que `outcome !== "RECOMMENDED"`. */
  suggestedValue: number | null;
  /** Diferença de acurácia entre os dois lados do threshold sugerido —
   * quanto maior, mais forte a separação estatística observada. `null`
   * sempre que `outcome !== "RECOMMENDED"`. */
  accuracySeparation: number | null;
  /** Heurística 0..100 baseada apenas no tamanho da amostra total —
   * NUNCA um p-value, NUNCA um intervalo de confiança formal, NUNCA uma
   * probabilidade. Mede apenas "quantos registros sustentam esta leitura",
   * não "quão provável é que o efeito seja real". `null` sempre que
   * `outcome !== "RECOMMENDED"`. Ver `docs/CALIBRATION_METHODOLOGY.md`
   * para a fórmula completa e suas limitações. */
  evidenceScore: number | null;
  reason: string;
};

/** Nenhuma recomendação é gerada com menos que isto de registros em CADA
 * lado do threshold candidato — evita recomendar com base em ruído.
 * Constante isolada deste otimizador, nunca compartilhada com nenhum
 * threshold de produção da Sprint 9.0. */
const MIN_SAMPLE_PER_SIDE = 5;

function accuracyOf(samples: ThresholdSample[]): number {
  if (samples.length === 0) return 0;
  return samples.filter((s) => s.correct).length / samples.length;
}

/** Heurística de força de evidência: cresce com o tamanho total da
 * amostra, satura em 95 (nunca 100 — este módulo nunca afirma certeza
 * absoluta). Não é um teste de hipótese formal, não é um p-value, não é
 * uma probabilidade de o efeito ser real — apenas "quantos dados
 * sustentam este número", documentado explicitamente para nunca ser lido
 * como rigor estatístico validado. */
function evidenceScoreHeuristic(totalSample: number): number {
  const scaled = 50 + Math.min(45, totalSample * 1.5);
  return Math.round(Math.min(95, scaled));
}

function baseResult(parameterName: string, currentValue: number, sampleSize: number, outcome: ThresholdOptimizationOutcome, reason: string): ThresholdRecommendation {
  return { parameterName, currentValue, sampleSize, outcome, suggestedValue: null, accuracySeparation: null, evidenceScore: null, reason };
}

/**
 * Testa cada valor distinto presente na amostra como threshold
 * candidato (`value < threshold` vs `value >= threshold`), e escolhe o
 * que maximiza a diferença de acurácia entre os dois lados, exigindo ao
 * menos `MIN_SAMPLE_PER_SIDE` registros em cada lado. Sempre retorna um
 * resultado — nunca `null` — com `outcome` explicando o motivo quando
 * nenhuma sugestão numérica é possível.
 */
export function optimizeThreshold(parameterName: string, samples: ThresholdSample[], currentValue: number): ThresholdRecommendation {
  const sampleSize = samples.length;

  if (sampleSize === 0) {
    return baseResult(parameterName, currentValue, sampleSize, "INSUFFICIENT_SAMPLE", "Nenhum registro disponível para este parâmetro.");
  }

  const allCorrect = samples.every((s) => s.correct);
  const allIncorrect = samples.every((s) => !s.correct);
  if (allCorrect || allIncorrect) {
    return baseResult(
      parameterName,
      currentValue,
      sampleSize,
      "SINGLE_OUTCOME_CLASS",
      `Todos os ${sampleSize} registros analisados têm o mesmo resultado (${allCorrect ? "todos corretos" : "todos incorretos"}) — nenhum threshold pode explicar uma variação que não existe na amostra.`,
    );
  }

  const candidates = [...new Set(samples.map((s) => s.value))].sort((a, b) => a - b);
  if (candidates.length < 2) {
    return baseResult(parameterName, currentValue, sampleSize, "NO_VARIATION", `O parâmetro tem um único valor distinto em toda a amostra (${sampleSize} registros) — nenhum ponto de corte pode ser testado.`);
  }

  let best: { threshold: number; separation: number; accuracyBelow: number; accuracyAbove: number } | null = null;

  for (const threshold of candidates) {
    const below = samples.filter((s) => s.value < threshold);
    const above = samples.filter((s) => s.value >= threshold);
    if (below.length < MIN_SAMPLE_PER_SIDE || above.length < MIN_SAMPLE_PER_SIDE) continue;

    const accuracyBelow = accuracyOf(below);
    const accuracyAbove = accuracyOf(above);
    const separation = Math.abs(accuracyAbove - accuracyBelow);

    if (!best || separation > best.separation) {
      best = { threshold, separation, accuracyBelow, accuracyAbove };
    }
  }

  if (!best) {
    return baseResult(
      parameterName,
      currentValue,
      sampleSize,
      "INSUFFICIENT_SAMPLE",
      `Nenhum ponto de corte candidato reúne ao menos ${MIN_SAMPLE_PER_SIDE} registros em cada lado (amostra total: ${sampleSize}).`,
    );
  }

  const direction = best.accuracyAbove >= best.accuracyBelow ? "acima" : "abaixo";
  return {
    parameterName,
    currentValue,
    sampleSize,
    outcome: "RECOMMENDED",
    suggestedValue: best.threshold,
    accuracySeparation: best.separation,
    evidenceScore: evidenceScoreHeuristic(sampleSize),
    reason: `Acurácia observada é ${(best.separation * 100).toFixed(1)} pontos percentuais maior ${direction} deste valor, com ${sampleSize} registros analisados.`,
  };
}
