// Sprint 6.5 — Prediction Center.
// Adaptador de apresentação: converte um `PredictionSnapshot` (envelope
// de identidade da Sprint 4.5, já contendo um `PredictionResult` real do
// Prediction Orchestrator) em `PredictionCenterViewModel`, pronto para o
// Prediction Center. NUNCA recalcula probabilidade, Green Score,
// Confidence, Match Outcome, placar ou qualquer valor já produzido pelo
// motor — apenas traduz nomes técnicos, formata valores, seleciona
// (máximo) e categoriza (rubrica sobre sinais já classificados). Função
// pura: nenhum efeito colateral, nenhum acesso a banco, nenhuma leitura
// de relógio (`Date.now()`), nenhum `Math.random()`, nenhuma dependência
// de React/Next.js. Nunca muta o `PredictionSnapshot` recebido; todo
// array/objeto de saída é uma nova estrutura.

// Imports relativos (não `@/`) — este adaptador precisa ser executável
// também por `node --test` (sem bundler), mesma justificativa documentada
// em `predictionCenterFormatters.ts`. Utiliza exclusivamente
// `predictionCenterTypes`/`predictionCenterFormatters`/
// `predictionMarketUtils` — nenhum import do pipeline legado.
import {
  formatConsistencyLevel,
  formatDataSufficiencyStatus,
  formatGreenScoreCategory,
  formatMarketCode,
  formatMatchOutcome,
  formatPredictionRiskLevel,
  formatPredictionRiskReason,
  formatPredictionSignalFavors,
  formatPredictionSignalSource,
  formatPredictionSignalType,
  formatProbability,
  formatReportDate,
  formatScore,
  formatSignalMagnitude,
  NOT_AVAILABLE,
} from "../lib/predictionCenterFormatters.ts";
import { classifyPredictionRisk, deriveItemStatus, selectBestMarket } from "../lib/predictionMarketUtils.ts";
import type { MarketCode, MarketViewModel, PredictionCenterViewModel, PredictionSnapshot, SignalViewModel } from "../lib/predictionCenterTypes.ts";

/** Busca uma linha de Over/Under por VALOR (nunca por índice) — a lista
 * de linhas configuradas pode mudar; um mercado ausente vira
 * `NOT_AVAILABLE`, nunca um índice incorreto nem um valor fabricado. */
function findOverProbability(overUnder: { line: number; over: number }[], line: number): number | null {
  const entry = overUnder.find((item) => item.line === line);
  return entry ? entry.over : null;
}

function buildMarket(code: MarketCode, probabilityValue: number | null): MarketViewModel {
  return {
    code,
    label: formatMarketCode(code),
    probabilityLabel: formatProbability(probabilityValue),
    probabilityValue,
  };
}

function buildMarkets(snapshot: PredictionSnapshot): MarketViewModel[] {
  const { prediction, goalDistribution } = snapshot.result;
  return [
    buildMarket("HOME_WIN", prediction.probabilities.homeWin),
    buildMarket("DRAW", prediction.probabilities.draw),
    buildMarket("AWAY_WIN", prediction.probabilities.awayWin),
    buildMarket("OVER_1_5", findOverProbability(goalDistribution.overUnder, 1.5)),
    buildMarket("OVER_2_5", findOverProbability(goalDistribution.overUnder, 2.5)),
    buildMarket("BTTS", goalDistribution.bothTeamsToScore.yes),
  ];
}

function buildSignals(topSignals: { type: Parameters<typeof formatPredictionSignalType>[0]; source: Parameters<typeof formatPredictionSignalSource>[0]; favors: Parameters<typeof formatPredictionSignalFavors>[0]; magnitude: number }[]): SignalViewModel[] {
  return topSignals.map((signal) => ({
    typeLabel: formatPredictionSignalType(signal.type),
    sourceLabel: formatPredictionSignalSource(signal.source),
    favorsLabel: formatPredictionSignalFavors(signal.favors),
    magnitudeLabel: formatSignalMagnitude(signal.magnitude),
  }));
}

/**
 * Converte um `PredictionSnapshot` já calculado em
 * `PredictionCenterViewModel`. Nunca lança exceção por dados ausentes
 * dentro do snapshot — valores ausentes (ex.: uma linha de Over/Under
 * não configurada) viram `"Não disponível"`/`null`, nunca `0` fabricado.
 */
export function buildPredictionCenterViewModel(snapshot: PredictionSnapshot): PredictionCenterViewModel {
  const { result } = snapshot;
  const markets = buildMarkets(snapshot);
  const risk = classifyPredictionRisk({
    combinedStatus: result.quality.combinedStatus,
    consistencyLevel: result.quality.consistency.level,
    warningsCount: result.warnings.length,
  });

  return {
    header: {
      matchId: snapshot.matchId,
      homeTeamLabel: snapshot.virtualTeamHome ?? NOT_AVAILABLE,
      awayTeamLabel: snapshot.virtualTeamAway ?? NOT_AVAILABLE,
      leagueLabel: snapshot.league ?? NOT_AVAILABLE,
      modelVersion: result.metadata.orchestratorModelVersion,
      generatedAtLabel: formatReportDate(result.metadata.generatedAt),
    },
    scores: {
      greenScore: result.greenScore.score,
      greenScoreCategory: result.greenScore.category,
      greenScoreLabel: formatScore(result.greenScore.score),
      greenScoreCategoryLabel: formatGreenScoreCategory(result.greenScore.category),
      confidence: result.confidence,
      confidenceLabel: formatScore(result.confidence),
    },
    outcome: {
      predictedOutcome: result.prediction.predictedOutcome,
      predictedOutcomeLabel: formatMatchOutcome(result.prediction.predictedOutcome),
      probabilities: {
        homeWin: formatProbability(result.prediction.probabilities.homeWin),
        draw: formatProbability(result.prediction.probabilities.draw),
        awayWin: formatProbability(result.prediction.probabilities.awayWin),
      },
      topProbabilityLabel: formatProbability(result.prediction.topProbability),
      marginLabel: formatProbability(result.prediction.probabilityMargin),
    },
    predictedScore: {
      homeGoals: result.goalDistribution.mostLikelyScore.homeGoals,
      awayGoals: result.goalDistribution.mostLikelyScore.awayGoals,
      probabilityLabel: formatProbability(result.goalDistribution.mostLikelyScore.probability),
    },
    markets,
    bestMarket: selectBestMarket(markets),
    confidenceContext: {
      dataSufficiencyLabel: formatDataSufficiencyStatus(result.quality.combinedStatus),
      consistencyLabel: formatConsistencyLevel(result.quality.consistency.level),
      consistencyMatchingWinner: result.quality.consistency.matchingWinner,
    },
    risk: {
      level: risk.level,
      label: formatPredictionRiskLevel(risk.level),
      reasons: risk.reasonCodes.map(formatPredictionRiskReason),
    },
    explanation: {
      topSignals: buildSignals(result.explanation.topSignals),
      totalSignalsConsidered: result.explanation.totalSignalsConsidered,
    },
    warnings: [...result.warnings],
    status: deriveItemStatus(risk.rank),
  };
}
