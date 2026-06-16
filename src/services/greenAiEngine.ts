import { prisma } from "@/lib/prisma";
import { generateFeatures } from "./featureEngineering";
import { runAutomaticBacktests } from "./backtestEngine";
import { getTrainingStatus } from "./modelTrainingService";

export type AiClassification = "ELITE GREEN" | "PREMIUM" | "FORTE" | "MODERADO" | "EVITAR";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

export function classifyAiScore(score: number): AiClassification {
  if (score >= 95) return "ELITE GREEN";
  if (score >= 90) return "PREMIUM";
  if (score >= 80) return "FORTE";
  if (score >= 70) return "MODERADO";
  return "EVITAR";
}

export function classifyAiRisk(probability: number, confidence: number) {
  if (probability >= 0.72 && confidence >= 75) return "BAIXO";
  if (probability >= 0.58 && confidence >= 50) return "MÉDIO";
  return "ALTO";
}

export async function predictGreenAi() {
  const [pending, trainingRows, backtests, trainingStatus] = await Promise.all([
    prisma.tip.findMany({ where: { status: "PENDING" }, orderBy: [{ expectedValue: "desc" }, { confidenceScore: "desc" }], take: 30 }),
    prisma.trainingDataset.findMany(),
    runAutomaticBacktests(),
    getTrainingStatus(),
  ]);
  const inputs = pending.map((tip) => ({ id: tip.id, matchId: tip.matchId, game: tip.gameLabel, market: tip.market, selection: tip.selection, odd: tip.odd, impliedProbability: tip.impliedProbability, estimatedProbability: tip.estimatedProbability, traditionalScore: tip.confidenceScore, ev: tip.expectedValue, currentRisk: tip.risk }));
  const fullBacktest = backtests.at(-1)!;
  let trainedThreshold = 0.5;
  if (trainingStatus.latest?.notes) { try { trainedThreshold = Number(JSON.parse(trainingStatus.latest.notes).threshold ?? 0.5); } catch { trainedThreshold = 0.5; } }
  const predictions = [];
  for (const input of inputs) {
    const marketRows = trainingRows.filter((row) => row.market === input.market);
    const marketGreens = marketRows.filter((row) => row.result === "WON").length;
    const smoothedMarketRate = (marketGreens + 2) / (marketRows.length + 4);
    const features = await generateFeatures({ matchId: input.matchId, market: input.market, selection: input.selection, score: input.traditionalScore, impliedProbability: input.impliedProbability, estimatedProbability: input.estimatedProbability, gameLabel: input.game });
    const calibrated = clamp((input.estimatedProbability * 0.42 + smoothedMarketRate * 0.28 + features.recentForm * 0.12 + clamp(0.5 + features.edge, 0, 1) * 0.12 + clamp(0.5 - Math.abs(features.oddsMovement), 0, 1) * 0.06) * 100) / 100;
    const predictedProbability = trainingStatus.latest ? clamp(calibrated + (0.5 - trainedThreshold) * 0.1, 0, 1) : input.estimatedProbability;
    const sampleConfidence = trainingStatus.confidence.factor;
    const agreement = 1 - Math.min(1, Math.abs(predictedProbability - input.estimatedProbability) * 2);
    const modelConfidence = trainingStatus.latest ? clamp((sampleConfidence * 0.65 + agreement * 0.35) * 100) : trainingStatus.confidence.percentage;
    const backtestScore = fullBacktest.entries ? clamp(50 + fullBacktest.yield) : 50;
    const marketScore = clamp(smoothedMarketRate * 100);
    const aiScore = clamp(input.traditionalScore * 0.45 + predictedProbability * 100 * 0.25 + marketScore * 0.15 + backtestScore * 0.15);
    predictions.push({ ...input, predictedProbability: round(predictedProbability * 100), modelConfidence: round(modelConfidence), aiScore: round(aiScore), classification: classifyAiScore(aiScore), risk: classifyAiRisk(predictedProbability, modelConfidence), features: { ...features, historicalRoi: round(features.historicalRoi * 100), historicalWinRate: round(features.historicalWinRate * 100), oddsMovement: round(features.oddsMovement * 100) }, sampleSize: marketRows.length });
  }
  return { predictions: predictions.sort((a, b) => b.aiScore - a.aiScore), trainingRecords: trainingRows.filter((row) => row.result !== "VOID").length, trainingStatus, methodology: trainingStatus.latest ? "Modelo estatístico supervisionado com validação temporal 70/15/15." : "Dados insuficientes para treinamento. Probabilidades atuais ainda não foram calibradas por um modelo treinado.", generatedAt: new Date().toISOString() };
}

export async function getGreenAiReport() {
  const [{ predictions, trainingRecords, trainingStatus, methodology }, backtests, marketBacktests] = await Promise.all([predictGreenAi(), runAutomaticBacktests(), import("./backtestEngine").then((module) => module.getMarketBacktests())]);
  const evolution = await import("./backtestEngine").then((module) => module.getModelEvolution());
  return { predictions, trainingRecords, trainingStatus, methodology, backtests, markets: marketBacktests, bestMarkets: marketBacktests.slice(0, 3), worstMarkets: [...marketBacktests].reverse().slice(0, 3), evolution, generatedAt: new Date().toISOString() };
}
