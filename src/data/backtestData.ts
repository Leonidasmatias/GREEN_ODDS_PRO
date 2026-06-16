export type BacktestMarket = "1X2" | "BTTS" | "Over 1.5" | "Over 2.5" | "Escanteios" | "Cartões";

export interface HistoricalBacktestEntry {
  id: string;
  date: string;
  game: string;
  market: BacktestMarket;
  selection: string;
  odd: number;
  score: number;
  expectedValue: number;
  result: "GREEN" | "RED";
  weights: { form: number; attack: number; defense: number; momentum: number; ranking: number; statistics: number };
}

const profiles: Array<{ market: BacktestMarket; selection: string; odd: number; baseProbability: number }> = [
  { market: "1X2", selection: "Favorito vence", odd: 2.04, baseProbability: 0.51 },
  { market: "BTTS", selection: "Ambas marcam", odd: 1.91, baseProbability: 0.56 },
  { market: "Over 1.5", selection: "Mais de 1.5 gols", odd: 1.53, baseProbability: 0.71 },
  { market: "Over 2.5", selection: "Mais de 2.5 gols", odd: 2.03, baseProbability: 0.53 },
  { market: "Escanteios", selection: "Mais de 8.5 cantos", odd: 1.86, baseProbability: 0.57 },
  { market: "Cartões", selection: "Mais de 3.5 cartões", odd: 1.79, baseProbability: 0.54 },
];

const teams = ["Brasil x Chile", "França x Bélgica", "Argentina x Colômbia", "Japão x Coreia", "Marrocos x Egito", "Estados Unidos x México", "Dinamarca x Suécia", "Suíça x Áustria"];

function randomFactory(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createHistoricalBacktestData(): HistoricalBacktestEntry[] {
  const random = randomFactory(20260615);
  return Array.from({ length: 96 }, (_, index) => {
    const profile = profiles[index % profiles.length];
    const score = Math.round(62 + random() * 38);
    const qualityBoost = (score - 70) * 0.0026;
    const estimatedProbability = Math.max(0.3, Math.min(0.9, profile.baseProbability + qualityBoost + (random() - 0.5) * 0.045));
    const expectedValue = estimatedProbability * profile.odd - 1;
    const realizedProbability = Math.max(0.25, Math.min(0.88, profile.baseProbability + (score - 70) * 0.0021));
    const date = new Date(Date.UTC(2026, 1, 10 + index));
    return {
      id: `hist-${index + 1}`,
      date: date.toISOString().slice(0, 10),
      game: teams[index % teams.length],
      market: profile.market,
      selection: profile.selection,
      odd: Number((profile.odd + (random() - 0.5) * 0.16).toFixed(2)),
      score,
      expectedValue,
      result: random() < realizedProbability ? "GREEN" : "RED",
      weights: { form: random(), attack: random(), defense: random(), momentum: random(), ranking: random(), statistics: random() },
    };
  });
}

export const historicalBacktestData = createHistoricalBacktestData();
