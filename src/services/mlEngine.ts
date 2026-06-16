import { prisma } from "@/lib/prisma";
import type { MlModelReport, MlPredictionResult, MlSampleValidation, MlTrainingSample } from "@/lib/mlTypes";
import { oddRange } from "./settlementEngine";

export const MINIMUM_ML_TRAINING_SAMPLES = 100;
const MODEL_VERSION = "green-odds-ml-v1";

type RealSettledRow = Awaited<ReturnType<typeof loadRealSettledRows>>[number];
type ConfidenceRow = { status: string; confidenceScore: number };
type ProbabilityInput = {
  matchId: string;
  market: string;
  selection: string;
  competition: string;
  provider: string;
  bookmaker: string;
  odd: number;
  impliedProbability: number;
};

const round = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

async function loadRealSettledRows() {
  return prisma.tipResult.findMany({
    where: {
      status: { in: ["WON", "LOST", "VOID"] },
      tip: { match: { providerId: { not: { startsWith: "mock" } } } },
    },
    include: { tip: { include: { match: true } } },
    orderBy: { settledAt: "asc" },
  });
}

function toSample(row: RealSettledRow): MlTrainingSample {
  return {
    tipId: row.tipId,
    matchId: row.matchId,
    market: row.market,
    selection: row.selection,
    competition: row.tip.match.competition,
    provider: row.provider,
    bookmaker: row.bookmaker,
    odd: row.tip.odd,
    oddRange: oddRange(row.tip.odd),
    impliedProbability: row.tip.impliedProbability,
    result: row.status as MlTrainingSample["result"],
    profit: row.profit,
    roi: row.roi,
    settledAt: row.settledAt.toISOString(),
  };
}

function decided(samples: MlTrainingSample[]) {
  return samples.filter((sample) => sample.result === "WON" || sample.result === "LOST");
}

function probability(samples: MlTrainingSample[]) {
  const rows = decided(samples);
  if (!rows.length) return null;
  return rows.filter((sample) => sample.result === "WON").length / rows.length;
}

function groupProbability(samples: MlTrainingSample[], predicate: (sample: MlTrainingSample) => boolean) {
  return probability(samples.filter(predicate));
}

function recentProbability(samples: MlTrainingSample[]) {
  return probability(samples.slice(-Math.min(50, samples.length)));
}

function weightedAverage(parts: Array<{ probability: number | null; weight: number }>) {
  const usable = parts.filter((part): part is { probability: number; weight: number } => part.probability != null && part.weight > 0);
  const weight = usable.reduce((sum, part) => sum + part.weight, 0);
  if (!weight) return null;
  return usable.reduce((sum, part) => sum + part.probability * part.weight, 0) / weight;
}

function predictionFromSamples(samples: MlTrainingSample[], input: ProbabilityInput) {
  const range = oddRange(input.odd);
  const globalProbability = probability(samples);
  if (samples.length < MINIMUM_ML_TRAINING_SAMPLES || globalProbability == null) return null;
  return weightedAverage([
    { probability: globalProbability, weight: 0.2 },
    { probability: groupProbability(samples, (sample) => sample.market === input.market && sample.selection === input.selection), weight: 0.25 },
    { probability: groupProbability(samples, (sample) => sample.market === input.market), weight: 0.15 },
    { probability: groupProbability(samples, (sample) => sample.competition === input.competition), weight: 0.15 },
    { probability: groupProbability(samples, (sample) => sample.bookmaker === input.bookmaker && sample.provider === input.provider), weight: 0.1 },
    { probability: groupProbability(samples, (sample) => sample.oddRange === range), weight: 0.1 },
    { probability: recentProbability(samples), weight: 0.05 },
  ]);
}

function calculateBacktest(samples: MlTrainingSample[]) {
  const splitAt = Math.max(1, Math.floor(samples.length * 0.8));
  const train = samples.slice(0, splitAt);
  const test = decided(samples.slice(splitAt));
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let selected = 0;
  let profit = 0;
  for (const sample of test) {
    const modelProbability = predictionFromSamples(train, sample);
    if (modelProbability == null) continue;
    const predicted = modelProbability > sample.impliedProbability;
    const won = sample.result === "WON";
    if (predicted && won) tp += 1;
    else if (predicted) fp += 1;
    else if (won) fn += 1;
    else tn += 1;
    if (predicted) {
      selected += 1;
      profit += sample.profit;
    }
  }
  const evaluated = tp + fp + tn + fn;
  const wins = test.filter((sample) => sample.result === "WON").length;
  return {
    accuracy: evaluated ? (tp + tn) / evaluated * 100 : 0,
    precision: tp + fp ? tp / (tp + fp) * 100 : 0,
    recall: tp + fn ? tp / (tp + fn) * 100 : 0,
    roiBacktest: selected ? profit / selected * 100 : 0,
    winRateBacktest: test.length ? wins / test.length * 100 : 0,
    sampleSize: test.length,
  };
}

function classifyPrediction(input: { edge: number; confidenceScore: number; modelProbability: number }) {
  if (input.edge <= 0) return "NO BET";
  if (input.confidenceScore >= 95 && input.edge > 0.08) return "DIAMANTE";
  if (input.confidenceScore >= 90) return "ELITE GREEN";
  if (input.confidenceScore >= 80) return "GREEN FORTE";
  return "WATCH";
}

export async function buildTrainingDataset(): Promise<MlTrainingSample[]> {
  const rows = await loadRealSettledRows();
  return rows.map(toSample);
}

export function validateTrainingSample(samples: MlTrainingSample[]): MlSampleValidation {
  const wonSamples = samples.filter((sample) => sample.result === "WON").length;
  const lostSamples = samples.filter((sample) => sample.result === "LOST").length;
  const voidSamples = samples.filter((sample) => sample.result === "VOID").length;
  const validation = {
    totalSamples: samples.length,
    wonSamples,
    lostSamples,
    voidSamples,
    minimumSamples: MINIMUM_ML_TRAINING_SAMPLES,
    marketsCovered: new Set(samples.map((sample) => sample.market)).size,
    competitionsCovered: new Set(samples.map((sample) => sample.competition)).size,
    bookmakersCovered: new Set(samples.map((sample) => sample.bookmaker)).size,
  };
  if (samples.length < MINIMUM_ML_TRAINING_SAMPLES) {
    return { ...validation, status: "INSUFFICIENT_REAL_DATA", blockReason: "MINIMUM_REAL_SETTLED_SAMPLE_NOT_REACHED" };
  }
  if (wonSamples + lostSamples < MINIMUM_ML_TRAINING_SAMPLES) {
    return { ...validation, status: "INSUFFICIENT_REAL_DATA", blockReason: "MINIMUM_DECIDED_SAMPLE_NOT_REACHED" };
  }
  return { ...validation, status: "READY" };
}

export async function trainBaselineModel() {
  const startedAt = new Date();
  const job = await prisma.jobRun.create({ data: { name: "ML_TRAINING", status: "RUNNING", startedAt } }).catch(() => null);
  const samples = await buildTrainingDataset();
  const validation = validateTrainingSample(samples);
  const run = await prisma.mlTrainingRun.create({
    data: {
      startedAt,
      status: validation.status === "READY" ? "RUNNING" : "INSUFFICIENT_REAL_DATA",
      totalSamples: validation.totalSamples,
      wonSamples: validation.wonSamples,
      lostSamples: validation.lostSamples,
      voidSamples: validation.voidSamples,
      marketsCovered: validation.marketsCovered,
      competitionsCovered: validation.competitionsCovered,
      bookmakersCovered: validation.bookmakersCovered,
      modelVersion: MODEL_VERSION,
      notes: validation.blockReason,
    },
  });
  if (validation.status !== "READY") {
    const finishedAt = new Date();
    await prisma.mlTrainingRun.update({ where: { id: run.id }, data: { status: "INSUFFICIENT_REAL_DATA", finishedAt } });
    await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: validation.blockReason, metadata: JSON.stringify({ samplesProcessed: samples.length, predictionsGenerated: 0, errors: [] }) } }).catch(() => undefined);
    return { trained: false, status: "INSUFFICIENT_REAL_DATA", runId: run.id, validation };
  }
  const metrics = calculateBacktest(samples);
  const finishedAt = new Date();
  await prisma.mlModelMetric.create({ data: { trainingRunId: run.id, ...metrics } });
  await prisma.mlTrainingRun.update({ where: { id: run.id }, data: { status: "TRAINED", finishedAt, notes: JSON.stringify({ weights: ["historical", "market", "competition", "bookmaker", "oddRange", "recent"] }) } });
  await prisma.jobRun.update({ where: { id: job?.id ?? "" }, data: { status: "SUCCESS", completedAt: finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), message: "ML_TRAINING concluido com dados reais.", metadata: JSON.stringify({ samplesProcessed: samples.length, predictionsGenerated: 0, errors: [] }) } }).catch(() => undefined);
  await prisma.auditLog.create({ data: { category: "ML_TRAINING", status: "SUCCESS", message: `${MODEL_VERSION} treinado com ${samples.length} resultados reais liquidados.`, metadata: JSON.stringify(metrics) } }).catch(() => undefined);
  return { trained: true, status: "TRAINED", runId: run.id, validation, metrics };
}

export async function calculateModelConfidence(input: { market: string; competition: string; provider: string; bookmaker: string; odd: number }) {
  const range = oddRange(input.odd);
  const [market, competition, bookmaker, odds] = await Promise.all([
    prisma.marketConfidence.findUnique({ where: { market_provider_bookmaker: { market: input.market, provider: input.provider, bookmaker: input.bookmaker } } }).catch(() => null),
    prisma.competitionConfidence.findUnique({ where: { competition_provider: { competition: input.competition, provider: input.provider } } }).catch(() => null),
    prisma.bookmakerConfidence.findUnique({ where: { bookmaker_provider: { bookmaker: input.bookmaker, provider: input.provider } } }).catch(() => null),
    prisma.oddRangeConfidence.findUnique({ where: { oddRange_provider: { oddRange: range, provider: input.provider } } }).catch(() => null),
  ]);
  const rows: ConfidenceRow[] = [market, competition, bookmaker, odds].flatMap((row) => row && row.status === "READY" ? [{ status: row.status, confidenceScore: row.confidenceScore }] : []);
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + row.confidenceScore, 0) / rows.length);
}

export async function predictOutcomeProbability(input: ProbabilityInput): Promise<MlPredictionResult> {
  const latest = await prisma.mlTrainingRun.findFirst({ where: { status: "TRAINED" }, orderBy: { finishedAt: "desc" } });
  if (!latest || latest.totalSamples < MINIMUM_ML_TRAINING_SAMPLES) {
    return { ...input, status: "INSUFFICIENT_REAL_DATA", modelVersion: latest?.modelVersion ?? null, modelProbability: null, edge: null, confidenceScore: 0, classification: "INSUFFICIENT_REAL_DATA", blockReason: "NO_TRAINED_MODEL_WITH_MINIMUM_REAL_SAMPLE" };
  }
  const samples = await buildTrainingDataset();
  const validation = validateTrainingSample(samples);
  if (validation.status !== "READY") {
    return { ...input, status: "INSUFFICIENT_REAL_DATA", modelVersion: latest.modelVersion, modelProbability: null, edge: null, confidenceScore: 0, classification: "INSUFFICIENT_REAL_DATA", blockReason: validation.blockReason };
  }
  const modelProbability = predictionFromSamples(samples, input);
  if (modelProbability == null) {
    return { ...input, status: "INSUFFICIENT_REAL_DATA", modelVersion: latest.modelVersion, modelProbability: null, edge: null, confidenceScore: 0, classification: "INSUFFICIENT_REAL_DATA", blockReason: "NO_REAL_PROBABILITY_AVAILABLE" };
  }
  const edge = modelProbability - input.impliedProbability;
  const confidenceScore = await calculateModelConfidence(input);
  const classification = classifyPrediction({ edge, confidenceScore, modelProbability });
  const status = confidenceScore >= 60 ? "READY" : "INSUFFICIENT_REAL_DATA";
  await prisma.mlPrediction.create({
    data: {
      matchId: input.matchId,
      market: input.market,
      selection: input.selection,
      provider: input.provider,
      bookmaker: input.bookmaker,
      odd: input.odd,
      impliedProbability: round(input.impliedProbability),
      modelProbability: round(modelProbability),
      edge: round(edge),
      confidenceScore,
      classification,
      status,
    },
  }).catch(() => undefined);
  return { ...input, status, modelVersion: latest.modelVersion, modelProbability: round(modelProbability), edge: round(edge), confidenceScore, classification };
}

export async function generateModelReport(): Promise<MlModelReport> {
  const [samples, latestRun, latestMetric, predictionsGenerated] = await Promise.all([
    buildTrainingDataset(),
    prisma.mlTrainingRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null),
    prisma.mlModelMetric.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null),
    prisma.mlPrediction.count().catch(() => 0),
  ]);
  const validation = validateTrainingSample(samples);
  return {
    status: latestRun?.status === "TRAINED" ? "TRAINED" : validation.status,
    modelVersion: latestRun?.modelVersion ?? null,
    totalSamples: validation.totalSamples,
    minimumSamples: validation.minimumSamples,
    lastRunAt: latestRun?.finishedAt?.toISOString() ?? latestRun?.startedAt?.toISOString() ?? null,
    accuracy: latestMetric?.accuracy ?? null,
    precision: latestMetric?.precision ?? null,
    recall: latestMetric?.recall ?? null,
    roiBacktest: latestMetric?.roiBacktest ?? null,
    winRateBacktest: latestMetric?.winRateBacktest ?? null,
    predictionsGenerated,
    blockReason: validation.status === "READY" ? undefined : validation.blockReason,
  };
}
