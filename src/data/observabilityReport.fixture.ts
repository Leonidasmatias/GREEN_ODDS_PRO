// Fixture de desenvolvimento/demonstração para o Dashboard de
// Inteligência (`/intelligence`, Sprint 6.0). Usada SOMENTE enquanto não
// existir uma fonte real de `ObservabilityReport` (nenhum job/repositório
// ainda produz um relatório real — confirmado por auditoria antes desta
// implementação). Construída chamando a PRÓPRIA cadeia real de módulos
// (`predictMatch` -> `toLearningHistoricalRecord` -> `buildLearningReport`
// -> `buildAdaptiveReport` -> `buildObservabilityReport`), nunca dados
// inventados manualmente — garante que a fixture permanece
// estruturalmente compatível com `ObservabilityReport` mesmo que os
// contratos evoluam. Determinística: nenhum `Date.now()`/`Math.random()`,
// todo "agora" é uma data fixa injetada explicitamente.

// Imports relativos (não `@/`) — esta fixture precisa ser executável
// também por `node --test` (sem bundler), mesma justificativa documentada
// em `intelligenceFormatters.ts`.
import { predictMatch } from "../services/prediction-orchestrator/index.ts";
import { buildLearningReport, toLearningHistoricalRecord, DEFAULT_PREDICTION_LEARNING_CONFIG } from "../services/prediction-learning/index.ts";
import { buildAdaptiveReport, DEFAULT_PREDICTION_ADAPTATION_CONFIG } from "../services/prediction-adaptation/index.ts";
import { buildObservabilityReport, DEFAULT_PREDICTION_OBSERVABILITY_CONFIG, type ObservabilityReport } from "../services/prediction-observability/index.ts";
import type { PredictionOrchestratorRequest } from "../services/prediction-orchestrator/index.ts";

type FixturePlayerInputs = PredictionOrchestratorRequest["homePlayer"];

const FIXTURE_NOW = () => new Date("2026-07-27T12:00:00.000Z");

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

const MATCH_COUNT = 40;
const WINDOW_SPLIT = 20;

function buildFixtureLearningRecords() {
  const records = [];
  for (let i = 0; i < MATCH_COUNT; i += 1) {
    const homeStronger = i % 3 !== 0;
    const homePlayer = fixturePlayer(`jogador-casa-${i}`, homeStronger ? 1720 : 1380);
    const awayPlayer = fixturePlayer(`jogador-fora-${i}`, homeStronger ? 1380 : 1720);
    const result = predictMatch({ homePlayer, awayPlayer, headToHead: null }, undefined, FIXTURE_NOW);
    const actualOutcome = i % 5 === 0 ? "DRAW" : result.prediction.predictedOutcome;

    records.push(
      toLearningHistoricalRecord({
        snapshot: {
          matchId: `demo-${i}`,
          homePlayerId: homePlayer.playerId,
          awayPlayerId: awayPlayer.playerId,
          virtualTeamHome: i % 2 === 0 ? "Bologna Virtual" : "Juventus Virtual",
          virtualTeamAway: i % 2 === 0 ? "Roma Virtual" : "Napoli Virtual",
          league: i % 2 === 0 ? "eSoccer Battle - Liga A" : "eSoccer Battle - Liga B",
          period: i < WINDOW_SPLIT ? "2026-06" : "2026-07",
          sequenceKey: i,
          result,
        },
        actual: { matchId: `demo-${i}`, outcome: actualOutcome, homeGoals: 2, awayGoals: 1 },
      }),
    );
  }
  return records;
}

function buildFixtureObservabilityReport(): ObservabilityReport {
  const records = buildFixtureLearningRecords();
  const learningConfig = { ...DEFAULT_PREDICTION_LEARNING_CONFIG, minimumRecordsPerProfile: 1, minimumRecordsPerWindow: 1, minimumRecordsForDrift: 1 };

  const learningReport = buildLearningReport(
    { datasetId: "fixture-dataset", records },
    learningConfig,
    {
      reportId: "fixture-learning-report",
      generatedAt: "2026-07-27T11:55:00.000Z",
      baselineWindow: { label: "Janela anterior", fromSequenceKey: 0, toSequenceKey: WINDOW_SPLIT - 1 },
      currentWindow: { label: "Janela atual", fromSequenceKey: WINDOW_SPLIT, toSequenceKey: MATCH_COUNT - 1 },
    },
  );

  const adaptiveReport = buildAdaptiveReport(learningReport, DEFAULT_PREDICTION_ADAPTATION_CONFIG, {
    reportId: "fixture-adaptive-report",
    generatedAt: "2026-07-27T11:58:00.000Z",
  });

  return buildObservabilityReport(learningReport, adaptiveReport, DEFAULT_PREDICTION_OBSERVABILITY_CONFIG, {
    reportId: "fixture-observability-report",
    generatedAt: "2026-07-27T12:00:00.000Z",
    timelineTimestamp: "2026-07-27T12:00:00.000Z",
  });
}

/** Relatório de demonstração — calculado uma única vez na carga do
 * módulo (determinístico, sem custo repetido por requisição). */
export const OBSERVABILITY_REPORT_FIXTURE: ObservabilityReport = buildFixtureObservabilityReport();
