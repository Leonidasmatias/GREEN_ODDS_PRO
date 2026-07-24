// Fase 1.5 — Intelligence Engine — Módulo 8.
// Confidence Engine: produz um Confidence Score (0-100) a partir do tamanho
// da amostra disponível (histórico geral, H2H e janela de forma). Pesos e
// alvos de amostra PROVISÓRIOS — documentados aqui para recalibração
// futura após backtests reais.

import { clampScore } from "./types.ts";

const MATCHES_TARGET = 20;
const H2H_TARGET = 5;
const FORM_TARGET = 10;

const WEIGHT_MATCHES = 0.5;
const WEIGHT_H2H = 0.2;
const WEIGHT_FORM = 0.3;

export type ConfidenceInput = {
  matchesCount: number;
  h2hMatchesCount: number;
  formMatchesCount: number;
};

export type ConfidenceResult = {
  confidenceScore: number;
  breakdown: {
    matchesFactor: number;
    h2hFactor: number;
    formFactor: number;
  };
};

function sampleFactor(count: number, target: number): number {
  return clampScore((count / target) * 100);
}

/**
 * Pesos e alvos de amostra PROVISÓRIOS (Fase 1.5):
 *   matchesFactor = min(matchesCount / 20, 1) * 100      (peso 50%)
 *   h2hFactor     = min(h2hMatchesCount / 5, 1) * 100    (peso 20%)
 *   formFactor    = min(formMatchesCount / 10, 1) * 100  (peso 30%)
 *   confidenceScore = matchesFactor*0.5 + h2hFactor*0.2 + formFactor*0.3
 */
export function calculateConfidence(input: ConfidenceInput): ConfidenceResult {
  const matchesFactor = sampleFactor(input.matchesCount, MATCHES_TARGET);
  const h2hFactor = sampleFactor(input.h2hMatchesCount, H2H_TARGET);
  const formFactor = sampleFactor(input.formMatchesCount, FORM_TARGET);

  const confidenceScore = clampScore(
    matchesFactor * WEIGHT_MATCHES + h2hFactor * WEIGHT_H2H + formFactor * WEIGHT_FORM,
  );

  return {
    confidenceScore: Math.round(confidenceScore),
    breakdown: {
      matchesFactor: Math.round(matchesFactor),
      h2hFactor: Math.round(h2hFactor),
      formFactor: Math.round(formFactor),
    },
  };
}
