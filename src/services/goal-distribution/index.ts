// Fase 4 — Sprint 4.2 — Goal Distribution Engine Foundation.
// Barrel export: fachada pública do Goal Distribution Engine, no mesmo
// padrão já usado por `src/services/prediction/index.ts` (Sprint 4.1) e
// `src/services/observability/index.ts` (Fase 3.5) — um único ponto de
// entrada consumidor-facing (`predictGoalDistribution`), com os módulos
// internos também exportados para composição avançada/teste, seguindo a
// mesma convenção da Sprint 4.1.

export { predictGoalDistribution } from "./GoalDistributionEngine.ts";
export { computeExpectedGoals } from "./ExpectedGoalsEngine.ts";
export { buildExpectedGoalsFeatures, orientHeadToHeadGoals } from "./ExpectedGoalsFeatureBuilder.ts";
export { evaluateGoalDistributionDataSufficiency } from "./GoalDistributionDataSufficiency.ts";
export { poissonProbability, buildPoissonDistribution, sanitizeLambda } from "./PoissonDistribution.ts";
export { buildScoreMatrix, extractExactScores, rankExactScores } from "./ScoreMatrixEngine.ts";
export { computeOverUnder, computeGoalLineProbability, computeBothTeamsToScore, computeScoreDerivedOutcomeProbabilities } from "./GoalMarketsEngine.ts";
export {
  GOAL_DISTRIBUTION_MODEL_VERSION,
  DEFAULT_GOAL_DISTRIBUTION_CONFIG,
  DEFAULT_GOAL_DISTRIBUTION_WEIGHTS,
  DEFAULT_GOAL_DISTRIBUTION_DATA_SUFFICIENCY_THRESHOLDS,
  DEFAULT_GOAL_DISTRIBUTION_SHRINKAGE,
  DEFAULT_OVER_UNDER_LINES,
  validateGoalDistributionConfig,
  GoalDistributionConfigurationError,
} from "./GoalDistributionConfig.ts";
export type {
  GoalDistributionConfig,
  GoalDistributionModelWeights,
  GoalDistributionShrinkageConfig,
} from "./GoalDistributionConfig.ts";
export type {
  GoalDistributionPlayerInputs,
  GoalDistributionRequest,
  ExpectedGoals,
  GoalFeatureTrace,
  PoissonProbability,
  ExactScoreProbability,
  GoalLineProbability,
  BothTeamsToScoreProbability,
  ScoreDerivedOutcomeProbabilities,
  GoalDistributionPrediction,
  DataSufficiencyResult,
  DataSufficiencyStatus,
  FeatureAvailability,
} from "./types.ts";
export type { ExpectedGoalsComputation } from "./ExpectedGoalsEngine.ts";
export type { OrientedHeadToHeadGoals } from "./ExpectedGoalsFeatureBuilder.ts";
