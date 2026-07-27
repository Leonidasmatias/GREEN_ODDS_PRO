// Fase 4 — Sprint 4.1 — Prediction Engine Foundation.
// Normalizer: transforma três logits brutos (home/draw/away) em três
// probabilidades que somam exatamente 1 (dentro da precisão de ponto
// flutuante de um double IEEE-754 — ver nota abaixo), usando uma
// implementação de softmax numericamente estável (subtração do maior logit
// antes de exponenciar, técnica padrão para evitar overflow).
//
// Nota sobre "soma exatamente 1": nenhuma sequência de operações de ponto
// flutuante pode garantir `a + b + c === 1` bit a bit para TODA entrada
// possível — isso é uma limitação estrutural do IEEE-754 (double de 52 bits
// de mantissa), não uma falha desta implementação. O que este módulo
// garante é: (1) nenhuma probabilidade jamais é negativa ou maior que 1;
// (2) a soma final está sempre a, no máximo, `Number.EPSILON` de 1 — testado
// exaustivamente em `tests/predictionNormalizer.test.mjs` com milhares de
// combinações aleatórias de logits, incluindo casos extremos.

import { clamp } from "./types.ts";

export type OutcomeLogits = { home: number; draw: number; away: number };
export type OutcomeProbabilities = { homeWin: number; draw: number; awayWin: number };

/** Neutraliza um logit inválido (NaN/±Infinity) para 0 — fallback seguro e
 * explícito, nunca propagado silenciosamente para o resultado final. */
function sanitizeLogit(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Converte três logits brutos em três probabilidades não-negativas que
 * somam 1 (dentro de `Number.EPSILON`, ver nota do cabeçalho). Logits
 * NaN/±Infinity são neutralizados para 0 antes do cálculo. Estável para
 * logits extremos (positivos ou negativos) graças à subtração do maior
 * valor antes de `Math.exp`.
 */
export function computeOutcomeProbabilities(logits: OutcomeLogits): OutcomeProbabilities {
  const home = sanitizeLogit(logits.home);
  const draw = sanitizeLogit(logits.draw);
  const away = sanitizeLogit(logits.away);

  const max = Math.max(home, draw, away);
  const expHome = Math.exp(home - max);
  const expDraw = Math.exp(draw - max);
  const expAway = Math.exp(away - max);
  const sum = expHome + expDraw + expAway;

  const pHome = expHome / sum;
  const pDraw = expDraw / sum;
  const pAway = expAway / sum;

  // Correção de soma exata: mantém as duas maiores probabilidades como
  // calculadas e redefine a menor como o complemento exato das outras
  // duas, garantindo `pHome + pDraw + pAway === 1` até o limite de
  // precisão de um double (no máximo 1 ULP de desvio — ver nota acima).
  const entries: [keyof OutcomeProbabilities, number][] = [
    ["homeWin", pHome],
    ["draw", pDraw],
    ["awayWin", pAway],
  ];
  entries.sort((a, b) => a[1] - b[1]);

  const result: OutcomeProbabilities = { homeWin: pHome, draw: pDraw, awayWin: pAway };
  const [smallestKey] = entries[0];
  const remainderOfOthers = entries[1][1] + entries[2][1];
  result[smallestKey] = 1 - remainderOfOthers;

  result.homeWin = clamp(result.homeWin, 0, 1);
  result.draw = clamp(result.draw, 0, 1);
  result.awayWin = clamp(result.awayWin, 0, 1);

  return result;
}
