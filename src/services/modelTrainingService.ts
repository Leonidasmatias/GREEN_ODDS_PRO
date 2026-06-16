import { prisma } from "@/lib/prisma";
import { getDataConfidence } from "./confidenceEngine";

export const MINIMUM_TRAINING_RECORDS = 100;
export const AUTO_RETRAIN_INCREMENT = 50;

type Row = { estimatedProbability: number; result: string; profit: number };

function splitTemporal<T>(rows: T[]) {
  const trainEnd = Math.floor(rows.length * 0.7);
  const validationEnd = trainEnd + Math.floor(rows.length * 0.15);
  return { train: rows.slice(0, trainEnd), validation: rows.slice(trainEnd, validationEnd), test: rows.slice(validationEnd) };
}

function selectThreshold(rows: Row[]) {
  let best = { threshold: 0.5, accuracy: -1 };
  for (let value = 45; value <= 75; value += 1) {
    const threshold = value / 100;
    const correct = rows.filter((row) => (row.estimatedProbability >= threshold) === (row.result === "WON")).length;
    const accuracy = rows.length ? correct / rows.length : 0;
    if (accuracy > best.accuracy) best = { threshold, accuracy };
  }
  return best.threshold;
}

function evaluate(rows: Row[], threshold: number) {
  let tp = 0; let fp = 0; let tn = 0; let fn = 0; let profit = 0; let selected = 0;
  for (const row of rows) {
    const predicted = row.estimatedProbability >= threshold;
    const won = row.result === "WON";
    if (predicted && won) tp += 1; else if (predicted) fp += 1; else if (won) fn += 1; else tn += 1;
    if (predicted) { selected += 1; profit += row.profit; }
  }
  const total = rows.length;
  const actualWins = rows.filter((row) => row.result === "WON").length;
  return { accuracy: total ? (tp + tn) / total * 100 : 0, precision: tp + fp ? tp / (tp + fp) * 100 : 0, recall: tp + fn ? tp / (tp + fn) * 100 : 0, roi: selected ? profit / selected * 100 : 0, yield: selected ? profit / selected * 100 : 0, winRate: total ? actualWins / total * 100 : 0, selected, profit };
}

export async function getTrainingStatus() {
  const records = await prisma.trainingDataset.count({ where: { result: { in: ["WON", "LOST"] } } });
  const latest = await prisma.modelVersion.findFirst({ orderBy: { trainedAt: "desc" } });
  const nextTrainingAt = latest ? latest.recordsUsed + AUTO_RETRAIN_INCREMENT : MINIMUM_TRAINING_RECORDS;
  return { records, minimum: MINIMUM_TRAINING_RECORDS, eligible: records >= MINIMUM_TRAINING_RECORDS, nextTrainingAt, newRecordsSinceTraining: latest ? records - latest.recordsUsed : records, confidence: getDataConfidence(records), latest };
}

export async function trainModelIfEligible(force = false) {
  const rows = await prisma.trainingDataset.findMany({ where: { result: { in: ["WON", "LOST"] } }, orderBy: { settledAt: "asc" }, select: { estimatedProbability: true, result: true, profit: true } });
  const latest = await prisma.modelVersion.findFirst({ orderBy: { trainedAt: "desc" } });
  if (rows.length < MINIMUM_TRAINING_RECORDS) return { trained: false, status: "INSUFFICIENT_REAL_DATA", reason: "Dados reais liquidados insuficientes para treinamento", records: rows.length, minimum: MINIMUM_TRAINING_RECORDS };
  if (!force && latest && rows.length < latest.recordsUsed + AUTO_RETRAIN_INCREMENT) return { trained: false, reason: `Aguardando ${latest.recordsUsed + AUTO_RETRAIN_INCREMENT - rows.length} novas tips liquidadas`, records: rows.length, minimum: MINIMUM_TRAINING_RECORDS };
  const split = splitTemporal(rows);
  const threshold = selectThreshold(split.train);
  const validation = evaluate(split.validation, threshold);
  const test = evaluate(split.test, threshold);
  const versionNumber = (await prisma.modelVersion.count()) + 1;
  const version = await prisma.modelVersion.create({ data: { version: `green-ai-v${versionNumber}`, recordsUsed: rows.length, winRate: test.winRate, roi: test.roi, yield: test.yield, accuracy: test.accuracy, precision: test.precision, recall: test.recall, notes: JSON.stringify({ threshold, split: { train: split.train.length, validation: split.validation.length, test: split.test.length }, validation }) } });
  await prisma.auditLog.create({ data: { category: "MODEL_TRAINING", status: "SUCCESS", message: `${version.version} treinado com ${rows.length} registros reais.`, metadata: JSON.stringify({ version: version.version, records: rows.length, threshold }) } });
  return { trained: true, version, threshold, split: { train: split.train.length, validation: split.validation.length, test: split.test.length }, test };
}

export async function getModelPerformance() {
  const status = await getTrainingStatus();
  const versions = await prisma.modelVersion.findMany({ orderBy: { trainedAt: "asc" } });
  return { status, current: versions.at(-1) ?? null, learningCurve: versions.map((version) => ({ version: version.version, trainedAt: version.trainedAt.toISOString(), recordsUsed: version.recordsUsed, accuracy: version.accuracy, precision: version.precision, recall: version.recall, roi: version.roi, yield: version.yield, winRate: version.winRate })) };
}
