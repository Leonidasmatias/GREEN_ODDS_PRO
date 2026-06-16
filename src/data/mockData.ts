import { analyzeOpportunity } from "@/lib/analysis";
import { Game, Opportunity } from "@/lib/types";

export const games: Game[] = [
  { id: "1", competition: "Copa do Mundo 2026", group: "Grupo A", time: "13:00", home: "Estados Unidos", away: "Suíça", homeCode: "USA", awayCode: "SUI", status: "Pré-jogo", odds: { home: 2.18, draw: 3.25, away: 3.4 } },
  { id: "2", competition: "Copa do Mundo 2026", group: "Grupo C", time: "16:00", home: "Brasil", away: "Marrocos", homeCode: "BRA", awayCode: "MAR", status: "Ao vivo", score: "1 - 0", minute: "62'", odds: { home: 1.48, draw: 4.1, away: 7.2 } },
  { id: "3", competition: "Copa do Mundo 2026", group: "Grupo F", time: "19:00", home: "França", away: "Japão", homeCode: "FRA", awayCode: "JPN", status: "Pré-jogo", odds: { home: 1.66, draw: 3.8, away: 5.3 } },
  { id: "4", competition: "Copa do Mundo 2026", group: "Grupo H", time: "22:00", home: "Argentina", away: "Dinamarca", homeCode: "ARG", awayCode: "DEN", status: "Pré-jogo", odds: { home: 1.88, draw: 3.45, away: 4.3 } },
];

const rawOpportunities: Opportunity[] = [
  { id: "o1", game: "Brasil x Marrocos", market: "Total de gols", pick: "Mais de 1.5 gols", odd: 1.54, fairProbability: 0.72, confidence: 82, context: { form: .84, attack: .88, defense: .7, timing: .78, stats: .86 } },
  { id: "o2", game: "França x Japão", market: "Dupla chance", pick: "França ou empate", odd: 1.28, fairProbability: 0.9, confidence: 92, context: { form: .88, attack: .86, defense: .9, timing: .84, stats: .89 } },
  { id: "o3", game: "Argentina x Dinamarca", market: "Escanteios", pick: "Mais de 8.5 cantos", odd: 1.87, fairProbability: 0.59, confidence: 74, context: { form: .72, attack: .76, defense: .61, timing: .7, stats: .82 } },
  { id: "o4", game: "Estados Unidos x Suíça", market: "Ambas marcam", pick: "Sim", odd: 1.92, fairProbability: 0.57, confidence: 68, context: { form: .66, attack: .71, defense: .58, timing: .68, stats: .75 } },
  { id: "o5", game: "Brasil x Marrocos", market: "Chutes ao gol", pick: "Brasil +4.5", odd: 1.74, fairProbability: 0.63, confidence: 77, context: { form: .81, attack: .89, defense: .67, timing: .84, stats: .79 } },
  { id: "o6", game: "França x Japão", market: "Handicap asiático", pick: "França -1.0", odd: 2.03, fairProbability: 0.52, confidence: 65, context: { form: .76, attack: .82, defense: .69, timing: .65, stats: .72 } },
];

export const opportunities = rawOpportunities.map(analyzeOpportunity);

export const history = [
  { date: "12 JUN", game: "Espanha x México", market: "Over 1.5 gols", odd: 1.52, result: "2 - 1", status: "Green", pnl: "+0.52u" },
  { date: "12 JUN", game: "Portugal x Canadá", market: "Portugal vence", odd: 1.71, result: "1 - 1", status: "Red", pnl: "-1.00u" },
  { date: "13 JUN", game: "Inglaterra x Coreia", market: "Under 3.5 gols", odd: 1.44, result: "2 - 0", status: "Green", pnl: "+0.44u" },
  { date: "15 JUN", game: "Brasil x Marrocos", market: "Over 1.5 gols", odd: 1.54, result: "Em andamento", status: "Pendente", pnl: "0.00u" },
];

export const performanceSeries = [
  { date: "01 JUN", profit: 0.0, roi: 0.0, greens: 0, reds: 0 },
  { date: "03 JUN", profit: 0.7, roi: 3.5, greens: 2, reds: 1 },
  { date: "05 JUN", profit: 1.9, roi: 6.3, greens: 4, reds: 2 },
  { date: "07 JUN", profit: 1.4, roi: 3.9, greens: 5, reds: 4 },
  { date: "09 JUN", profit: 3.2, roi: 7.6, greens: 8, reds: 4 },
  { date: "11 JUN", profit: 4.8, roi: 9.6, greens: 11, reds: 5 },
  { date: "13 JUN", profit: 6.1, roi: 11.3, greens: 14, reds: 6 },
  { date: "15 JUN", profit: 8.4, roi: 12.8, greens: 21, reds: 9 },
];

export const performanceSummary = {
  totalEntries: 38,
  greens: 21,
  reds: 9,
  pending: 8,
  roi: 12.8,
  hitRate: 70,
  accumulatedProfit: 8.4,
};
