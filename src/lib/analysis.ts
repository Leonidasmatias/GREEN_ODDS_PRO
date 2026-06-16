import { AnalyzedOpportunity, GreenClassification, Opportunity, Risk, Signal, SmartMultiple } from "./types";

export const impliedProbability = (odd: number) => 1 / odd;
export const expectedValue = (fairProbability: number, odd: number) => fairProbability * odd - 1;

export function classifyScore(score: number): GreenClassification {
  if (score >= 95) return "ELITE GREEN";
  if (score >= 90) return "GREEN PREMIUM";
  if (score >= 80) return "GREEN FORTE";
  if (score >= 70) return "MODERADO";
  return "EVITAR";
}

export function analyzeOpportunity(item: Opportunity): AnalyzedOpportunity {
  const implied = impliedProbability(item.odd);
  const ev = expectedValue(item.fairProbability, item.odd);
  const edge = item.fairProbability - implied;
  const contextScore = Object.values(item.context).reduce((sum, value) => sum + value, 0) / 5;
  const score = Math.max(0, Math.min(100,
    item.fairProbability * 45 +
    edge * 240 +
    contextScore * 30 +
    (item.confidence / 100) * 10,
  ));
  const classification = classifyScore(score);

  let risk: Risk = "Alto";
  if (score >= 85 && item.fairProbability >= 0.62) risk = "Baixo";
  else if (score >= 70 && ev > 0) risk = "Médio";

  let signal: Signal = "Evitar";
  if (ev > 0 && score >= 75) signal = "Entrar";
  else if (ev > 0 && score >= 60) signal = "Aguardar";

  const powerRating = item.powerRating ?? Math.max(0, Math.min(100, (item.context.attack + item.context.defense + item.context.form) / 3 * 100));
  return { ...item, impliedProbability: implied, edge, expectedValue: ev, risk, signal, score, classification, powerRating };
}

export function rankByExpectedValue(items: AnalyzedOpportunity[]) {
  return [...items].sort((a, b) => b.expectedValue - a.expectedValue || b.score - a.score);
}

export function generateSmartMultiple(items: AnalyzedOpportunity[], maxSelections = 4): SmartMultiple {
  const selections = [...items]
    .filter((item) => item.score >= 80 && item.expectedValue > 0 && item.risk !== "Alto")
    .sort((a, b) => b.score - a.score || b.expectedValue - a.expectedValue)
    .slice(0, Math.max(2, Math.min(4, maxSelections)));

  const totalOdd = selections.reduce((total, item) => total * item.odd, 1);
  const averageScore = selections.length ? selections.reduce((total, item) => total + item.score, 0) / selections.length : 0;
  const combinedProbability = selections.reduce((total, item) => total * item.fairProbability, 1);
  const confidence = Math.min(100, averageScore * 0.72 + combinedProbability * 100 * 0.28);
  const suggestedStake = averageScore >= 90 ? 1 : averageScore >= 85 ? 0.75 : 0.5;
  const risk: Risk = averageScore >= 88 && selections.every((item) => item.risk === "Baixo") ? "Baixo" : "Médio";

  return { selections, totalOdd, averageScore, combinedProbability, suggestedStake, confidence, risk };
}
