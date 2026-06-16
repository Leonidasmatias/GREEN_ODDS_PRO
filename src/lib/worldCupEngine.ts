import { analyzeOpportunity, rankByExpectedValue } from "./analysis";
import type { AnalyzedOpportunity, MonteCarloResult, PowerRating, TeamIntelligence } from "./types";
import { teamIntelligence, worldCupFixtures, type WorldCupFixtureModel } from "@/data/worldCupData";

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function calculatePowerRating(team: TeamIntelligence): PowerRating {
  const attack = clamp(team.goalsScoredAverage / 2.5) * 100;
  const defense = clamp(1 - team.goalsConcededAverage / 2.2) * 100;
  const form = (team.formLast5 * 0.6 + team.formLast10 * 0.4) * 100;
  const momentum = team.momentum * 100;
  const fifaRanking = clamp(1 - (team.fifaRank - 1) / 50) * 100;
  const offensiveEfficiency = team.offensiveEfficiency * 100;
  const defensiveEfficiency = team.defensiveEfficiency * 100;
  const total = attack * 0.2 + defense * 0.2 + form * 0.17 + momentum * 0.12 + fifaRanking * 0.11 + offensiveEfficiency * 0.1 + defensiveEfficiency * 0.1;
  return { total, attack, defense, form, momentum, fifaRanking, offensiveEfficiency, defensiveEfficiency };
}

function seedFrom(text: string) {
  let seed = 2166136261;
  for (let index = 0; index < text.length; index += 1) seed = Math.imul(seed ^ text.charCodeAt(index), 16777619);
  return seed >>> 0;
}

function createRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function poisson(lambda: number, random: () => number) {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do { count += 1; product *= random(); } while (product > limit && count < 12);
  return count - 1;
}

export function expectedGoals(home: TeamIntelligence, away: TeamIntelligence) {
  const homeAttack = home.goalsScoredAverage * 0.55 + away.goalsConcededAverage * 0.45;
  const awayAttack = away.goalsScoredAverage * 0.5 + home.goalsConcededAverage * 0.5;
  return {
    home: clamp(homeAttack * (0.88 + home.homeEfficiency * 0.25) * (0.9 + home.momentum * 0.15), 0.25, 3.4),
    away: clamp(awayAttack * (0.84 + away.awayEfficiency * 0.22) * (0.9 + away.momentum * 0.12), 0.2, 3.1),
  };
}

export function runMonteCarlo(home: TeamIntelligence, away: TeamIntelligence, simulations = 1000): MonteCarloResult {
  const goals = expectedGoals(home, away);
  const random = createRandom(seedFrom(`${home.team}:${away.team}:${simulations}`));
  let homeWins = 0; let draws = 0; let awayWins = 0; let homeGoals = 0; let awayGoals = 0;
  const distribution = new Map<string, number>();
  for (let index = 0; index < simulations; index += 1) {
    const homeScore = poisson(goals.home, random);
    const awayScore = poisson(goals.away, random);
    homeGoals += homeScore; awayGoals += awayScore;
    if (homeScore > awayScore) homeWins += 1; else if (homeScore === awayScore) draws += 1; else awayWins += 1;
    const key = `${homeScore}-${awayScore}`;
    distribution.set(key, (distribution.get(key) ?? 0) + 1);
  }
  return {
    simulations,
    homeWin: homeWins / simulations,
    draw: draws / simulations,
    awayWin: awayWins / simulations,
    scoreDistribution: [...distribution.entries()].map(([score, count]) => ({ score, probability: count / simulations })).sort((a, b) => b.probability - a.probability).slice(0, 6),
    averageHomeGoals: homeGoals / simulations,
    averageAwayGoals: awayGoals / simulations,
  };
}

function poissonOverProbability(lambda: number, threshold: number) {
  const maxGoals = Math.floor(threshold);
  let cumulative = 0;
  let factorial = 1;
  for (let goals = 0; goals <= maxGoals; goals += 1) {
    if (goals > 0) factorial *= goals;
    cumulative += Math.exp(-lambda) * Math.pow(lambda, goals) / factorial;
  }
  return 1 - cumulative;
}

function marketProbability(label: string, home: TeamIntelligence, away: TeamIntelligence, simulation: MonteCarloResult) {
  const totalLambda = simulation.averageHomeGoals + simulation.averageAwayGoals;
  if (label.startsWith("Vitória")) return simulation.homeWin;
  if (label === "Over 1.5") return poissonOverProbability(totalLambda, 1.5);
  if (label === "Over 2.5") return poissonOverProbability(totalLambda, 2.5);
  if (label === "Over 3.5") return poissonOverProbability(totalLambda, 3.5);
  if (label === "BTTS") return (1 - Math.exp(-simulation.averageHomeGoals)) * (1 - Math.exp(-simulation.averageAwayGoals));
  if (label.startsWith("Escanteios")) return clamp(0.5 + (home.cornersAverage + away.cornersAverage - 8.5) * 0.095, 0.2, 0.82);
  if (label.startsWith("Cartões")) return clamp(0.48 + (home.cardsAverage + away.cardsAverage - 3.5) * 0.12, 0.2, 0.82);
  if (label.endsWith("primeiro gol")) return clamp(simulation.averageHomeGoals / totalLambda * (1 - Math.exp(-totalLambda)), 0.2, 0.88);
  if (label.endsWith("empate anula")) return clamp(simulation.homeWin / (1 - simulation.draw), 0.25, 0.94);
  if (label.endsWith("ou empate")) return clamp(simulation.homeWin + simulation.draw, 0.3, 0.97);
  return 0.5;
}

function marketName(label: string) {
  if (label.startsWith("Vitória")) return "1X2";
  if (label.startsWith("Over")) return "Total de gols";
  if (label === "BTTS") return "Ambas marcam";
  if (label.startsWith("Escanteios")) return "Escanteios";
  if (label.startsWith("Cartões")) return "Cartões";
  if (label.endsWith("primeiro gol")) return "Primeiro gol";
  if (label.endsWith("empate anula")) return "Empate anula";
  return "Dupla chance";
}

export interface WorldCupMatchAnalysis {
  fixture: WorldCupFixtureModel;
  home: TeamIntelligence;
  away: TeamIntelligence;
  homePower: PowerRating;
  awayPower: PowerRating;
  simulation: MonteCarloResult;
  opportunities: AnalyzedOpportunity[];
}

export function analyzeWorldCupFixture(fixture: WorldCupFixtureModel): WorldCupMatchAnalysis {
  const home = teamIntelligence[fixture.home];
  const away = teamIntelligence[fixture.away];
  const homePower = calculatePowerRating(home);
  const awayPower = calculatePowerRating(away);
  const simulation = runMonteCarlo(home, away, 1000);
  const matchPower = homePower.total * 0.58 + awayPower.total * 0.42;
  const opportunities = Object.entries(fixture.odds).map(([pick, odd], index) => {
    const probability = marketProbability(pick, home, away, simulation);
    const confidence = clamp(0.45 + Math.abs(probability - 1 / odd) * 1.8 + (matchPower / 100) * 0.25) * 100;
    return analyzeOpportunity({
      id: `${fixture.id}-${index}`,
      game: `${fixture.home} x ${fixture.away}`,
      market: marketName(pick),
      pick,
      odd,
      fairProbability: probability,
      confidence,
      powerRating: matchPower,
      context: { form: (home.formLast5 + away.formLast5) / 2, attack: homePower.attack / 100, defense: homePower.defense / 100, timing: (home.momentum + away.momentum) / 2, stats: (homePower.total + awayPower.total) / 200 },
    });
  });
  return { fixture, home, away, homePower, awayPower, simulation, opportunities };
}

export const worldCupAnalyses = worldCupFixtures.map(analyzeWorldCupFixture);
export const worldCupOpportunities = rankByExpectedValue(worldCupAnalyses.flatMap((analysis) => analysis.opportunities));
