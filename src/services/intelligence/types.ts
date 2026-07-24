// Fase 1.5 — Intelligence Engine.
// Tipos compartilhados pelos engines estatísticos. Nenhum tipo aqui depende
// do Prisma Client — todos os engines de cálculo (Módulos 1-9) operam sobre
// estruturas de dados simples, permitindo testes 100% offline.

/**
 * Um registro de partida do ponto de vista de UM jogador específico:
 * "goalsFor"/"goalsAgainst" já estão orientados para esse jogador,
 * independente de ele ter jogado como mandante ou visitante na partida.
 */
export type ESoccerPlayerMatchRecord = {
  matchId: string;
  playedAt: string;
  isHome: boolean;
  opponentPlayerId: string;
  goalsFor: number;
  goalsAgainst: number;
};

export type ESoccerMatchOutcome = "WIN" | "DRAW" | "LOSS";

export function outcomeForRecord(record: ESoccerPlayerMatchRecord): ESoccerMatchOutcome {
  if (record.goalsFor > record.goalsAgainst) return "WIN";
  if (record.goalsFor === record.goalsAgainst) return "DRAW";
  return "LOSS";
}

export function clampScore(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
