import type { BacktestMarket, HistoricalBacktestEntry } from "@/data/backtestData";

export interface BacktestMetrics {
  entries: number;
  greens: number;
  reds: number;
  totalStake: number;
  accumulatedProfit: number;
  roi: number;
  yield: number;
  winRate: number;
  maxDrawdown: number;
}

export interface MarketRanking extends BacktestMetrics {
  market: BacktestMarket;
}

export interface ModelWeights {
  form: number;
  attack: number;
  defense: number;
  momentum: number;
  ranking: number;
  statistics: number;
}

export const defaultModelWeights: ModelWeights = { form: 20, attack: 20, defense: 20, momentum: 15, ranking: 10, statistics: 15 };

export function calibratedScore(entry: HistoricalBacktestEntry, weights: ModelWeights = defaultModelWeights) {
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const weighted = entry.weights.form * weights.form + entry.weights.attack * weights.attack + entry.weights.defense * weights.defense + entry.weights.momentum * weights.momentum + entry.weights.ranking * weights.ranking + entry.weights.statistics * weights.statistics;
  return Math.max(0, Math.min(100, entry.score * 0.68 + weighted / totalWeight * 32));
}

export function calculateBacktest(entries: HistoricalBacktestEntry[], initialBankroll = 100): BacktestMetrics {
  let profit = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let greens = 0;
  for (const entry of entries) {
    if (entry.result === "GREEN") { profit += entry.odd - 1; greens += 1; } else profit -= 1;
    peak = Math.max(peak, profit);
    maxDrawdown = Math.max(maxDrawdown, peak - profit);
  }
  const totalStake = entries.length;
  return {
    entries: entries.length,
    greens,
    reds: entries.length - greens,
    totalStake,
    accumulatedProfit: profit,
    roi: initialBankroll ? profit / initialBankroll * 100 : 0,
    yield: totalStake ? profit / totalStake * 100 : 0,
    winRate: entries.length ? greens / entries.length * 100 : 0,
    maxDrawdown,
  };
}

export function filterBacktest(entries: HistoricalBacktestEntry[], scoreThreshold: number, evThreshold: number, weights = defaultModelWeights) {
  return entries.filter((entry) => calibratedScore(entry, weights) >= scoreThreshold && entry.expectedValue >= evThreshold);
}

export function buildQualityMatrix(entries: HistoricalBacktestEntry[], weights = defaultModelWeights) {
  return [70, 80, 90].flatMap((score) => [0.05, 0.1, 0.15].map((ev) => ({ score, ev, ...calculateBacktest(filterBacktest(entries, score, ev, weights)) })));
}

export function rankMarkets(entries: HistoricalBacktestEntry[], weights = defaultModelWeights): MarketRanking[] {
  const markets = [...new Set(entries.map((entry) => entry.market))];
  return markets.map((market) => ({ market, ...calculateBacktest(filterBacktest(entries.filter((entry) => entry.market === market), 70, 0.05, weights)) })).sort((a, b) => b.yield - a.yield || b.winRate - a.winRate);
}

export function buildMarketHeatmap(entries: HistoricalBacktestEntry[], weights = defaultModelWeights) {
  return rankMarkets(entries, weights).map((ranking) => ({ market: ranking.market, cells: [70, 80, 90].map((score) => ({ score, roi: calculateBacktest(filterBacktest(entries.filter((entry) => entry.market === ranking.market), score, 0.05, weights)).yield })) }));
}

export function buildBacktestReport(entries: HistoricalBacktestEntry[], weights = defaultModelWeights) {
  const filtered = filterBacktest(entries, 70, 0.05, weights);
  const metrics = calculateBacktest(filtered);
  const marketRankings = rankMarkets(entries, weights);
  return { metrics, qualityMatrix: buildQualityMatrix(entries, weights), marketRankings, heatmap: buildMarketHeatmap(entries, weights), bestMarket: marketRankings[0], worstMarket: marketRankings.at(-1) };
}
