import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionCenterViewModel } from "../src/adapters/predictionCenterAdapter.ts";
import { NOT_AVAILABLE } from "../src/lib/predictionCenterFormatters.ts";
import { PREDICTION_CENTER_FIXTURE } from "../src/data/predictionCenter.fixture.ts";

function dataSufficiency(overrides = {}) {
  return { status: "STRONG", sampleSize: 40, homeSampleSize: 20, awaySampleSize: 20, headToHeadSampleSize: 5, warnings: [], ...overrides };
}

function predictionResult(overrides = {}) {
  return {
    modelVersion: "esoccer-prediction-v1.0.0-provisional",
    generatedAt: "2026-07-28T09:00:00.000Z",
    probabilities: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 },
    predictedOutcome: "HOME_WIN",
    topProbability: 0.6,
    probabilityMargin: 0.35,
    dataSufficiency: dataSufficiency(),
    featureTrace: [],
    ...overrides,
  };
}

function goalDistributionResult(overrides = {}) {
  return {
    modelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
    generatedAt: "2026-07-28T09:00:00.000Z",
    expectedGoals: { home: 1.8, away: 1.1, total: 2.9 },
    homeGoalDistribution: [],
    awayGoalDistribution: [],
    exactScores: [],
    mostLikelyScore: { homeGoals: 2, awayGoals: 1, totalGoals: 3, probability: 0.14 },
    topExactScores: [],
    topExactScoresAggregateProbability: 0.4,
    overUnder: [
      { line: 0.5, over: 0.92, under: 0.08 },
      { line: 1.5, over: 0.71, under: 0.29 },
      { line: 2.5, over: 0.48, under: 0.52 },
      { line: 3.5, over: 0.27, under: 0.73 },
    ],
    bothTeamsToScore: { yes: 0.55, no: 0.45 },
    scoreDerivedOutcomeProbabilities: { homeWin: 0.58, draw: 0.24, awayWin: 0.18 },
    dataSufficiency: dataSufficiency(),
    featureTrace: [],
    warnings: [],
    ...overrides,
  };
}

function quality(overrides = {}) {
  const { consistency: consistencyOverrides, ...rest } = overrides;
  return {
    predictionDataSufficiency: "STRONG",
    goalDistributionDataSufficiency: "STRONG",
    combinedStatus: "STRONG",
    consistency: { level: "ALIGNED", matchingWinner: true, maxProbabilityDelta: 0.02, adjustment: 8, ...consistencyOverrides },
    ...rest,
  };
}

function fullResult(overrides = {}) {
  return {
    prediction: predictionResult(overrides.prediction),
    goalDistribution: goalDistributionResult(overrides.goalDistribution),
    greenScore: { score: 78, category: "HIGH", ...overrides.greenScore },
    confidence: overrides.confidence ?? 82,
    quality: quality(overrides.quality),
    warnings: overrides.warnings ?? [],
    explanation: {
      topSignals: [
        { type: "RATING_ADVANTAGE", source: "PREDICTION_ENGINE", favors: "HOME", magnitude: 0.7 },
        { type: "GOAL_EXPECTATION_ADVANTAGE", source: "GOAL_DISTRIBUTION_ENGINE", favors: "HOME", magnitude: 0.4 },
      ],
      totalSignalsConsidered: 6,
      ...overrides.explanation,
    },
    metadata: {
      predictionModelVersion: "esoccer-prediction-v1.0.0-provisional",
      goalDistributionModelVersion: "esoccer-goal-distribution-v1.0.0-provisional",
      orchestratorModelVersion: "esoccer-prediction-orchestrator-v1.0.0-provisional",
      generatedAt: "2026-07-28T09:00:00.000Z",
      configurationHash: "abc123",
      ...overrides.metadata,
    },
  };
}

function snapshot(overrides = {}) {
  const { result: resultOverrides, ...rest } = overrides;
  return {
    matchId: "match-1",
    homePlayerId: "home-1",
    awayPlayerId: "away-1",
    virtualTeamHome: "Bologna Virtual",
    virtualTeamAway: "Roma Virtual",
    league: "eSoccer Battle - Liga A",
    period: "2026-07",
    sequenceKey: 1,
    result: fullResult(resultOverrides),
    ...rest,
  };
}

// ---------------------------------------------------------------------
// Mapeamento completo de campos
// ---------------------------------------------------------------------

test("maps header from snapshot identity and result metadata", () => {
  const vm = buildPredictionCenterViewModel(snapshot());
  assert.equal(vm.header.matchId, "match-1");
  assert.equal(vm.header.homeTeamLabel, "Bologna Virtual");
  assert.equal(vm.header.awayTeamLabel, "Roma Virtual");
  assert.equal(vm.header.leagueLabel, "eSoccer Battle - Liga A");
  assert.equal(vm.header.modelVersion, "esoccer-prediction-orchestrator-v1.0.0-provisional");
  assert.ok(vm.header.generatedAtLabel.includes("2026"));
});

test("maps scores from result.greenScore/result.confidence, never recalculated", () => {
  const vm = buildPredictionCenterViewModel(snapshot());
  assert.equal(vm.scores.greenScore, 78);
  assert.equal(vm.scores.greenScoreCategory, "HIGH");
  assert.equal(vm.scores.greenScoreLabel, "78.0%");
  assert.equal(vm.scores.greenScoreCategoryLabel, "Alto");
  assert.equal(vm.scores.confidence, 82);
  assert.equal(vm.scores.confidenceLabel, "82.0%");
});

test("maps outcome from result.prediction, formatting 0-1 probabilities correctly", () => {
  const vm = buildPredictionCenterViewModel(snapshot());
  assert.equal(vm.outcome.predictedOutcome, "HOME_WIN");
  assert.equal(vm.outcome.predictedOutcomeLabel, "Vitória do mandante");
  assert.equal(vm.outcome.probabilities.homeWin, "60.0%");
  assert.equal(vm.outcome.probabilities.draw, "25.0%");
  assert.equal(vm.outcome.probabilities.awayWin, "15.0%");
  assert.equal(vm.outcome.topProbabilityLabel, "60.0%");
  assert.equal(vm.outcome.marginLabel, "35.0%");
});

test("maps predictedScore from goalDistribution.mostLikelyScore", () => {
  const vm = buildPredictionCenterViewModel(snapshot());
  assert.equal(vm.predictedScore.homeGoals, 2);
  assert.equal(vm.predictedScore.awayGoals, 1);
  assert.equal(vm.predictedScore.probabilityLabel, "14.0%");
});

test("maps exactly the six markets (1X2 + Over 1.5 + Over 2.5 + BTTS)", () => {
  const vm = buildPredictionCenterViewModel(snapshot());
  assert.deepEqual(
    vm.markets.map((m) => m.code),
    ["HOME_WIN", "DRAW", "AWAY_WIN", "OVER_1_5", "OVER_2_5", "BTTS"],
  );
  const over15 = vm.markets.find((m) => m.code === "OVER_1_5");
  const over25 = vm.markets.find((m) => m.code === "OVER_2_5");
  const btts = vm.markets.find((m) => m.code === "BTTS");
  assert.equal(over15.probabilityValue, 0.71);
  assert.equal(over15.probabilityLabel, "71.0%");
  assert.equal(over25.probabilityValue, 0.48);
  assert.equal(btts.probabilityValue, 0.55);
});

test("maps confidenceContext from result.quality, never recalculated", () => {
  const vm = buildPredictionCenterViewModel(snapshot());
  assert.equal(vm.confidenceContext.dataSufficiencyLabel, "Dados robustos");
  assert.equal(vm.confidenceContext.consistencyLabel, "Motores alinhados");
  assert.equal(vm.confidenceContext.consistencyMatchingWinner, true);
});

test("maps explanation.topSignals, translating type/source/favors/magnitude", () => {
  const vm = buildPredictionCenterViewModel(snapshot());
  assert.equal(vm.explanation.totalSignalsConsidered, 6);
  assert.equal(vm.explanation.topSignals.length, 2);
  assert.equal(vm.explanation.topSignals[0].typeLabel, "Vantagem de rating");
  assert.equal(vm.explanation.topSignals[0].sourceLabel, "Motor de resultado (1X2)");
  assert.equal(vm.explanation.topSignals[0].favorsLabel, "Favorece o mandante");
  assert.equal(vm.explanation.topSignals[0].magnitudeLabel, "70.0%");
});

test("maps warnings verbatim, as a new array (never the same reference)", () => {
  const originalWarnings = ["fallback_conservative_baseline_applied"];
  const input = snapshot({ result: { warnings: originalWarnings } });
  const vm = buildPredictionCenterViewModel(input);
  assert.deepEqual(vm.warnings, originalWarnings);
  assert.notEqual(vm.warnings, originalWarnings);
});

// ---------------------------------------------------------------------
// NOT_AVAILABLE — nunca 0, nunca valor assumido
// ---------------------------------------------------------------------

test("header falls back to NOT_AVAILABLE when virtualTeamHome/virtualTeamAway/league are null", () => {
  const vm = buildPredictionCenterViewModel(snapshot({ virtualTeamHome: null, virtualTeamAway: null, league: null }));
  assert.equal(vm.header.homeTeamLabel, NOT_AVAILABLE);
  assert.equal(vm.header.awayTeamLabel, NOT_AVAILABLE);
  assert.equal(vm.header.leagueLabel, NOT_AVAILABLE);
});

test("a market whose Over/Under line is not present in overUnder[] degrades to NOT_AVAILABLE, never 0 or an index guess (robustness / 'invalid' edge case)", () => {
  const input = snapshot({
    result: { goalDistribution: { overUnder: [{ line: 0.5, over: 0.9, under: 0.1 }] } }, // sem 1.5 nem 2.5
  });
  const vm = buildPredictionCenterViewModel(input);
  const over15 = vm.markets.find((m) => m.code === "OVER_1_5");
  const over25 = vm.markets.find((m) => m.code === "OVER_2_5");
  assert.equal(over15.probabilityValue, null);
  assert.equal(over15.probabilityLabel, NOT_AVAILABLE);
  assert.equal(over25.probabilityValue, null);
  assert.equal(over25.probabilityLabel, NOT_AVAILABLE);
});

test("does not throw for a structurally valid but data-sparse snapshot (empty overUnder array)", () => {
  const input = snapshot({ result: { goalDistribution: { overUnder: [] } } });
  assert.doesNotThrow(() => buildPredictionCenterViewModel(input));
  const vm = buildPredictionCenterViewModel(input);
  assert.equal(vm.markets.find((m) => m.code === "OVER_1_5").probabilityValue, null);
});

// ---------------------------------------------------------------------
// bestMarket
// ---------------------------------------------------------------------

test("bestMarket selects the market with the highest probabilityValue among all six", () => {
  const vm = buildPredictionCenterViewModel(snapshot());
  // homeWin=0.6 é o maior entre 0.6/0.25/0.15/0.71/0.48/0.55 -> na verdade 0.71 (OVER_1_5) é maior
  assert.equal(vm.bestMarket.code, "OVER_1_5");
  assert.equal(vm.bestMarket.probabilityValue, 0.71);
});

test("bestMarket still resolves to a real market (0 is a valid probability, never treated as absent) even when Over/Under lines are missing", () => {
  const input = snapshot({
    result: {
      prediction: { probabilities: { homeWin: 0, draw: 0, awayWin: 0 } },
      goalDistribution: { overUnder: [], bothTeamsToScore: { yes: 0, no: 0 } },
    },
  });
  const vm = buildPredictionCenterViewModel(input);
  // 1X2 e BTTS vêm sempre como `number` (nunca `null`) no contrato do
  // motor — só OVER_1_5/OVER_2_5 podem ficar ausentes. bestMarket nunca
  // é `null` na prática por este adaptador; o `null` de `selectBestMarket`
  // (lista vazia ou todos os valores nulos) já é coberto isoladamente em
  // `tests/predictionMarketUtils.test.mjs`.
  assert.ok(vm.bestMarket !== null);
  assert.equal(vm.bestMarket.probabilityValue, 0);
});

// ---------------------------------------------------------------------
// risk / status: success, partial, "invalid" (robustez de campo), empty (n/a neste nível)
// ---------------------------------------------------------------------

test("status is 'success' and risk is LOW when every signal is clean (STRONG, ALIGNED, no warnings)", () => {
  const vm = buildPredictionCenterViewModel(snapshot());
  assert.equal(vm.status, "success");
  assert.equal(vm.risk.level, "LOW");
  assert.deepEqual(vm.risk.reasons, []);
});

test("status is 'partial' and risk reflects degraded quality/consistency/warnings", () => {
  const input = snapshot({
    result: {
      quality: { combinedStatus: "LIMITED", consistency: { level: "MINOR_DIVERGENCE" } },
      warnings: ["fallback_conservative_baseline_applied"],
    },
  });
  const vm = buildPredictionCenterViewModel(input);
  assert.equal(vm.status, "partial");
  assert.notEqual(vm.risk.level, "LOW");
  assert.ok(vm.risk.reasons.length > 0);
  assert.ok(vm.risk.reasons.includes("Amostra de dados limitada para esta partida"));
  assert.ok(vm.risk.reasons.includes("O motor reportou avisos para esta previsão"));
});

test("'invalid' edge case: a snapshot with a structurally sparse goalDistribution (no Over/Under lines at all) is still processed without throwing, degrading only the affected markets", () => {
  const input = snapshot({ result: { goalDistribution: { overUnder: [] } } });
  assert.doesNotThrow(() => buildPredictionCenterViewModel(input));
});

// Nota: "empty" é um conceito do PredictionCenterDataResult (lote de
// itens, Incremento 4 — service), não do Adapter, que sempre recebe
// exatamente UM PredictionSnapshot já válido. Não há um teste de
// "adapter empty" correspondente por não haver conceito de lote aqui.

// ---------------------------------------------------------------------
// Imutabilidade / determinismo
// ---------------------------------------------------------------------

test("does not mutate the input PredictionSnapshot", () => {
  const input = snapshot();
  const clone = JSON.parse(JSON.stringify(input));
  buildPredictionCenterViewModel(input);
  assert.deepEqual(input, clone);
});

test("is deterministic for identical input", () => {
  const input = snapshot();
  assert.deepEqual(buildPredictionCenterViewModel(input), buildPredictionCenterViewModel(snapshot()));
});

test("produces a new object graph on every call (never returns a shared reference)", () => {
  const input = snapshot();
  const first = buildPredictionCenterViewModel(input);
  const second = buildPredictionCenterViewModel(input);
  assert.notEqual(first, second);
  assert.notEqual(first.markets, second.markets);
  assert.deepEqual(first, second);
});

// ---------------------------------------------------------------------
// Integração com a fixture real (Incremento 2) — não depende
// exclusivamente dela, mas confirma compatibilidade end-to-end.
// ---------------------------------------------------------------------

test("integration: every real fixture snapshot is processed by the adapter without throwing", () => {
  for (const fixtureSnapshot of PREDICTION_CENTER_FIXTURE) {
    assert.doesNotThrow(() => buildPredictionCenterViewModel(fixtureSnapshot));
  }
});

test("integration: the fixture's naturally INSUFFICIENT quality snapshots map to status 'partial' (not fabricated by the adapter, just reflected)", () => {
  for (const fixtureSnapshot of PREDICTION_CENTER_FIXTURE) {
    const vm = buildPredictionCenterViewModel(fixtureSnapshot);
    assert.equal(vm.status, "partial");
  }
});
