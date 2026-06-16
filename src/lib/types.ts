export type Risk = "Baixo" | "Médio" | "Alto";
export type Signal = "Entrar" | "Aguardar" | "Evitar";
export type GreenClassification = "ELITE GREEN" | "GREEN PREMIUM" | "GREEN FORTE" | "MODERADO" | "EVITAR";
export type GameStatus = "Pré-jogo" | "Ao vivo" | "Encerrado";

export interface Game {
  id: string;
  competition: string;
  group: string;
  time: string;
  home: string;
  away: string;
  homeCode: string;
  awayCode: string;
  status: GameStatus;
  score?: string;
  minute?: string;
  odds: { home: number; draw: number; away: number };
}

export interface Opportunity {
  id: string;
  game: string;
  market: string;
  pick: string;
  odd: number;
  fairProbability: number;
  confidence: number;
  powerRating?: number;
  context: { form: number; attack: number; defense: number; timing: number; stats: number };
}

export interface AnalyzedOpportunity extends Opportunity {
  impliedProbability: number;
  edge: number;
  expectedValue: number;
  risk: Risk;
  signal: Signal;
  score: number;
  classification: GreenClassification;
  powerRating: number;
}

export interface TeamIntelligence {
  team: string;
  fifaRank: number;
  formLast5: number;
  formLast10: number;
  goalsScoredAverage: number;
  goalsConcededAverage: number;
  cornersAverage: number;
  cardsAverage: number;
  shotsAverage: number;
  homeEfficiency: number;
  awayEfficiency: number;
  cleanSheetRate: number;
  bttsRate: number;
  offensiveEfficiency: number;
  defensiveEfficiency: number;
  momentum: number;
}

export interface PowerRating {
  total: number;
  attack: number;
  defense: number;
  form: number;
  momentum: number;
  fifaRanking: number;
  offensiveEfficiency: number;
  defensiveEfficiency: number;
}

export interface MonteCarloResult {
  simulations: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  scoreDistribution: Array<{ score: string; probability: number }>;
  averageHomeGoals: number;
  averageAwayGoals: number;
}

export interface SmartMultiple {
  selections: AnalyzedOpportunity[];
  totalOdd: number;
  averageScore: number;
  combinedProbability: number;
  suggestedStake: number;
  confidence: number;
  risk: Risk;
}
