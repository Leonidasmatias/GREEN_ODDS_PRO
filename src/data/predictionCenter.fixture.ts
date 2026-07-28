// Sprint 6.5 — Prediction Center.
// Fixture de desenvolvimento/demonstração. Usada SOMENTE enquanto não
// existir uma fonte real de `PredictionSnapshot` (nenhuma ingestão/
// persistência ainda produz um snapshot real para partidas futuras —
// confirmado por auditoria arquitetural antes desta implementação, mesma
// situação já documentada para `observabilityReport.fixture.ts` na
// Sprint 6.0). Construída chamando a PRÓPRIA cadeia real do Prediction
// Orchestrator (`predictMatch`), nunca um `PredictionResult` montado ou
// copiado manualmente — garante que a fixture permanece estruturalmente
// e numericamente compatível com o motor real mesmo que seus contratos
// evoluam. Determinística: nenhum `Date.now()`/`Math.random()`, todo
// "agora" é uma data fixa injetada explicitamente (mesmo padrão de
// `now: () => Date` já usado por `predictMatch`).

// Imports relativos (não `@/`) — esta fixture precisa ser executável
// também por `node --test` (sem bundler), mesma justificativa documentada
// em `predictionCenterFormatters.ts`. Importa exclusivamente das fachadas
// públicas do Prediction Orchestrator (4.3) e do framework de avaliação
// (4.5, de onde vem o envelope de identidade `PredictionSnapshot`) —
// nenhum import do pipeline legado (`greenScoreEngine`,
// `GreenScoreOpportunity`, `ValueOpportunity`, ML/Discovery/Risk/Odds,
// `ESoccerPrediction`/`ESoccerRecommendation`).
import { predictMatch } from "../services/prediction-orchestrator/index.ts";
import type { PredictionOrchestratorRequest } from "../services/prediction-orchestrator/index.ts";
import type { PredictionSnapshot } from "../services/prediction-evaluation/index.ts";

type FixturePlayerInputs = PredictionOrchestratorRequest["homePlayer"];

const FIXTURE_NOW = () => new Date("2026-07-28T09:00:00.000Z");

/** Perfil mínimo de jogador — somente `rating`/`matchesCount` preenchidos,
 * todo o restante `null`. Mesmo padrão mínimo já validado e aprovado na
 * fixture da Sprint 6.0 (`observabilityReport.fixture.ts`): suficiente
 * para o motor real produzir um `PredictionResult` completo e válido,
 * sem fabricar nenhum indicador que o motor não calcularia sozinho a
 * partir de um perfil real igualmente incompleto. */
function fixturePlayer(id: string, rating: number): FixturePlayerInputs {
  return {
    playerId: id,
    matchesCount: 24,
    rating: { playerId: id, rating, matchesCount: 24 },
    form: null,
    homeAway: null,
    momentum: null,
    strength: null,
    confidence: null,
    greenScore: null,
    goalsRates: null,
  };
}

type FixtureMatchInput = {
  matchId: string;
  homePlayerId: string;
  awayPlayerId: string;
  homeRating: number;
  awayRating: number;
  virtualTeamHome: string;
  virtualTeamAway: string;
  league: string;
  period: string;
  sequenceKey: number;
};

/**
 * Constrói UM `PredictionSnapshot` chamando `predictMatch` de verdade —
 * `result` nunca é montado ou copiado manualmente, é exatamente o que o
 * Prediction Orchestrator calcula para os jogadores informados.
 * `headToHead: null` representa o cenário real (e comum) de um confronto
 * sem histórico direto suficiente — não é um valor fabricado, é a
 * ausência de dado, transportada como tal.
 */
function buildFixtureSnapshot(input: FixtureMatchInput): PredictionSnapshot {
  const homePlayer = fixturePlayer(input.homePlayerId, input.homeRating);
  const awayPlayer = fixturePlayer(input.awayPlayerId, input.awayRating);
  const result = predictMatch({ homePlayer, awayPlayer, headToHead: null }, undefined, FIXTURE_NOW);

  return {
    matchId: input.matchId,
    homePlayerId: input.homePlayerId,
    awayPlayerId: input.awayPlayerId,
    virtualTeamHome: input.virtualTeamHome,
    virtualTeamAway: input.virtualTeamAway,
    league: input.league,
    period: input.period,
    sequenceKey: input.sequenceKey,
    result,
  };
}

/**
 * Três partidas de demonstração com perfis de rating naturalmente
 * distintos (mandante favorito, equilibrada, visitante favorito) — a
 * variedade de resultado (1X2, mercados, Green Score, confiança) surge
 * inteiramente do próprio motor a partir dessas entradas, nunca de um
 * comportamento fabricado ou forçado artificialmente (nenhum cenário foi
 * escolhido para produzir um `warning`/nível de risco específico).
 */
const FIXTURE_MATCHES: FixtureMatchInput[] = [
  {
    matchId: "prediction-center-fixture-1",
    homePlayerId: "jogador-mandante-1",
    awayPlayerId: "jogador-visitante-1",
    homeRating: 1750,
    awayRating: 1400,
    virtualTeamHome: "Bologna Virtual",
    virtualTeamAway: "Roma Virtual",
    league: "eSoccer Battle - Liga A",
    period: "2026-07",
    sequenceKey: 1,
  },
  {
    matchId: "prediction-center-fixture-2",
    homePlayerId: "jogador-mandante-2",
    awayPlayerId: "jogador-visitante-2",
    homeRating: 1550,
    awayRating: 1530,
    virtualTeamHome: "Juventus Virtual",
    virtualTeamAway: "Napoli Virtual",
    league: "eSoccer Battle - Liga B",
    period: "2026-07",
    sequenceKey: 2,
  },
  {
    matchId: "prediction-center-fixture-3",
    homePlayerId: "jogador-mandante-3",
    awayPlayerId: "jogador-visitante-3",
    homeRating: 1380,
    awayRating: 1700,
    virtualTeamHome: "Inter Virtual",
    virtualTeamAway: "Milan Virtual",
    league: "eSoccer Battle - Liga A",
    period: "2026-07",
    sequenceKey: 3,
  },
];

/** Constrói o lote completo de `PredictionSnapshot[]` — exportada (e não
 * apenas o resultado precomputado) para permitir que os testes comprovem
 * determinismo entre duas execuções independentes da cadeia real, não
 * apenas duas leituras da mesma referência em memória. */
export function buildPredictionCenterFixture(): PredictionSnapshot[] {
  return FIXTURE_MATCHES.map((match) => buildFixtureSnapshot(match));
}

/** Lote de demonstração — calculado uma única vez na carga do módulo
 * (determinístico, sem custo repetido por requisição). */
export const PREDICTION_CENTER_FIXTURE: PredictionSnapshot[] = buildPredictionCenterFixture();
