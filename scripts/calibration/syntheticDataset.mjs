// Sprint 9.1 — Explainability Calibration & Backtest.
// Dataset SINTÉTICO de demonstração — usado exclusivamente quando não há
// dados reais suficientes (sem DATABASE_URL, ou zero partidas eSoccer
// finalizadas casadas com previsões persistidas). Inteiramente
// determinístico (nenhum Math.random()/Date.now()) para que o pipeline
// de backtest possa ser demonstrado/testado de ponta a ponta sem
// depender de produção. NUNCA apresentado como dado real — o CLI
// (`scripts/calibration.mjs`) rotula explicitamente a origem no
// relatório gerado.

const RECORD_COUNT = 40;
const OUTCOMES = ["HOME_WIN", "DRAW", "AWAY_WIN"];

function buildSnapshot(index) {
  const matchId = `synthetic-match-${index}`;
  const confidence = 15 + index * 2; // 15..93
  const margin = 0.02 + (index % 10) * 0.02; // 0.02..0.20
  const sampleSize = 4 + (index % 8) * 5; // 4..39
  const dataSufficiencyStatus = sampleSize < 8 ? "INSUFFICIENT" : sampleSize < 16 ? "LIMITED" : sampleSize < 28 ? "SUFFICIENT" : "STRONG";
  const headToHeadSampleSize = index % 4 === 0 ? 0 : 2;
  const predictedOutcome = OUTCOMES[index % 3];

  // Padrão determinístico: quanto maior a confiança, maior a chance de a
  // previsão estar correta neste dataset sintético (para demonstrar uma
  // curva de calibração não-trivial) — nunca aleatório.
  const correct = index % 10 < Math.round(confidence / 12);
  const actualOutcome = correct ? predictedOutcome : OUTCOMES[(index + 1) % 3];

  const probabilities =
    predictedOutcome === "HOME_WIN"
      ? { homeWin: 0.5 + margin / 2, draw: 0.3 - margin / 4, awayWin: 0.2 - margin / 4 }
      : predictedOutcome === "AWAY_WIN"
        ? { homeWin: 0.2 - margin / 4, draw: 0.3 - margin / 4, awayWin: 0.5 + margin / 2 }
        : { homeWin: 0.3 - margin / 4, draw: 0.4 + margin / 2, awayWin: 0.3 - margin / 4 };

  const generatedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + index * 3600_000).toISOString();

  const feature = (name, availability) => ({
    name,
    rawValue: availability === "AVAILABLE" ? 0.4 : null,
    normalizedValue: availability === "AVAILABLE" ? 0.3 : null,
    weight: 1,
    contribution: availability === "AVAILABLE" ? 0.3 : 0,
    availability,
    direction: availability === "AVAILABLE" ? "FAVORS_HOME" : "NEUTRAL",
  });

  const goalFeature = (name, availability) => ({
    name,
    rawValue: null,
    normalizedValue: null,
    weight: 1,
    contributionHome: availability === "AVAILABLE" ? 0.3 : 0,
    contributionAway: availability === "AVAILABLE" ? 0.1 : 0,
    availability,
    explanation: "",
  });

  const featureAvailability = index % 5 === 0 ? "MISSING" : "AVAILABLE";

  const snapshot = {
    matchId,
    homePlayerId: `synthetic-home-${index % 6}`,
    awayPlayerId: `synthetic-away-${index % 6}`,
    virtualTeamHome: `Synthetic Home ${index % 6}`,
    virtualTeamAway: `Synthetic Away ${index % 6}`,
    league: `Synthetic League ${index % 3}`,
    period: "2026-01",
    sequenceKey: index,
    result: {
      prediction: {
        modelVersion: "esoccer-outcome-v1.0.0-provisional",
        generatedAt,
        probabilities,
        predictedOutcome,
        topProbability: Math.max(probabilities.homeWin, probabilities.draw, probabilities.awayWin),
        probabilityMargin: margin,
        dataSufficiency: { status: dataSufficiencyStatus, sampleSize, homeSampleSize: Math.floor(sampleSize / 2), awaySampleSize: Math.ceil(sampleSize / 2), headToHeadSampleSize, warnings: [] },
        featureTrace: [
          feature("ratingDifference", featureAvailability),
          feature("formDifference", featureAvailability),
          feature("strengthDifference", featureAvailability),
          feature("momentumDifference", featureAvailability),
          feature("homeAdvantage", featureAvailability),
          feature("headToHead", headToHeadSampleSize > 0 ? "AVAILABLE" : "MISSING"),
          feature("greenScoreDifference", featureAvailability),
          feature("drawBalance", "AVAILABLE"),
        ],
      },
      goalDistribution: {
        modelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
        generatedAt,
        expectedGoals: { home: 1.3, away: 1.1, total: 2.4 },
        homeGoalDistribution: [],
        awayGoalDistribution: [],
        exactScores: [],
        mostLikelyScore: { homeGoals: 1, awayGoals: 1, totalGoals: 2, probability: 0.15 },
        topExactScores: [],
        topExactScoresAggregateProbability: 0.4,
        overUnder: [],
        bothTeamsToScore: { yes: 0.5, no: 0.5 },
        scoreDerivedOutcomeProbabilities: probabilities,
        dataSufficiency: { status: dataSufficiencyStatus, sampleSize, homeSampleSize: Math.floor(sampleSize / 2), awaySampleSize: Math.ceil(sampleSize / 2), headToHeadSampleSize, warnings: [] },
        featureTrace: [
          goalFeature("recentForm", featureAvailability),
          goalFeature("homeAwaySplit", featureAvailability),
          goalFeature("headToHead", headToHeadSampleSize > 0 ? "AVAILABLE" : "MISSING"),
          goalFeature("momentum", featureAvailability),
          goalFeature("strength", featureAvailability),
        ],
        warnings: [],
      },
      greenScore: { score: Math.min(100, confidence + 5), category: confidence >= 80 ? "VERY_HIGH" : confidence >= 60 ? "HIGH" : confidence >= 40 ? "MEDIUM" : "LOW" },
      confidence,
      quality: {
        predictionDataSufficiency: dataSufficiencyStatus,
        goalDistributionDataSufficiency: dataSufficiencyStatus,
        combinedStatus: dataSufficiencyStatus,
        consistency: { level: index % 7 === 0 ? "MAJOR_DIVERGENCE" : index % 3 === 0 ? "MINOR_DIVERGENCE" : "ALIGNED", matchingWinner: true, maxProbabilityDelta: 0.05, adjustment: 0 },
      },
      warnings: [],
      explanation: {
        topSignals: [{ type: "RATING_ADVANTAGE", source: "PREDICTION_ENGINE", favors: "HOME", magnitude: 0.5 }],
        totalSignalsConsidered: 8,
      },
      metadata: {
        predictionModelVersion: "esoccer-outcome-v1.0.0-provisional",
        goalDistributionModelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
        orchestratorModelVersion: "esoccer-orchestrator-v1.0.0-provisional",
        generatedAt,
        configurationHash: "synthetic-config-hash",
      },
    },
  };

  return { snapshot, actualOutcome };
}

/** Monta o `EvaluationDataset` sintético completo (previsões + resultados
 * reais separados, no mesmo formato exigido pela Sprint 4.5). */
export function buildSyntheticCalibrationDataset() {
  const generated = Array.from({ length: RECORD_COUNT }, (_, index) => buildSnapshot(index));

  const predictions = generated.map(({ snapshot }) => snapshot);
  const actuals = generated.map(({ snapshot, actualOutcome }) => ({
    matchId: snapshot.matchId,
    outcome: actualOutcome,
    homeGoals: 1,
    awayGoals: 1,
  }));

  return { datasetId: "synthetic-demo", predictions, actuals };
}
