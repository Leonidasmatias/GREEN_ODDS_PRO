// Sprint 8.3 — Production Persistence.
// Snapshot "rico" compartilhado pelos dois scripts de validação de
// restart (`persist.mjs`/`readBack.mjs`) — inclui todos os grupos de
// campos que a missão exige confirmar sem perda (recommendation via
// prediction/goalDistribution, markets via goalDistribution.overUnder,
// metadata, hashes, fatores via explanation, confidence, risk via
// quality, green score), para que o teste de integração possa comparar
// profundamente o snapshot lido de volta contra este original.
export function buildRestartCheckSnapshot(runId) {
  return {
    matchId: `restart-check-${runId}`,
    homePlayerId: "restart-home",
    awayPlayerId: "restart-away",
    virtualTeamHome: "Restart FC",
    virtualTeamAway: "Durability United",
    league: "Restart Validation League",
    period: "2026-07",
    sequenceKey: 1,
    result: {
      metadata: {
        generatedAt: "2026-07-28T09:00:00.000Z",
        configurationHash: "restart-check-config",
        orchestratorModelVersion: "esoccer-prediction-orchestrator-v1.0.0-provisional",
      },
      greenScore: { score: 88.5, category: "VERY_HIGH" },
      confidence: 91.2,
      prediction: {
        predictedOutcome: "HOME_WIN",
        probabilities: { homeWin: 0.62, draw: 0.21, awayWin: 0.17 },
        topProbability: 0.62,
        probabilityMargin: 0.41,
      },
      goalDistribution: {
        mostLikelyScore: { homeGoals: 3, awayGoals: 1, probability: 0.14 },
        overUnder: [
          { line: 1.5, over: 0.81 },
          { line: 2.5, over: 0.63 },
        ],
        bothTeamsToScore: { yes: 0.47, no: 0.53 },
      },
      quality: {
        combinedStatus: "STRONG",
        consistency: { level: "ALIGNED", matchingWinner: true },
      },
      explanation: {
        topSignals: [{ type: "RATING_ADVANTAGE", source: "PREDICTION_ENGINE", favors: "HOME", magnitude: 0.31 }],
        totalSignalsConsidered: 12,
      },
      warnings: [],
    },
  };
}
