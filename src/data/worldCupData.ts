import type { TeamIntelligence } from "@/lib/types";

export const teamIntelligence: Record<string, TeamIntelligence> = {
  Brasil: { team: "Brasil", fifaRank: 5, formLast5: 0.8, formLast10: 0.73, goalsScoredAverage: 2.1, goalsConcededAverage: 0.8, cornersAverage: 6.2, cardsAverage: 1.8, shotsAverage: 15.4, homeEfficiency: 0.82, awayEfficiency: 0.7, cleanSheetRate: 0.5, bttsRate: 0.42, offensiveEfficiency: 0.86, defensiveEfficiency: 0.82, momentum: 0.84 },
  Marrocos: { team: "Marrocos", fifaRank: 12, formLast5: 0.67, formLast10: 0.64, goalsScoredAverage: 1.45, goalsConcededAverage: 0.85, cornersAverage: 4.8, cardsAverage: 2.2, shotsAverage: 11.7, homeEfficiency: 0.7, awayEfficiency: 0.61, cleanSheetRate: 0.46, bttsRate: 0.38, offensiveEfficiency: 0.68, defensiveEfficiency: 0.79, momentum: 0.7 },
  França: { team: "França", fifaRank: 2, formLast5: 0.87, formLast10: 0.78, goalsScoredAverage: 2.25, goalsConcededAverage: 0.7, cornersAverage: 5.9, cardsAverage: 1.55, shotsAverage: 16.1, homeEfficiency: 0.85, awayEfficiency: 0.76, cleanSheetRate: 0.58, bttsRate: 0.35, offensiveEfficiency: 0.9, defensiveEfficiency: 0.88, momentum: 0.88 },
  Japão: { team: "Japão", fifaRank: 18, formLast5: 0.73, formLast10: 0.7, goalsScoredAverage: 1.9, goalsConcededAverage: 1.05, cornersAverage: 5.1, cardsAverage: 1.4, shotsAverage: 13.8, homeEfficiency: 0.75, awayEfficiency: 0.66, cleanSheetRate: 0.38, bttsRate: 0.54, offensiveEfficiency: 0.77, defensiveEfficiency: 0.7, momentum: 0.79 },
  Argentina: { team: "Argentina", fifaRank: 1, formLast5: 0.93, formLast10: 0.84, goalsScoredAverage: 2.05, goalsConcededAverage: 0.55, cornersAverage: 5.6, cardsAverage: 1.7, shotsAverage: 14.9, homeEfficiency: 0.9, awayEfficiency: 0.8, cleanSheetRate: 0.67, bttsRate: 0.29, offensiveEfficiency: 0.88, defensiveEfficiency: 0.93, momentum: 0.91 },
  Dinamarca: { team: "Dinamarca", fifaRank: 21, formLast5: 0.6, formLast10: 0.63, goalsScoredAverage: 1.4, goalsConcededAverage: 1.0, cornersAverage: 5.3, cardsAverage: 1.9, shotsAverage: 12.6, homeEfficiency: 0.68, awayEfficiency: 0.57, cleanSheetRate: 0.34, bttsRate: 0.48, offensiveEfficiency: 0.67, defensiveEfficiency: 0.72, momentum: 0.61 },
  "Estados Unidos": { team: "Estados Unidos", fifaRank: 16, formLast5: 0.6, formLast10: 0.62, goalsScoredAverage: 1.55, goalsConcededAverage: 1.15, cornersAverage: 5.4, cardsAverage: 1.65, shotsAverage: 12.9, homeEfficiency: 0.77, awayEfficiency: 0.58, cleanSheetRate: 0.32, bttsRate: 0.56, offensiveEfficiency: 0.7, defensiveEfficiency: 0.65, momentum: 0.66 },
  Suíça: { team: "Suíça", fifaRank: 19, formLast5: 0.67, formLast10: 0.65, goalsScoredAverage: 1.4, goalsConcededAverage: 0.95, cornersAverage: 4.9, cardsAverage: 1.75, shotsAverage: 11.9, homeEfficiency: 0.69, awayEfficiency: 0.64, cleanSheetRate: 0.42, bttsRate: 0.44, offensiveEfficiency: 0.66, defensiveEfficiency: 0.76, momentum: 0.68 },
};

export interface WorldCupFixtureModel {
  id: string;
  home: string;
  away: string;
  odds: Record<string, number>;
}

export const worldCupFixtures: WorldCupFixtureModel[] = [
  { id: "wc-bra-mar", home: "Brasil", away: "Marrocos", odds: { "Vitória Brasil": 1.82, "Over 1.5": 1.48, "Over 2.5": 2.02, "Over 3.5": 3.4, BTTS: 1.98, "Escanteios +8.5": 1.8, "Cartões +3.5": 1.72, "Brasil primeiro gol": 1.6, "Brasil empate anula": 1.34, "Brasil ou empate": 1.19 } },
  { id: "wc-fra-jpn", home: "França", away: "Japão", odds: { "Vitória França": 1.62, "Over 1.5": 1.42, "Over 2.5": 1.9, "Over 3.5": 3.05, BTTS: 2.05, "Escanteios +8.5": 1.76, "Cartões +3.5": 1.96, "França primeiro gol": 1.48, "França empate anula": 1.2, "França ou empate": 1.13 } },
  { id: "wc-arg-den", home: "Argentina", away: "Dinamarca", odds: { "Vitória Argentina": 1.76, "Over 1.5": 1.5, "Over 2.5": 2.12, "Over 3.5": 3.55, BTTS: 2.14, "Escanteios +8.5": 1.88, "Cartões +3.5": 1.68, "Argentina primeiro gol": 1.56, "Argentina empate anula": 1.28, "Argentina ou empate": 1.16 } },
  { id: "wc-usa-sui", home: "Estados Unidos", away: "Suíça", odds: { "Vitória Estados Unidos": 2.32, "Over 1.5": 1.55, "Over 2.5": 2.2, "Over 3.5": 3.75, BTTS: 1.87, "Escanteios +8.5": 1.84, "Cartões +3.5": 1.82, "Estados Unidos primeiro gol": 2.0, "Estados Unidos empate anula": 1.68, "Estados Unidos ou empate": 1.42 } },
];
