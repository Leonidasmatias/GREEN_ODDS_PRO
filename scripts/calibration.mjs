// Sprint 9.1 — Explainability Calibration & Backtest, Etapa 8.
// CLI: Backtest → Calibração → Relatório Markdown (`npm run calibration`).
// Único script desta sprint autorizado a tocar o banco — e somente em
// LEITURA (nunca `create`/`update`/`delete`). Nunca altera produção,
// Railway ou qualquer arquivo além de `docs/CALIBRATION_REPORT.md`.
//
// Tenta montar um dataset REAL a partir do PostgreSQL configurado
// (PredictionSnapshotRecord persistidos, casados por matchId com
// ESoccerMatch já finalizadas). Se DATABASE_URL não estiver configurada,
// ou a amostra real resultante for vazia, cai para um dataset SINTÉTICO
// de demonstração, claramente identificado como tal no relatório — nunca
// apresentado como dado real.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  runBacktest,
  buildCalibrationReportMarkdown,
} from "../src/services/explainability-calibration/index.ts";
import {
  HIGH_VOLATILITY_MARGIN_THRESHOLD,
  INSUFFICIENT_CONFIDENCE_HIGH_THRESHOLD,
  INSUFFICIENT_CONFIDENCE_MEDIUM_THRESHOLD,
  QUALITY_GRADE_THRESHOLDS,
} from "../src/services/prediction-explanation/predictionExplanationConstants.ts";
import { buildSyntheticCalibrationDataset } from "./calibration/syntheticDataset.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = resolve(__dirname, "..", "docs", "CALIBRATION_REPORT.md");

function currentThresholds() {
  const aPlus = QUALITY_GRADE_THRESHOLDS.find((t) => t.grade === "A_PLUS");
  return {
    highVolatilityMarginThreshold: HIGH_VOLATILITY_MARGIN_THRESHOLD,
    insufficientConfidenceHighThreshold: INSUFFICIENT_CONFIDENCE_HIGH_THRESHOLD,
    insufficientConfidenceMediumThreshold: INSUFFICIENT_CONFIDENCE_MEDIUM_THRESHOLD,
    qualityGradeAPlusMinScore: aPlus ? aPlus.minScore : 90,
  };
}

function outcomeFromScores(homeScore, awayScore) {
  if (homeScore > awayScore) return "HOME_WIN";
  if (homeScore < awayScore) return "AWAY_WIN";
  return "DRAW";
}

/** Tenta montar um dataset real a partir do Postgres configurado. Nunca
 * escreve nada — apenas `findMany`/leitura. Retorna `null` (nunca lança)
 * quando `DATABASE_URL` não está configurada ou a consulta falha, para
 * que o chamador caia no dataset sintético sem interromper o script. */
async function tryBuildRealDataset() {
  if (!process.env.DATABASE_URL) return null;

  try {
    const { prisma } = await import("../src/lib/prisma.ts");

    const records = await prisma.predictionSnapshotRecord.findMany({ take: 5000, orderBy: { createdAt: "asc" } });
    const predictions = records.map((row) => JSON.parse(row.snapshotPayload));

    const matchIds = [...new Set(predictions.map((p) => p.matchId))];
    const finishedMatches = await prisma.eSoccerMatch.findMany({
      where: { id: { in: matchIds }, status: "FINISHED", homeScore: { not: null }, awayScore: { not: null } },
      select: { id: true, homeScore: true, awayScore: true },
    });

    const actuals = finishedMatches.map((match) => ({
      matchId: match.id,
      outcome: outcomeFromScores(match.homeScore, match.awayScore),
      homeGoals: match.homeScore,
      awayGoals: match.awayScore,
    }));

    await prisma.$disconnect();

    return {
      dataset: { datasetId: "railway-production", predictions, actuals },
      sourceDescription: `${predictions.length} previsões persistidas, ${actuals.length} partidas eSoccer finalizadas encontradas com resultado real.`,
    };
  } catch (error) {
    console.error(`[calibration] Falha ao consultar o banco real: ${error instanceof Error ? error.message : "erro desconhecido"}. Usando dataset sintético.`);
    return null;
  }
}

async function main() {
  const now = new Date().toISOString();
  const thresholds = currentThresholds();

  const real = await tryBuildRealDataset();
  // "Tentativa" é registrada mesmo quando a consulta real não encontra
  // nenhum registro — distingue "não tentamos" (sem DATABASE_URL) de
  // "tentamos e não existe dado real ainda" no status do relatório
  // (ver ReportStatus.ts).
  const realDataAttempted = real !== null;
  const useReal = real !== null && real.dataset.actuals.length > 0;

  const { dataset, sourceDescription } = useReal
    ? real
    : { dataset: buildSyntheticCalibrationDataset(), sourceDescription: "Dataset sintético embutido neste script, gerado apenas para demonstrar o pipeline de backtest — não representa partidas reais." };

  // Cada previsão do dataset recebe uma tag de proveniência explícita —
  // nunca inferida pelo módulo de calibração. Todo o dataset usado numa
  // execução é 100% real ou 100% sintético (o CLI nunca mistura as duas
  // fontes numa mesma chamada), então a mesma origem se aplica a todas
  // as previsões desta execução.
  const provenanceTags = dataset.predictions.map((prediction) => ({ matchId: prediction.matchId, origin: useReal ? "REAL" : "SYNTHETIC" }));

  console.log(`[calibration] Origem dos dados: ${useReal ? "REAL" : "SYNTHETIC"} (consulta real tentada: ${realDataAttempted ? "sim" : "não"})`);
  console.log(`[calibration] ${sourceDescription}`);

  const result = runBacktest(dataset, now, thresholds, provenanceTags, realDataAttempted);

  console.log(`[calibration] Status: ${result.status} · registros válidos: ${result.datasetSummary.validRecords} · status do relatório: ${result.reportStatus}`);

  const markdown = buildCalibrationReportMarkdown(result, {
    generatedAt: now,
    sourceDescription,
  });

  writeFileSync(REPORT_PATH, markdown, "utf8");
  console.log(`[calibration] Relatório escrito em ${REPORT_PATH}`);
  console.log("[calibration] Nenhum threshold de produção foi alterado. Nenhuma escrita no banco foi realizada.");
}

main().catch((error) => {
  console.error("[calibration] Falha inesperada:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
