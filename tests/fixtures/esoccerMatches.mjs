// Fase 1 — Fundação do domínio eSoccer.
// SIMULATED_TEST_DATA: todas as partidas, placares e horários abaixo são
// dados simulados para testes automatizados. Nenhuma partida ou placar aqui
// corresponde a um evento real. Não usar como fonte de dados de produção.

export const ESOCCER_FIXTURES_DATA_KIND = "SIMULATED_TEST_DATA";

export const esoccerMatchFixtures = [
  {
    id: "fixture-esoccer-001",
    league: "Esoccer Battle - 8 mins play",
    scheduledAt: "2026-07-01T12:00:00.000Z",
    rawHomeName: "Juventus (Kavviro)",
    rawAwayName: "Roma (nekishka)",
    status: "FINISHED",
    homeScore: 3,
    awayScore: 1,
    provider: "FIXTURE",
  },
  {
    id: "fixture-esoccer-002",
    league: "Esoccer Battle - 8 mins play",
    scheduledAt: "2026-07-01T12:16:00.000Z",
    rawHomeName: "Napoli (Grellz)",
    rawAwayName: "Sassuolo (riko)",
    status: "FINISHED",
    homeScore: 2,
    awayScore: 2,
    provider: "FIXTURE",
  },
  {
    id: "fixture-esoccer-003",
    league: "Esoccer Battle Volta - 6 mins play",
    scheduledAt: "2026-07-01T13:00:00.000Z",
    rawHomeName: "Spain (DangerDim77)",
    rawAwayName: "England (A1ose)",
    status: "SCHEDULED",
    homeScore: null,
    awayScore: null,
    provider: "FIXTURE",
  },
  {
    id: "fixture-esoccer-004",
    league: "Esoccer Battle - 8 mins play",
    scheduledAt: "2026-07-01T13:16:00.000Z",
    rawHomeName: "Bologna (Nightxx)",
    rawAwayName: "Napoli (Grellz)",
    status: "LIVE",
    homeScore: 1,
    awayScore: 0,
    provider: "FIXTURE",
  },
];
